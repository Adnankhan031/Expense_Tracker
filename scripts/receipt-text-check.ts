/**
 * Receipt text -> line items, with no model involved.
 *
 * The input is what on-device OCR hands back: the receipt's lines in order,
 * including the header, the totals block and the change. Everything that is
 * not a purchase has to be dropped here, because nothing downstream can tell.
 */
import { parseReceiptText } from '../src/receiptText';

const OCR_LINES = [
  '業務スーパー',
  '東京都新宿区西早稲田 3-1-1',
  'TEL 03-1234-5678',
  '--------------------------------',
  '2026年08月29日 18:42 レジ 03',
  '--------------------------------',
  'ｷｬﾍﾞﾂ 158',
  'ﾆﾝｼﾞﾝ 128',
  'ﾊﾞﾅﾅ 178',
  'ﾄﾘﾓﾓﾆｸ 2kg 1,290',
  'ﾌﾞﾀﾊﾞﾗ 498',
  'ｷﾞｭｳﾆｭｳ 218',
  'ﾀﾏｺﾞ 10ｺ 268',
  'ｺｼﾋｶﾘ 5kg 2,480',
  'ｼｮｳﾕ 1L 198',
  'ﾎﾟﾃﾄﾁｯﾌﾟｽ 128',
  'ﾋﾞｰﾙ 350ml 228',
  'ﾚｲﾄｳｷﾞｮｳｻﾞ 288',
  'ｼｬﾝﾌﾟｰ 598',
  'ｾﾝｻﾞｲ 248',
  '値引 -100',
  '--------------------------------',
  '小計 6,806',
  '消費税(8%) 242',
  '合計 ￥7,048',
  '--------------------------------',
  'お預り 10,000',
  'お釣り 2,952',
  'ありがとうございました',
];

export function runReceiptTextChecks(): boolean {
  let ok = true;

  // --- 1. a 業務スーパー basket, half-width katakana ---------------------
  const r = parseReceiptText(OCR_LINES);
  const EXPECT: [string, number][] = [
    ['ｷｬﾍﾞﾂ', 158], ['ﾆﾝｼﾞﾝ', 128], ['ﾊﾞﾅﾅ', 178], ['ﾄﾘﾓﾓﾆｸ 2kg', 1290],
    ['ﾌﾞﾀﾊﾞﾗ', 498], ['ｷﾞｭｳﾆｭｳ', 218], ['ﾀﾏｺﾞ 10ｺ', 268], ['ｺｼﾋｶﾘ 5kg', 2480],
    ['ｼｮｳﾕ 1L', 198], ['ﾎﾟﾃﾄﾁｯﾌﾟｽ', 128], ['ﾋﾞｰﾙ 350ml', 228],
    ['ﾚｲﾄｳｷﾞｮｳｻﾞ', 288], ['ｼｬﾝﾌﾟｰ', 598], ['ｾﾝｻﾞｲ', 248], ['値引', -100],
  ];
  for (const [name, amount] of EXPECT) {
    const hit = r.items.find((i) => i.name === name);
    if (!hit || hit.amount_minor !== amount) {
      console.log(`  FAIL line   ${name} -> ${hit ? hit.amount_minor : 'missing'} (want ${amount})`);
      ok = false;
    }
  }
  if (r.items.length !== EXPECT.length) {
    console.log(`  FAIL count  ${r.items.length} items, expected ${EXPECT.length}`);
    for (const i of r.items) console.log(`         ${String(i.amount_minor).padStart(7)}  ${JSON.stringify(i.name)}`);
    ok = false;
  }
  if (r.merchant !== '業務スーパー' || r.purchased_on !== '2026-08-29' || r.total !== 7048) {
    console.log(`  FAIL header ${r.merchant} / ${r.purchased_on} / ${r.total}`);
    ok = false;
  }

  // --- 2. a convenience store, slashed date and a quantity line ----------
  const lawson = parseReceiptText([
    'ローソン 西早稲田店',
    '2026/08/27 07:14',
    'おにぎり 鮭 168',
    'ｶﾌｪﾗﾃ M 150',
    '2点 x 110',
    'ﾊﾞﾅﾅ 110',
    '小計 428',
    '内税 34',
    '合計 428',
    'ｸﾚｼﾞｯﾄ 428',
    'ポイント 4',
  ]);
  const names = lawson.items.map((i) => i.name);
  if (lawson.items.length !== 3) {
    console.log(`  FAIL lawson ${lawson.items.length} items, expected 3: ${JSON.stringify(names)}`);
    ok = false;
  }
  if (lawson.purchased_on !== '2026-08-27' || lawson.total !== 428) {
    console.log(`  FAIL lawson header ${lawson.purchased_on} / ${lawson.total}`);
    ok = false;
  }
  // The card line and the points line are not shopping.
  if (names.some((n) => /ｸﾚｼﾞｯﾄ|ポイント|小計|合計|内税/.test(n))) {
    console.log(`  FAIL lawson leaked a totals line: ${JSON.stringify(names)}`);
    ok = false;
  }

  console.log(ok ? 'PASS - receipt text parser' : 'FAIL - receipt text parser');
  return ok;
}
