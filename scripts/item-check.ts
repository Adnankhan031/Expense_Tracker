/**
 * Receipt line classification: normalisation and category matching.
 *
 * The left column of every case is what a Japanese register actually prints —
 * half-width katakana, cultivar names, no spaces — not tidied-up Japanese.
 */
import { foldJa } from '../src/jp';
import { classifyItem } from '../src/classify';
import { SEED_CATEGORIES } from '../src/seed';


/**
 * Names exactly as a model returned them from a photographed receipt.
 *
 * OCR loses the voicing marks first, so these are the degraded forms, not the
 * correct spellings: パナナ for バナナ, タマコ for タマゴ, センサイ for センザイ.
 * Recorded from a real 200 response so the dakuten layer cannot regress.
 */
const OCR: [string, string | null][] = [
  ['キャベツ', 'produce'],
  ['パナナ', 'produce'],            // handakuten where dakuten belongs
  ['トリモノク 2kg', 'meat'],
  ['フタタブラ', 'meat'],
  ['タマコ 10コ', 'dairy'],          // たまこ for たまご, plus a counter
  ['コシヒカリ 5kg', 'staples'],
  ['ポーテトチップス', 'snacks'],
  ['レイトウキョウウサ', 'frozen'],
  ['センサイ', 'household'],        // せんさい for せんざい — must not be a snack
  // One edit from both ギュウニュウ (milk) and ギュウニク (beef). Refusing is
  // the correct answer; guessing "meat" would corrupt the breakdown silently.
  ['キュウニウ', null],
];


/**
 * Lines from a real 葛西店 receipt, as the vision model returned them.
 *
 * These are the cases that exposed flavour words beating product words:
 * バナナカステラ is a castella, not a banana, and 果汁グミぶどう is a gummy,
 * not fruit. Both were filed as fresh produce until product forms were made
 * to outrank flavours.
 */
const REAL: [string, string | null][] = [
  ['514_バナナカステラ', 'snacks'],       // banana-flavoured cake, not fruit
  ['514_果汁グミぶどう', 'snacks'],       // grape gummy, not fruit
  ['14_果汁グミゴールドキウイ', 'snacks'], // kiwi gummy, not fruit
  ['514_雪の宿 サラダ', 'snacks'],        // rice cracker; サラダ is the flavour
  ['514_芋羊羹カステラ', 'snacks'],
  ['514_牛乳ケーキ', 'snacks'],
  ['520_7Pツイストーナツ', 'snacks'],     // OCR dropped the ド of ドーナツ
  ['12_ペプシ生さむらD600ML', 'drinks'],
  ['12_コカコーラ Zero 700ML', 'drinks'],
  ['514_QBわりきマメ', 'dairy'],          // QBB cheese, badly read
  ['514_チーズ豆ミックス', 'dairy'],
  ['514_丸大豆せんべい醤油', 'snacks'],
  ['514_丸大豆せん枝豆', 'snacks'],
  ['561_りんご', 'produce'],
  ['510_日清 あっさりCN', 'staples'],
  // 混ぜ込み is a rice-seasoning line, so condiments is right and the fish is
  // the flavour — the opposite of the castella case.
  ['510_混ぜ込み鯖', 'spices'],
];

const ctx = { categories: SEED_CATEGORIES.map((c) => ({ key: c.id, keywords: c.keywords.join('|') })) };

const FOLD: [string, string][] = [
  ['ﾄﾘﾓﾓ', 'とりもも'],
  ['ｷｬﾍﾞﾂ', 'きゃべつ'],
  ['ﾋﾞｰﾙ', 'びーる'],          // dakuten must voice, not vanish: beer, not heel
  ['ﾊﾟﾝ', 'ぱん'],
  ['ｷﾞｭｳﾆｭｳ', 'ぎゅうにゅう'],
  ['キャベツ', 'きゃべつ'],
  ['きゃべつ', 'きゃべつ'],
  ['２５０', '250'],
  ['ﾎﾟﾃﾄﾁｯﾌﾟｽ', 'ぽてとちっぷす'],
  ['ﾄﾞｰﾅﾂ', 'どーなつ'],
];

const SUB: [string, string][] = [
  ['ﾄﾘﾓﾓ', 'meat'], ['ﾌﾞﾀﾊﾞﾗ', 'meat'], ['ｷｬﾍﾞﾂ', 'produce'], ['ﾆﾝｼﾞﾝ', 'produce'],
  ['ｷﾞｭｳﾆｭｳ', 'dairy'], ['ﾀﾏｺﾞ', 'dairy'], ['ｺｼﾋｶﾘ 5kg', 'staples'], ['ｼｮｳﾕ', 'spices'],
  ['ﾎﾟﾃﾄﾁｯﾌﾟｽ', 'snacks'], ['ﾋﾞｰﾙ', 'drinks'], ['ﾚｲﾄｳｷﾞｮｳｻﾞ', 'frozen'],
  ['Basmati Rice 5kg', 'staples'], ['Toor Dal', 'staples'], ['Sambar Powder', 'spices'],
  ['Paneer 200g', 'dairy'], ['idli batter', 'staples'], ['ghee', 'dairy'],
  ['green chilli', 'produce'], ['chicken breast', 'meat'],
];

/** Non-food lines share the receipt and must reach a real category, not a subcategory. */
const TOP: [string, string][] = [
  ['ｼｬﾝﾌﾟｰ', 'toiletries'],
  ['せんざい', 'household'],       // one edit from せんべい (rice cracker) — must not fuzzy
  ['toothpaste', 'toiletries'],
];

export function runItemChecks(): { pass: number; total: number } {
let pass = 0, total = 0;
for (const [input, want] of FOLD) {
  total++; const got = foldJa(input);
  if (got === want) pass++; else console.log(`FAIL fold  ${input} -> ${got} (want ${want})`);
}
for (const [name, want] of SUB) {
  total++; const r = classifyItem(name, ctx);
  if (r.subKey === want) pass++;
  else console.log(`FAIL sub   ${name} -> ${r.subKey}/${r.categoryKey} (want ${want})`);
}
for (const [name, want] of OCR) {
  total++; const r = classifyItem(name, ctx);
  const got = r.subKey ?? r.categoryKey ?? null;
  if (got === want) pass++;
  else console.log(`FAIL ocr   ${name} -> ${got} (want ${want})`);
}
for (const [name, want] of REAL) {
  total++; const r = classifyItem(name, ctx);
  const got = r.subKey ?? r.categoryKey ?? null;
  if (got === want) pass++;
  else console.log(`FAIL real  ${name} -> ${got} (want ${want})`);
}
for (const [name, want] of TOP) {
  total++; const r = classifyItem(name, ctx);
  if (r.categoryKey === want && r.subKey === null) pass++;
  else console.log(`FAIL top   ${name} -> ${r.subKey}/${r.categoryKey} (want ${want})`);
}

  console.log(`
Item check: ${pass}/${total} passed`);
  return { pass, total };
}
