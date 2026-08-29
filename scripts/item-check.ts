/**
 * Receipt line classification: normalisation and category matching.
 *
 * The left column of every case is what a Japanese register actually prints —
 * half-width katakana, cultivar names, no spaces — not tidied-up Japanese.
 */
import { foldJa } from '../src/jp';
import { classifyItem } from '../src/classify';
import { SEED_CATEGORIES } from '../src/seed';

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
for (const [name, want] of TOP) {
  total++; const r = classifyItem(name, ctx);
  if (r.categoryKey === want && r.subKey === null) pass++;
  else console.log(`FAIL top   ${name} -> ${r.subKey}/${r.categoryKey} (want ${want})`);
}

console.log(`\nItem check: ${pass}/${total} passed`);
if (pass !== total) process.exit(1);
console.log('All good.');
