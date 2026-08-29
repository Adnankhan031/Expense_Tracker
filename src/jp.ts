/**
 * Japanese text normalisation for receipt lines.
 *
 * Register receipts print half-width katakana — `ﾄﾘﾓﾓ`, `ｷｬﾍﾞﾂ` — because the
 * printers are 8-bit. A dictionary written in ordinary Japanese matches none of
 * it, and neither do the words the user types. Everything is folded to one
 * canonical form before any comparison happens:
 *
 *   ﾄﾘﾓﾓ  →  とりもも
 *   トリモモ →  とりもも
 *   とりもも →  とりもも
 *
 * Hiragana is the target rather than katakana because the user types product
 * names either way and hiragana is the smaller of the two ranges.
 */

/** Half-width katakana in code order, and their full-width equivalents. */
const HALF = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜｦﾝ';
const FULL = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン';

const HALF_SMALL = 'ｧｨｩｪｫｬｭｮｯ';
const FULL_SMALL = 'ァィゥェォャュョッ';

/** Voiced forms. A half-width receipt writes these as base + ﾞ. */
const DAKUTEN: Record<string, string> = {
  カ: 'ガ', キ: 'ギ', ク: 'グ', ケ: 'ゲ', コ: 'ゴ',
  サ: 'ザ', シ: 'ジ', ス: 'ズ', セ: 'ゼ', ソ: 'ゾ',
  タ: 'ダ', チ: 'ヂ', ツ: 'ヅ', テ: 'デ', ト: 'ド',
  ハ: 'バ', ヒ: 'ビ', フ: 'ブ', ヘ: 'ベ', ホ: 'ボ',
  ウ: 'ヴ',
};

const HANDAKUTEN: Record<string, string> = {
  ハ: 'パ', ヒ: 'ピ', フ: 'プ', ヘ: 'ペ', ホ: 'ポ',
};

const PUNCT: Record<string, string> = {
  'ｰ': 'ー', '｡': '。', '｢': '「', '｣': '」', '､': '、', '･': '・', '　': ' ',
};

const HALF_MAP = new Map<string, string>();
for (let i = 0; i < HALF.length; i++) HALF_MAP.set(HALF[i], FULL[i]);
for (let i = 0; i < HALF_SMALL.length; i++) HALF_MAP.set(HALF_SMALL[i], FULL_SMALL[i]);

/**
 * Half-width katakana to full-width, combining the trailing voicing marks.
 *
 * The marks are separate characters on the wire (ﾋ + ﾞ), so the previous
 * character has to be rewritten rather than the mark simply dropped — dropping
 * it turns ビール (beer) into ヒール (heel).
 */
export function widenKatakana(input: string): string {
  let out = '';
  for (const ch of input) {
    if (ch === 'ﾞ' || ch === 'ﾞ') {
      const prev = out.slice(-1);
      const voiced = DAKUTEN[prev];
      if (voiced) {
        out = out.slice(0, -1) + voiced;
        continue;
      }
    }
    if (ch === 'ﾟ' || ch === 'ﾟ') {
      const prev = out.slice(-1);
      const voiced = HANDAKUTEN[prev];
      if (voiced) {
        out = out.slice(0, -1) + voiced;
        continue;
      }
    }
    out += HALF_MAP.get(ch) ?? PUNCT[ch] ?? ch;
  }
  return out;
}

/** Katakana to hiragana. Leaves ー, kanji and latin alone. */
export function toHiragana(input: string): string {
  let out = '';
  for (const ch of input) {
    const code = ch.codePointAt(0)!;
    // Full-width katakana block, excluding ヷ-ヿ which have no hiragana form.
    if (code >= 0x30a1 && code <= 0x30f6) out += String.fromCodePoint(code - 0x60);
    else out += ch;
  }
  return out;
}

/** Full-width digits and latin to ASCII, so ２５０ compares as 250. */
export function narrowAscii(input: string): string {
  return input.replace(/[！-～]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0)
  );
}

/**
 * The single form everything is compared in.
 *
 * Receipt text, dictionary entries and anything the user types all pass through
 * here, so a match does not depend on which script it happened to arrive in.
 */
export function foldJa(input: string): string {
  return toHiragana(widenKatakana(narrowAscii(input ?? '')))
    .toLowerCase()
    .replace(/[\s　]+/g, ' ')
    .trim();
}

/** True when the string carries Japanese script, so callers can skip the fold. */
export function hasJapanese(input: string): boolean {
  return /[぀-ヿ㐀-鿿ｦ-ﾟ]/.test(input ?? '');
}

/**
 * Voiced kana reduced to their base form: が→か, ば→は, ぱ→は.
 *
 * OCR loses dakuten and handakuten before it loses anything else — the marks
 * are two or three pixels on thermal paper. A real reading came back with
 * パナナ for バナナ, タマコ for タマゴ and センサイ for センザイ, all of which
 * matched nothing. Comparing stripped forms recovers them.
 *
 * This is safe only because no two entries in the shipped dictionary collide
 * once stripped; `classify` re-checks that at build time rather than trusting
 * it, so a future keyword cannot quietly introduce a wrong match.
 */
const UNVOICED: Record<string, string> = {
  が: 'か', ぎ: 'き', ぐ: 'く', げ: 'け', ご: 'こ',
  ざ: 'さ', じ: 'し', ず: 'す', ぜ: 'せ', ぞ: 'そ',
  だ: 'た', ぢ: 'ち', づ: 'つ', で: 'て', ど: 'と',
  ば: 'は', び: 'ひ', ぶ: 'ふ', べ: 'へ', ぼ: 'ほ',
  ぱ: 'は', ぴ: 'ひ', ぷ: 'ふ', ぺ: 'へ', ぽ: 'ほ',
  ゔ: 'う',
};

export function stripDakuten(input: string): string {
  let out = '';
  for (const ch of input) out += UNVOICED[ch] ?? ch;
  return out;
}
