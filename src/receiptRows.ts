/**
 * Reassemble a receipt's rows from OCR geometry.
 *
 * Kept free of native imports so it can be tested in plain Node — the bug it
 * exists to fix is invisible without a real two-column layout to try it on.
 */

export type OcrFrame = { top: number; left: number; width: number; height: number };
export type OcrLine = { text: string; frame?: OcrFrame };
export type OcrResult = { blocks: { lines: OcrLine[] }[] };

/**
 * Rebuild the receipt's rows from where the text physically sits.
 *
 * ML Kit groups text into blocks, and on a two-column receipt the product names
 * and the prices are frequently different blocks. Reading blocks in order
 * therefore returns every name, then every price — which is how a ¥1,160 line
 * arrived as the fragment "*1," with its amount somewhere else entirely.
 *
 * Every line carries a bounding box, so the rows can be reassembled: group by
 * vertical overlap, then order left to right within each row. That is the
 * layout the paper actually has.
 */
export function rowsFromBlocks(result: OcrResult): string[] {
  const lines = result.blocks
    .flatMap((b) => b.lines)
    .filter((l) => l.text.trim().length > 0);

  const placed = lines.filter((l) => l.frame);
  // Without geometry there is nothing better than block order.
  if (placed.length < lines.length * 0.6) return lines.map((l) => l.text.trim());

  const heights = placed.map((l) => l.frame!.height).sort((a, b) => a - b);
  const medianHeight = heights[Math.floor(heights.length / 2)] || 1;
  // Half a line's height: tall enough to survive a slightly skewed photo,
  // tight enough that two printed rows never merge into one.
  const tolerance = medianHeight * 0.5;

  const sorted = [...placed].sort((a, b) => a.frame!.top - b.frame!.top);
  const rows: (typeof sorted)[] = [];

  for (const line of sorted) {
    const centre = line.frame!.top + line.frame!.height / 2;
    const row = rows[rows.length - 1];
    const rowCentre = row
      ? row.reduce((a, l) => a + l.frame!.top + l.frame!.height / 2, 0) / row.length
      : null;

    if (row && rowCentre !== null && Math.abs(centre - rowCentre) <= tolerance) row.push(line);
    else rows.push([line]);
  }

  return rows.map((row) =>
    healRow(
      row
        .sort((a, b) => a.frame!.left - b.frame!.left)
        .map((l) => l.text.trim())
        .join(' ')
    )
  );
}

/**
 * Repair numbers that OCR split at the thousands separator.
 *
 * ML Kit frequently returns "1," and "160" as two tokens, and joining a row
 * puts a space between them. "*1, 160" then matches only the trailing 160, so
 * a ¥1,160 item was recorded as ¥160 and a ¥9,695 total as ¥695 — an error
 * that shrinks the number by an order of magnitude and looks entirely
 * plausible on screen.
 *
 * Only a group of exactly three digits after a comma is closed up, which is
 * what a thousands separator is; "2個, 300" is left alone.
 */
export function healRow(text: string): string {
  return text
    .replace(/(\d),\s+(?=\d{3}(?!\d))/g, '$1,')
    .replace(/([¥￥])\s+(?=\d)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}
