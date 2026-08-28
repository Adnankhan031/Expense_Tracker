/**
 * Parser regression check. Run with:  npm run check:parser
 *
 * These are real strings people type. If a change to the parser breaks one of
 * them, that is a bug — fix the parser, don't loosen the expectation.
 */
import type { Category } from '../src/db';
import { SEED_CATEGORIES } from '../src/seed';
import { parseInput } from '../src/parser';
import { addDays, monthKey, pad2, todayLocal } from '../src/format';

const categories: Category[] = SEED_CATEGORIES.map((c, i) => ({
  // ids are uuids in the app; the slug lives on `key`. The corpus asserts on the
  // slug, so id and key are both the slug here.
  id: c.id,
  key: c.id,
  name: c.name,
  icon: c.icon,
  color: c.color,
  kind: c.kind,
  keywords: c.keywords.join('|'),
  sort: i,
  archived: 0,
}));

const today = todayLocal();
const ctx = { categories, aliases: new Map<string, string>(), defaultDate: today, today };

type Expect = { cat?: string; amount?: number; date?: string; type?: string; method?: string; count?: number };

const cases: [string, Expect][] = [
  ['food 300', { cat: 'food', amount: 30000, date: today }],
  ['300 food', { cat: 'food', amount: 30000 }],
  ['groceries 2400 and auto 80', { count: 2, cat: 'groceries', amount: 240000 }],
  ['zomato 480 yest upi', { cat: 'food', amount: 48000, date: addDays(today, -1), method: 'UPI' }],
  ['petrol 1500', { cat: 'fuel', amount: 150000 }],
  ['chai 20 x3', { cat: 'food', amount: 6000 }],
  ['salary 45000 received', { cat: 'salary', amount: 4500000, type: 'income' }],
  ['medicines 640 3 days ago', { cat: 'health', amount: 64000, date: addDays(today, -3) }],
  ['uber 240 card', { cat: 'transport', amount: 24000, method: 'Card' }],
  ['netflix 199', { cat: 'subscriptions', amount: 19900 }],
  ['flight tickets 8.5k', { cat: 'travel', amount: 850000 }],
  ['rent 12000', { cat: 'rent', amount: 1200000 }],
  ['electricity bill 2340', { cat: 'bills', amount: 234000 }],
  ['haircut 250 cash', { cat: 'personal', amount: 25000, method: 'Cash' }],
  ['emergency repair 4500', { cat: 'unexpected', amount: 450000 }],
  ['sip 5000', { cat: 'investments', amount: 500000 }],
  ['movie 900', { cat: 'entertainment', amount: 90000 }],
  ['rs 1,250 shopping', { cat: 'shopping', amount: 125000 }],
  ['₹75 tea', { cat: 'food', amount: 7500 }],
  ['1.2l car down payment', { amount: 12000000 }],
  ['grocries 800', { cat: 'groceries', amount: 80000 }], // typo → fuzzy
  ['day before yesterday lunch 220', { cat: 'food', amount: 22000, date: addDays(today, -2) }],
  ['refund 1200', { cat: 'refund', amount: 120000, type: 'income' }],
  ['gym 1500 gpay', { cat: 'fitness', amount: 150000, method: 'UPI' }],
  ['school fees 25000', { cat: 'education', amount: 2500000 }],
  // a scale suffix must be a whole word: the "l" in lawson is not lakh
  ['juice 135 lawson', { cat: 'food', amount: 13500 }],
  ['face wash 2644 matsumoto kyoushi', { cat: 'toiletries', amount: 264400 }],
  ['curd 135', { cat: 'groceries', amount: 13500 }],
  ['loan to a friend 5000', { cat: 'lending', amount: 500000 }],
  ['151000 sent to parents', { cat: 'parents', amount: 15100000 }],
  ['2 lakh deposit', { cat: 'rent', amount: 20000000 }],
];

let pass = 0;
const failures: string[] = [];

for (const [input, want] of cases) {
  const res = parseInput(input, ctx);
  if (res.kind !== 'entries') {
    failures.push(`"${input}" → parsed as ${res.kind}, expected entries`);
    continue;
  }
  const e = res.entries[0];
  const problems: string[] = [];
  if (want.count !== undefined && res.entries.length !== want.count)
    problems.push(`count=${res.entries.length} want ${want.count}`);
  if (want.amount !== undefined && e.amountMinor !== want.amount)
    problems.push(`amount=${e.amountMinor} want ${want.amount}`);
  if (want.cat !== undefined && e.categoryId !== want.cat) problems.push(`cat=${e.categoryId} want ${want.cat}`);
  if (want.date !== undefined && e.date !== want.date) problems.push(`date=${e.date} want ${want.date}`);
  if (want.type !== undefined && e.type !== want.type) problems.push(`type=${e.type} want ${want.type}`);
  if (want.method !== undefined && e.method !== want.method) problems.push(`method=${e.method} want ${want.method}`);

  if (problems.length) failures.push(`"${input}" → ${problems.join(', ')}`);
  else pass++;
}

// dates that depend on the current month
const day5 = (() => {
  const t = todayLocal();
  const candidate = `${monthKey(t)}-05`;
  return candidate > t ? `${monthKey(addDays(`${monthKey(t)}-01`, -1))}-05` : candidate;
})();
const dateCases: [string, string][] = [
  ['petrol 1500 on 5th', day5],
  ['groceries 900 on 5', day5],
  ['rent 12000 5/8', `${new Date().getFullYear()}-08-05`],
];
for (const [input, wantDate] of dateCases) {
  const res = parseInput(input, ctx);
  const got = res.kind === 'entries' ? res.entries[0].date : 'n/a';
  if (got === wantDate) pass++;
  else failures.push(`"${input}" → date=${got} want ${wantDate}`);
}

// questions must not be logged as expenses
const questions = ['how much on food this month?', 'how many times did i order food', 'average per day last month'];
for (const q of questions) {
  const res = parseInput(q, ctx);
  if (res.kind === 'query') pass++;
  else failures.push(`"${q}" → parsed as ${res.kind}, expected query`);
}

const total = cases.length + dateCases.length + questions.length;
console.log(`\nParser check: ${pass}/${total} passed`);
if (failures.length) {
  console.log('\nFailures:');
  for (const f of failures) console.log('  ✗ ' + f);
  process.exit(1);
}
console.log('All good.\n');
void pad2;
