/**
 * When is a reading bad enough to be worth a language model?
 *
 * The rules parse a known layout exactly, so the model is a fallback, not a
 * second opinion. These cases draw the line: a normal receipt with tax must
 * never trigger it, and a layout that clearly defeated the parser must.
 */
import { looksWrong } from '../src/receiptText';

const receipt = (yens: number[], totalYen: number | null) => ({
  total: totalYen === null ? null : totalYen * 100,
  items: yens.map((y) => ({ amount_minor: y * 100 })),
});

const CASES: [string, boolean, ReturnType<typeof receipt>, number][] = [
  // Ordinary readings — the model must not be called.
  ['balanced', false, receipt([158, 128, 1290], 1576), 10],
  ['tax gap, as every Japanese receipt has', false, receipt([2000, 2000, 2806], 7048), 15],
  ['no printed total', false, receipt([158, 128, 300], null), 10],
  ['the real 20-item receipt', false, receipt(Array(20).fill(484), 9695), 40],

  // Readings that clearly failed — worth the model.
  ['two items off a forty-line receipt', true, receipt([158, 128], 9695), 40],
  ['sum nowhere near the total', true, receipt([158, 128, 200], 9695), 10],
  ['a single item', true, receipt([500], 9695), 20],
  ['almost nothing extracted', true, receipt([158, 128], null), 30],
];

export function runSanityChecks(): boolean {
  let ok = true;
  for (const [label, want, r, lines] of CASES) {
    const got = looksWrong(r, lines);
    if (got !== want) {
      console.log(`  FAIL sanity ${label}: got ${got}, want ${want}`);
      ok = false;
    }
  }
  console.log(ok ? 'PASS - reading sanity' : 'FAIL - reading sanity');
  return ok;
}
