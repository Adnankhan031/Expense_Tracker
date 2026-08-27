/**
 * Guards the copy of the parser in src/lib against drift from the native app's
 * src/parser.ts. Run with: npm run check:parser
 */
import type { Category } from '../src/lib/types';
import { SEED_CATEGORIES } from '../src/lib/seed';
import { parseInput } from '../src/lib/parser';
import { addDays, monthKey, todayLocal } from '../src/lib/format';

// Web category ids are uuids, so give each seed a fake one and keep `key` as the slug.
const categories: Category[] = SEED_CATEGORIES.map((c, i) => ({
  id: `uuid-${c.id}`,
  user_id: 'u',
  key: c.id,
  name: c.name,
  icon: c.icon,
  color: c.color,
  kind: c.kind,
  keywords: c.keywords.join('|'),
  sort: i,
  archived: false,
}));

const today = todayLocal();
const ctx = { categories, aliases: new Map<string, string>(), defaultDate: today, today };

type Expect = { cat?: string; amount?: number; date?: string; type?: string; method?: string; count?: number };

const cases: [string, Expect][] = [
  ['food 300', { cat: 'food', amount: 30000, date: today }],
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
  ['emergency repair 4500', { cat: 'unexpected', amount: 450000 }],
  ['rs 1,250 shopping', { cat: 'shopping', amount: 125000 }],
  ['grocries 800', { cat: 'groceries', amount: 80000 }],
  ['refund 1200', { cat: 'refund', amount: 120000, type: 'income' }],
  ['school fees 25000', { cat: 'education', amount: 2500000 }],
  ['day before yesterday lunch 220', { cat: 'food', amount: 22000, date: addDays(today, -2) }],
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
  if (want.cat !== undefined && e.categoryId !== `uuid-${want.cat}`)
    problems.push(`cat=${e.categoryId} want uuid-${want.cat}`);
  if (want.date !== undefined && e.date !== want.date) problems.push(`date=${e.date} want ${want.date}`);
  if (want.type !== undefined && e.type !== want.type) problems.push(`type=${e.type} want ${want.type}`);
  if (want.method !== undefined && e.method !== want.method) problems.push(`method=${e.method} want ${want.method}`);
  if (problems.length) failures.push(`"${input}" → ${problems.join(', ')}`);
  else pass++;
}

// a bare day-of-month must never land in the future
const day5 = (() => {
  const candidate = `${monthKey(today)}-05`;
  return candidate > today ? `${monthKey(addDays(`${monthKey(today)}-01`, -1))}-05` : candidate;
})();
for (const input of ['petrol 1500 on 5th', 'groceries 900 on 5']) {
  const res = parseInput(input, ctx);
  const got = res.kind === 'entries' ? res.entries[0].date : 'n/a';
  if (got === day5) pass++;
  else failures.push(`"${input}" → date=${got} want ${day5}`);
}

// questions must be answered, never logged
for (const q of ['how much on food this month?', 'how many times did i order food', 'average per day last month']) {
  const res = parseInput(q, ctx);
  if (res.kind === 'query') pass++;
  else failures.push(`"${q}" → parsed as ${res.kind}, expected query`);
}

const total = cases.length + 2 + 3;
console.log(`\nWeb parser check: ${pass}/${total} passed`);
if (failures.length) {
  console.log('\nFailures:');
  for (const f of failures) console.log('  ✗ ' + f);
  process.exit(1);
}
console.log('All good.\n');
