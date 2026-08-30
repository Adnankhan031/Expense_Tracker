import { foldJa, narrowAscii } from './jp';

/**
 * Turn the raw text of a receipt into its line items.
 *
 * On-device OCR returns text, not structure. Deciding that `ｷｬﾍﾞﾂ 158` is a
 * purchase and `小計 6,806` is not was previously the model's job; here it is
 * ordinary code, which costs nothing to run and never hits a quota.
 *
 * The rules are the ones already written into the model's prompt, so this is
 * transcription rather than invention:
 *   - a line ending in a number is a candidate item
 *   - 小計 / 合計 / 税 / お預り / お釣り / ポイント and payment lines are not
 *   - 値引 / 割引 are items with a negative amount
 *   - a quantity line belongs to the item above it
 */

export type ParsedLine = { name: string; amount_minor: number };
export type ParsedReceipt = {
  merchant: string | null;
  purchased_on: string | null;
  total: number | null;
  items: ParsedLine[];
};

/** Words that mean "this line is not something you bought". */
const NOT_AN_ITEM = [
  '小計', '合計', '総計', '税', '消費税', '内税', '外税', '対象',
  'お預り', '預り', 'お預かり', 'お釣り', '釣り', 'おつり', 'つり',
  'ポイント', 'point', 'カード', 'クレジット', '現金', '電子マネー',
  'クーポン', 'レジ', '責任者', '番号', 'tel', '電話', '点数', 'お買上',
  '領収', 'レシート', '取引', '売上', '残高', 'バランス', '支払', 'お買上', '買上計',
];

/** Words that mean the amount should be subtracted. */
const DISCOUNT = ['値引', '割引', '引き', 'discount'];

/**
 * A trailing amount: ¥1,290 / 1290 / -100 / ￥ 2,480
 *
 * The leading whitespace requirement is not cosmetic. Without it the "-1" that
 * ends the address 西早稲田 3-1-1 parsed as an item worth minus one yen: a
 * hyphenated street number ends in exactly the shape of a discount.
 */
