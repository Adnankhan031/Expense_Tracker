/**
 * A real receipt, as ML Kit read it off the paper.
 *
 * This is a 葛西店 shop, 44 items, ¥9,695. It is much harder than the receipt
 * I rendered myself, and it broke the parser in four ways at once:
 *
 *   - amounts are prefixed with * (the reduced-tax mark), so "*1,160" lost its
 *     thousands group and parsed as 160
 *   - unit prices sit on their own line, "(¥116 X 2個)", and were read as items
 *   - product codes ("510_") were kept as part of the name
 *   - the total is お買上計 here, not 合計
 *
 * Every amount is the printed yen value; the app stores minor units, so the
 * expectations below are what the user should end up seeing.
 */
import { parseReceiptText } from '../src/receiptText';

const LINES = [
  '葛西店',
  'TEL 03-5675-1011',
  '＼毎日のお買い物をラクラクに／',
  '簡単・便利なピピットスマホを',
  'ぜひご利用くださいませ！',
  '＜ 領収証 ＞',
  '2025年12月19日(金) 18:46 レジ:006',
  '担当者：精算機０－６',
  '510_日清 あっさりCN *232',
  '510_日清あっさりシーフート *1,160',
  '(¥116 X 2個)',
  '510_混ぜ込み鮭 *600',
  '(¥150 X 4個)',
  '511_ゴールデンカレー・甘口 *642',
  '512_ヘツツシボモト0600ML *105',
  '(¥321 X 2個)',
  '512_ココユーゼ0700ML *127',
  '514_丸大豆せんべい醤油 *181',
  '514_丸大豆せん枝豆 *181',
  '514_雪の宿 サラダ *905',
  '514_バナナカステラ *688',
  '(¥181 X 5個)',
  '514_果汁グミぶどう *149',
  '514_果汁グミゴールドキウイ *160',
  '514_QBBプロセスチーズ *355',
  '514_チーズ豆ミックス *354',
  '#514_チョコパイバニラティパック *408',
  '514_チョコパイ濃い抹茶 *614',
  '514_芋羊羹カステラ *1,194',
  '(¥398 X 3個)',
  '514_牛乳ケーキ *860',
  '(¥430 X 2個)',
  '520_7ツイストドーナツ *138',
  '561_りんご *642',
  '(¥214 X 3個)',
  '小計/ 44点 ¥9,695',
  'お買上計 ¥9,695',
  '内税率 8%対象額 ¥9,695',
  '(内消費税等 8%) (¥718)',
  '*印は軽減税率対象商品です',
];

/** Printed yen, in receipt order. */
const EXPECT_YEN = [
  232, 1160, 600, 642, 105, 127, 181, 181, 905, 688,
  149, 160, 355, 354, 408, 614, 1194, 860, 138, 642,
];

export function runRealReceiptChecks(): boolean {
  const r = parseReceiptText(LINES);
  let ok = true;

  const got = r.items.map((i) => i.amount_minor / 100);

  if (r.items.length !== EXPECT_YEN.length) {
    console.log(`  FAIL count ${r.items.length} items, expected ${EXPECT_YEN.length}`);
    for (const i of r.items) console.log(`        ${String(i.amount_minor / 100).padStart(8)}  ${JSON.stringify(i.name)}`);
    ok = false;
  }

  for (let i = 0; i < Math.min(got.length, EXPECT_YEN.length); i++) {
    if (got[i] !== EXPECT_YEN[i]) {
      console.log(`  FAIL amount #${i + 1} ${got[i]} (want ${EXPECT_YEN[i]}) from ${JSON.stringify(r.items[i].name)}`);
      ok = false;
    }
  }

  // A unit-price line is not a purchase.
  const unitLeak = r.items.filter((i) => /^\(?¥?\d+ ?[X×]/.test(i.name));
  for (const l of unitLeak) {
    console.log(`  FAIL unit price kept as an item: ${JSON.stringify(l.name)}`);
    ok = false;
  }

  // The totals block is not shopping either.
  const totalLeak = r.items.filter((i) => /小計|お買上|内税|消費税|領収/.test(i.name));
  for (const l of totalLeak) {
    console.log(`  FAIL totals line kept as an item: ${JSON.stringify(l.name)}`);
    ok = false;
  }

  // Product codes belong to the till, not to the product.
  const coded = r.items.filter((i) => /^#?\d{3}_/.test(i.name));
  for (const l of coded) {
    console.log(`  FAIL product code left on the name: ${JSON.stringify(l.name)}`);
    ok = false;
  }

  if (r.total !== 969500) {
    console.log(`  FAIL total ${r.total} (want 969500 = ¥9,695 in minor units)`);
    ok = false;
  }
  if (r.purchased_on !== '2025-12-19') {
    console.log(`  FAIL date ${r.purchased_on} (want 2025-12-19)`);
    ok = false;
  }

  const sum = r.items.reduce((a, i) => a + i.amount_minor, 0);
  console.log(`  real receipt: ${r.items.length} items, sum ¥${sum / 100}, printed ¥${(r.total ?? 0) / 100}`);
  console.log(ok ? 'PASS - real receipt' : 'FAIL - real receipt');
  return ok;
}
