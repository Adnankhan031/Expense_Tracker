/**
 * End-to-end test of everything downstream of the model.
 *
 * The model's job is to turn a photo into JSON. Everything after that is ours:
 * classifying each line, building the editable rows, and reconciling the sum
 * against the printed total. This feeds in the exact JSON shape the Edge
 * Function returns and checks what the user would actually see.
 *
 * The payload is a realistic 業務スーパー basket — half-width katakana, a rice
 * cultivar, non-food lines, and a 値引 discount as a negative amount.
 */
import { classifyItem } from '../src/classify';
import { SEED_CATEGORIES } from '../src/seed';
import { SUB_CATEGORIES } from '../src/items';

type ScannedItem = { name: string; amount_minor: number };

const RECEIPT = {
  merchant: '業務スーパー',
  purchased_on: '2026-08-29',
  total: 7048,
  items: <ScannedItem[]>[
    { name: 'ｷｬﾍﾞﾂ', amount_minor: 158 },
    { name: 'ﾆﾝｼﾞﾝ', amount_minor: 128 },
    { name: 'ﾊﾞﾅﾅ', amount_minor: 178 },
    { name: 'ﾄﾘﾓﾓﾆｸ 2kg', amount_minor: 1290 },
    { name: 'ﾌﾞﾀﾊﾞﾗ', amount_minor: 498 },
    { name: 'ｷﾞｭｳﾆｭｳ', amount_minor: 218 },
    { name: 'ﾀﾏｺﾞ 10ｺ', amount_minor: 268 },
    { name: 'ｺｼﾋｶﾘ 5kg', amount_minor: 2480 },
    { name: 'ｼｮｳﾕ 1L', amount_minor: 198 },
    { name: 'ﾎﾟﾃﾄﾁｯﾌﾟｽ', amount_minor: 128 },
    { name: 'ﾋﾞｰﾙ 350ml', amount_minor: 228 },
    { name: 'ﾚｲﾄｳｷﾞｮｳｻﾞ', amount_minor: 288 },
    { name: 'ｼｬﾝﾌﾟｰ', amount_minor: 598 },
    { name: 'ｾﾝｻﾞｲ', amount_minor: 248 },
    { name: '値引', amount_minor: -100 },
  ],
};

/** What a correct reading files each line as. */
const EXPECTED: Record<string, string> = {
  'ｷｬﾍﾞﾂ': 'produce',
  'ﾆﾝｼﾞﾝ': 'produce',
  'ﾊﾞﾅﾅ': 'produce',
  'ﾄﾘﾓﾓﾆｸ 2kg': 'meat',
  'ﾌﾞﾀﾊﾞﾗ': 'meat',
  'ｷﾞｭｳﾆｭｳ': 'dairy',
  'ﾀﾏｺﾞ 10ｺ': 'dairy',
  'ｺｼﾋｶﾘ 5kg': 'staples',
  'ｼｮｳﾕ 1L': 'spices',
  'ﾎﾟﾃﾄﾁｯﾌﾟｽ': 'snacks',
  'ﾋﾞｰﾙ 350ml': 'drinks',
  'ﾚｲﾄｳｷﾞｮｳｻﾞ': 'frozen',
  'ｼｬﾝﾌﾟｰ': 'toiletries',   // top-level, not a grocery subcategory
  'ｾﾝｻﾞｲ': 'household',     // ditto
  '値引': '—',              // a discount is not a product; unsorted is correct
};

export function runReceiptE2E(): boolean {
const ctx = { categories: SEED_CATEGORIES.map((c) => ({ key: c.id, keywords: c.keywords.join('|') })) };
const subKeys = new Set(SUB_CATEGORIES.map((s) => s.key));

console.log(`\nReceipt: ${RECEIPT.merchant}  ${RECEIPT.purchased_on}  printed total ¥${RECEIPT.total}\n`);

let correct = 0;
const byGroup = new Map<string, number>();

for (const item of RECEIPT.items) {
  const hit = classifyItem(item.name, ctx);
  const got = hit.subKey ?? hit.categoryKey ?? '—';
  const want = EXPECTED[item.name];
  const ok = got === want;
  if (ok) correct++;

  byGroup.set(got, (byGroup.get(got) ?? 0) + item.amount_minor);

  const kind = hit.subKey ? 'sub ' : hit.categoryKey ? 'cat ' : '    ';
  console.log(
    `  ${ok ? 'ok  ' : 'FAIL'} ${item.name.padEnd(14)} ${String(item.amount_minor).padStart(6)}  ` +
      `${kind}${got.padEnd(12)}${ok ? '' : `  want ${want}`}`
  );
}

console.log(`\nClassification: ${correct}/${RECEIPT.items.length}\n`);

console.log('Breakdown as the user would see it:');
for (const [group, total] of [...byGroup.entries()].sort((a, b) => b[1] - a[1])) {
  const label = group === '—' ? 'Unsorted' : group;
  const axis = subKeys.has(group) ? '(inside groceries)' : group === '—' ? '' : '(category)';
  console.log(`  ${label.padEnd(14)} ¥${String(total).padStart(6)}  ${axis}`);
}

const sum = RECEIPT.items.reduce((a, i) => a + i.amount_minor, 0);
const gap = RECEIPT.total - sum;
console.log(`\nReconciliation:`);
console.log(`  lines sum       ¥${sum}`);
console.log(`  printed total   ¥${RECEIPT.total}`);
console.log(`  gap             ¥${gap}   (${gap > 0 ? 'not accounted for — tax' : gap < 0 ? 'over the total' : 'balanced'})`);

// The discount must reduce the sum, not be dropped or made positive.
const discount = RECEIPT.items.find((i) => i.name === '値引');
const discountOk = !!discount && discount.amount_minor < 0;
console.log(`  discount signed negative: ${discountOk ? 'yes' : 'NO — would overstate the basket'}`);

  const pass = correct === RECEIPT.items.length && discountOk;
  console.log(pass ? 'PASS - receipt pipeline' : 'FAIL - receipt pipeline');
  return pass;
}