const TRAILING_AMOUNT = /(?:^|\s)(-?)\s*[*#※¥￥\$]{0,2}\s*(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?\s*[※*軽円]?\s*\)?\s*$/;

/**
 * A quantity or unit-price line, which belongs to the item above it.
 *
 * Japanese tills print the breakdown underneath: "(¥116 X 2個)" beneath a
 * ¥1,160 line. Read as items these both invent purchases and double the
 * basket, so they are dropped in either order — count first or price first.
 */
const QUANTITY_LINE =
  /^\s*\(?\s*(?:[¥￥]?\s*[\d,]+\s*[x×✕*]\s*\d+\s*[点個コこ]?|\d+\s*[点個コこ]?\s*[x×✕*]\s*[¥￥]?\s*[\d,]+)\s*\)?\s*$/i;

/** Till codes printed before the product name: "510_", "#514_", "514.". */
// Two shapes: "510_" with a separator, and "511コ" where the code runs
// straight into the name. The separator form must win even when the name
// itself starts with a digit, as "520_7Pツイストドーナツ" does.
const PRODUCT_CODE = /^[#■]?\s*\d{3}(?:[_.\-\s]\s*|(?=[ァ-ヿ぀-ゟ一-鿿]))/;

/**
 * A unit-price group that landed on the item's own row: "(¥344 X 2個)".
 *
 * These print just under the item, close enough that a slightly skewed photo
 * puts them on the same row, and they are not part of the product's name.
 */
const INLINE_UNIT_PRICE = /[（(]\s*[¥￥]?\s*[\d,]+\s*[xX×✕*]\s*\d+\s*[点個コこ]?\s*[）)]/g;

/**
 * The printed amount, in minor units.
 *
 * Receipts print what you pay: ¥1,160, or 11.50 in a currency with cents. The
 * app stores minor units — printed value times one hundred — everywhere, so
 * converting here is what stops ¥1,160 from being shown as 11.60. Returning raw
 * yen was the bug that made a ¥1,160 noodle pack read as 1.6.
 */
function amountOf(line: string): number | null {
  const m = narrowAscii(line).match(TRAILING_AMOUNT);
  if (!m) return null;
  const whole = Number(m[2].replace(/,/g, ''));
  if (!Number.isFinite(whole)) return null;
  const cents = m[3] ? Number(m[3].padEnd(2, '0')) : 0;
  const minor = whole * 100 + cents;
  return m[1] === '-' ? -minor : minor;
}

function nameOf(line: string): string {
  return narrowAscii(line)
    .replace(TRAILING_AMOUNT, '')
    .replace(INLINE_UNIT_PRICE, ' ')
    .replace(/[※*軽]+\s*$/, '')
    .replace(PRODUCT_CODE, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isExcluded(line: string): boolean {
  const f = foldJa(line);
  return NOT_AN_ITEM.some((w) => f.includes(foldJa(w)));
}

function isDiscount(line: string): boolean {
  const f = foldJa(line);
  return DISCOUNT.some((w) => f.includes(foldJa(w)));
}

/** 2026年08月29日 · 2026/08/29 · 26-08-29 → 2026-08-29 */
function dateIn(text: string): string | null {
  const t = narrowAscii(text);
  const jp = t.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (jp) return `${jp[1]}-${jp[2].padStart(2, '0')}-${jp[3].padStart(2, '0')}`;

  const slash = t.match(/\b(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})\b/);
  if (slash) return `${slash[1]}-${slash[2].padStart(2, '0')}-${slash[3].padStart(2, '0')}`;

  const short = t.match(/\b(\d{2})[/\-.](\d{1,2})[/\-.](\d{1,2})\b/);
  if (short) return `20${short[1]}-${short[2].padStart(2, '0')}-${short[3].padStart(2, '0')}`;

  return null;
}

export function parseReceiptText(raw: string[]): ParsedReceipt {
  const lines = raw.map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);

  /**
   * The shop name, not the slogan above it.
   *
   * Requiring only "no digits" picked 毎日のお買い物をラクラクに — a marketing
   * line — as the merchant. A shop name is short and has no sentence
   * particles; anything long enough to be a sentence is not one.
   */
  const merchant =
    lines
      .slice(0, 8)
      .find(
        (l) =>
          !/\d/.test(l) &&
          l.length >= 2 &&
          l.length <= 14 &&
          !/[をがはにでとへやねよ。、！!？?]/.test(l) &&
          !/ください|ませ|ありがとう|領収|领収/.test(l)
      ) ?? null;

  let purchased_on: string | null = null;
  for (const l of lines) {
    purchased_on = dateIn(l);
    if (purchased_on) break;
  }

  let total: number | null = null;
  const items: ParsedLine[] = [];

  for (const line of lines) {
    const amount = amountOf(line);

    // 合計 is the one excluded line worth keeping, as the receipt's own total.
    if (amount !== null && /合計|総計|お買上計|買上計/.test(line) && !/小計/.test(line)) {
      if (total === null) total = Math.abs(amount);
      continue;
    }

    if (amount === null || isExcluded(line)) continue;

    // "2点 x 198" describes the line above rather than a separate purchase.
    if (QUANTITY_LINE.test(narrowAscii(line))) continue;

    const name = nameOf(line);
    if (!name || /^[\d\s.,:-]+$/.test(name)) continue;

    items.push({ name, amount_minor: isDiscount(line) ? -Math.abs(amount) : amount });
  }

  // A subtotal read as an item would double the basket. If the items already
  // sum to the total, an entry equal to the total is that subtotal.
  if (total !== null && items.length > 1) {
    const sum = items.reduce((a, i) => a + i.amount_minor, 0);
    const dupe = items.findIndex((i) => i.amount_minor === total);
    if (dupe >= 0 && sum - total > 0 && Math.abs(sum - total - total) < total * 0.5) {
      items.splice(dupe, 1);
    }
  }

  return { merchant, purchased_on, total, items };
}

/**
 * Does this reading look right?
 *
 * The parser is exact when it recognises a layout and quietly wrong when it
 * does not — a handful of items found, or a sum nowhere near the printed
 * total. Both are cheap to detect, and they are the only cases worth spending
 * a language model on: everything else the rules already get right, faster and
 * repeatably.
 */
export function looksWrong(
  receipt: { items: { amount_minor: number }[]; total: number | null },
  lineCount: number
): boolean {
  if (receipt.items.length < 2) return true;

  /**
   * Plenty of text, almost nothing extracted.
   *
   * Deliberately loose. A receipt carries a dozen lines of shop name, address,
   * date, totals and thanks before a single product, so three items from
   * fifteen lines is an ordinary small shop, not a failure. Only a long
   * receipt yielding almost nothing is evidence the layout was missed.
   */
  if (lineCount >= 20 && receipt.items.length < lineCount * 0.15) return true;

  const total = receipt.total ?? 0;
  if (total <= 0) return false;

  const sum = receipt.items.reduce((a, i) => a + i.amount_minor, 0);
  // Tax and discounts leave a real gap, so only a large one is suspicious.
  return Math.abs(total - sum) > total * 0.4;
}
