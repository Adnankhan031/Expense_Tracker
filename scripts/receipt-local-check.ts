/**
 * The rows PaddleOCR actually produced from a real receipt photo.
 *
 * Captured from the local service once the row alignment was fixed, so this
 * pins the whole local path at once: two-column pairing across a skewed photo,
 * till-code stripping, unit-price lines, and the totals block.
 *
 * The names are exactly as OCR read them — コールデンルー for ゴールデンカレー,
 * りんこ for りんご, ヘフシ for ペプシ — because that is what the classifier
 * actually has to cope with. Tidying them here would test nothing.
 *
 * Embedded rather than read from disk: this repo has no @types/node, and
 * adding it would change package.json, which is an input to the runtime
 * fingerprint and would strand every installed app.
 */
import { parseReceiptText } from '../src/receiptText';
import { classifyItem } from '../src/classify';
import { SEED_CATEGORIES } from '../src/seed';

const ROWS: string[] = [
  "毎日のお買い物をラクラクに",
  "簡単・便利なビビットスマホを",
  "ぜひご利用くださいませ！",
  "领収证>",
  "担当者：精算機0-6",
  "510_日清 あっさりCN *232",
  "(¥116 × 2個)",
  "(¥116 × 10個)",
  "510_混ぜ込み鮭 *600",
  "(¥150 × 4個)",
  "511コールデンルー甘ロ *642",
  "(¥321 ×2個)",
  "512_ヘフシ生セロ600ML *105",
  "512_カ-ラtロ700ML *127",
  "514_丸大豆せんべい醤油 *181",
  "514_丸大豆せん枝豆 *181",
  "514_雪の宿サラダ *905",
  "(¥181 × 5個)",
  "514_バナナカステラ *688",
  "(¥344 × 2個)",
  "514_果汁グミぶどう *149",
  "514_果汁クミコールトキウイ *160",
  "514_QBBワサヒマメ *355",
  "514_チース豆ミックス *354",
  "#514_コチヨコハイハーデイハック *408",
  "514_チョコパイ濃い抹茶 *614",
  "514_芋羊羹カステラ *1,194",
  "(¥398 × 3個)",
  "514_牛乳ケーキ *860",
  "(¥430 × 2個)",
  "520_7Pツイストトーナツ *138",
  "561_りんこ *642",
  "(¥214 × 3個)",
  "小計/44点",
  "お買上計 ¥9,695",
  "内税率8%対象额 ¥9.695",
  "(内消費税等8% ¥9.695",
  "*印は軽減税率対象商品 ¥718)",
];

export function runLocalOcrChecks(): boolean {
  const r = parseReceiptText(ROWS);
  const ctx = { categories: SEED_CATEGORIES.map((c) => ({ key: c.id, keywords: c.keywords.join('|') })) };

  let ok = true;
  const sum = r.items.reduce((a, i) => a + i.amount_minor, 0);
  const sorted = r.items.filter((i) => {
    const h = classifyItem(i.name, ctx);
    return h.subKey ?? h.categoryKey;
  }).length;

  if (r.items.length !== 19) {
    console.log(`  FAIL local: ${r.items.length} items, expected 19`);
    ok = false;
  }
  if (r.total !== 969500) {
    console.log(`  FAIL local: total ${r.total}, expected 969500`);
    ok = false;
  }
  // The one missing price is a genuine OCR miss rather than a pairing error —
  // the ¥1,160 noodles were never detected at all. Reconciliation has to
  // surface that as an unexplained gap instead of hiding it.
  if (Math.abs((r.total ?? 0) - sum - 116000) > 100) {
    console.log(`  FAIL local: gap ${(r.total ?? 0) - sum}, expected 116000`);
    ok = false;
  }
  if (sorted < 18) {
    console.log(`  FAIL local: ${sorted}/19 categorised, expected at least 18`);
    ok = false;
  }
  for (const c of r.items.filter((i) => /^[#_]|^\d{3}/.test(i.name))) {
    console.log(`  FAIL local: till code left on ${JSON.stringify(c.name)}`);
    ok = false;
  }

  console.log(ok ? 'PASS - local OCR path' : 'FAIL - local OCR path');
  return ok;
}
