/**
 * Two-column receipts, where ML Kit puts names and prices in separate blocks.
 *
 * This is the failure the user hit: reading blocks in order returned every
 * product name, then every price, so a ¥1,160 line arrived as the fragment
 * "*1," with its amount attached to nothing.
 */
import { rowsFromBlocks, type OcrResult } from '../src/receiptRows';

const line = (text: string, top: number, left: number) => ({
  text,
  frame: { top, left, width: text.length * 10, height: 20 },
});

const twoColumn: OcrResult = {
  blocks: [
    {
      lines: [
        line('510_日清 あっさりCN', 100, 20),
        line('510_日清あっさりシーフート', 130, 20),
        line('(¥116 X 2個)', 160, 40),
        line('510_混ぜ込み鮭', 190, 20),
      ],
    },
    {
      // A separate block, to the right, slightly off vertically as in a real photo.
      lines: [line('*232', 102, 300), line('*1,160', 131, 300), line('*600', 191, 300)],
    },
  ],
};

export function runRowChecks(): boolean {
  const rows = rowsFromBlocks(twoColumn);
  let ok = true;

  const want = [
    '510_日清 あっさりCN *232',
    '510_日清あっさりシーフート *1,160',
    '(¥116 X 2個)',
    '510_混ぜ込み鮭 *600',
  ];

  if (rows.length !== want.length) {
    console.log(`  FAIL ${rows.length} rows, expected ${want.length}`);
    for (const r of rows) console.log(`        ${JSON.stringify(r)}`);
    ok = false;
  }
  for (let i = 0; i < Math.min(rows.length, want.length); i++) {
    if (rows[i] !== want[i]) {
      console.log(`  FAIL row ${i + 1}: ${JSON.stringify(rows[i])}`);
      console.log(`             want ${JSON.stringify(want[i])}`);
      ok = false;
    }
  }

  // With no geometry at all, fall back to block order rather than losing text.
  const noFrames: OcrResult = { blocks: [{ lines: [{ text: 'a 1' }, { text: 'b 2' }] }] };
  if (rowsFromBlocks(noFrames).join('|') !== 'a 1|b 2') {
    console.log('  FAIL lines without frames were dropped');
    ok = false;
  }

  console.log(ok ? 'PASS - receipt rows' : 'FAIL - receipt rows');
  return ok;
}
