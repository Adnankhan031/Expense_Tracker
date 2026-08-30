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
const PRICE_ONLY = /^[*¥￥\s]*[\d,.]+\s*[)）]?$/;
const NOT_A_PRODUCT = /担当者|領収|领収|毎日|簡単|ぜひ|レジ|TEL|電話/;

export function rowsFromBlocks(result: OcrResult): string[] {
  const lines = result.blocks.flatMap((b) => b.lines).filter((l) => l.text.trim().length > 0);
  const placed = lines.filter((l) => l.frame);
  // Without geometry there is nothing better than block order.
  if (placed.length < lines.length * 0.6) return lines.map((l) => l.text.trim());

  const centre = (l: OcrLine) => l.frame!.top + l.frame!.height / 2;
  const heights = placed.map((l) => l.frame!.height).sort((a, b) => a - b);
  const median = heights[Math.floor(heights.length / 2)] || 1;
  const rightEdge = Math.max(...placed.map((l) => l.frame!.left));

  const prices = placed
    .filter((l) => PRICE_ONLY.test(l.text.trim()) && l.frame!.left >= rightEdge * 0.6)
    .sort((a, b) => a.frame!.top - b.frame!.top);
  const priceSet = new Set(prices);
  const names = placed.filter((l) => !priceSet.has(l));

  // Group the left-hand column. 0.35 of a line height was measured on a real
  // receipt as the point where neighbouring rows stop merging.
  const rows: OcrLine[][] = [];
  for (const line of [...names].sort((a, b) => a.frame!.top - b.frame!.top)) {
    const row = rows[rows.length - 1];
    if (row && Math.abs(centre(line) - centre(row[0])) <= median * 0.35) row.push(line);
    else rows.push([line]);
  }
  const rowCentre = (row: OcrLine[]) => row.reduce((a, l) => a + centre(l), 0) / row.length;

  /**
   * A unit-price line — "(¥116 × 2個)" — and the header carry no price of their
   * own. Left eligible they absorb the amount belonging to the item below and
   * shift every pairing down the page by one, which was the single largest
   * source of wrong prices.
   */
  const eligible: number[] = [];
  rows.forEach((row, i) => {
    const text = row.map((l) => l.text).join(' ');
    if (/[×✕]/.test(text) || / x /i.test(text) || NOT_A_PRODUCT.test(text)) return;
    eligible.push(i);
  });
  const candidates = eligible.map((i) => rows[i]);

  /**
   * Align rows to prices in order, allowing either side to be skipped but
   * never reordered.
   *
   * A photographed receipt is skewed: the price column drifted from ten pixels
   * above its name at the top of the page to sixteen below it at the bottom,
   * so nearest-centre matching hands a price to the wrong row, and matching
   * greedily lets row N take price N+1 while row N+1 takes price N. Order is
   * the one thing the skew cannot disturb, so the alignment respects it.
   */
  const pairs = new Map<number, number>();
  if (candidates.length && prices.length) {
    const R = candidates.length;
    const P = prices.length;
    const skip = median * 0.9;
    const INF = Infinity;
    const cost: number[][] = Array.from({ length: R + 1 }, () => new Array(P + 1).fill(INF));
    const back: ([number, number, [number, number] | null] | null)[][] = Array.from(
      { length: R + 1 },
      () => new Array(P + 1).fill(null)
    );
    cost[0][0] = 0;

    for (let i = 0; i <= R; i++) {
      for (let j = 0; j <= P; j++) {
        const here = cost[i][j];
        if (here === INF) continue;
        if (i < R && here + skip < cost[i + 1][j]) {
          cost[i + 1][j] = here + skip;
          back[i + 1][j] = [i, j, null];
        }
        if (j < P && here + skip < cost[i][j + 1]) {
          cost[i][j + 1] = here + skip;
          back[i][j + 1] = [i, j, null];
        }
        if (i < R && j < P) {
          const d = Math.abs(rowCentre(candidates[i]) - centre(prices[j]));
          if (d <= median * 1.5 && here + d < cost[i + 1][j + 1]) {
            cost[i + 1][j + 1] = here + d;
            back[i + 1][j + 1] = [i, j, [i, j]];
          }
        }
      }
    }

    let i = R;
    let j = P;
    while ((i !== 0 || j !== 0) && back[i][j]) {
      const [pi, pj, m] = back[i][j]!;
      if (m) pairs.set(eligible[m[0]], m[1]);
      i = pi;
      j = pj;
    }
  }

  const taken = new Set(pairs.values());
  const built: { top: number; text: string }[] = [];
  rows.forEach((row, i) => {
    const cells = pairs.has(i) ? [...row, prices[pairs.get(i)!]] : row;
    cells.sort((a, b) => a.frame!.left - b.frame!.left);
    built.push({
      top: Math.min(...cells.map((l) => l.frame!.top)),
      text: cells.map((l) => l.text.trim()).join(' '),
    });
  });
  prices.forEach((p, j) => {
    if (!taken.has(j)) built.push({ top: p.frame!.top, text: p.text.trim() });
  });

  return built
    .sort((a, b) => a.top - b.top)
    .map((b) => healRow(b.text))
    .filter(Boolean);
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
