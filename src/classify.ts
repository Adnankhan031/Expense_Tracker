import { foldJa, hasJapanese } from './jp';
import { SUB_CATEGORIES, type SubCategory } from './items';

/**
 * Decide what a single receipt line actually is.
 *
 * Three layers, in the order the chat parser already uses:
 *
 *   1. learned  — a product name the user has corrected before. Instant, free,
 *                 offline, and the reason accuracy climbs with use.
 *   2. keyword  — the shipped dictionary, longest match first so "とりもも" beats
 *                 the bare "もも" that would otherwise call chicken thigh a peach.
 *   3. fuzzy    — one typo or a stray OCR character away from a known word.
 *
 * A line can also belong to a top-level category rather than a grocery
 * subcategory: shampoo on a Gyomu receipt is Toiletries, not food. Callers pass
 * their categories in and get back whichever axis matched.
 */

export type ItemCategory = {
  /** Grocery subcategory key, when the line is food shopping. */
  subKey: string | null;
  /** Top-level category key, when the line belongs somewhere else entirely. */
  categoryKey: string | null;
  confidence: number;
  matched: string | null;
};

export type ClassifyContext = {
  /** Top-level categories, so non-grocery lines can be routed. */
  categories: { key: string; keywords: string }[];
  /** Learned product name → subcategory or category, folded keys. */
  learned?: Map<string, { subKey?: string; categoryKey?: string }>;
  subCategories?: SubCategory[];
};

type Entry = { subKey: string | null; categoryKey: string | null; word: string };

let cache: { key: unknown; index: Entry[] } | null = null;

function buildIndex(ctx: ClassifyContext): Entry[] {
  const subs = ctx.subCategories ?? SUB_CATEGORIES;
  if (cache && cache.key === ctx.categories) return cache.index;

  const entries: Entry[] = [];

  for (const s of subs) {
    for (const k of s.keywords) {
      const word = foldJa(k);
      if (word) entries.push({ subKey: s.key, categoryKey: null, word });
    }
  }

  // Top-level categories come second so a grocery subcategory wins a tie —
  // "oil" is a condiment on a supermarket receipt, not a car expense.
  for (const c of ctx.categories) {
    for (const k of (c.keywords || '').split('|')) {
      const word = foldJa(k);
      if (word) entries.push({ subKey: null, categoryKey: c.key, word });
    }
  }

  // Longest first: a specific phrase must beat the generic word inside it.
  entries.sort((a, b) => b.word.length - a.word.length);
  cache = { key: ctx.categories, index: entries };
  return entries;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length || !b.length) return Math.max(a.length, b.length);
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(
        prev[j] + 1,
        row[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    prev = row;
  }
  return prev[b.length];
}

export function classifyItem(rawName: string, ctx: ClassifyContext): ItemCategory {
  const name = foldJa(rawName);
  if (!name) return { subKey: null, categoryKey: null, confidence: 0, matched: null };

  // 1. learned
  const learned = ctx.learned?.get(name);
  if (learned) {
    return {
      subKey: learned.subKey ?? null,
      categoryKey: learned.categoryKey ?? null,
      confidence: 0.98,
      matched: name,
    };
  }

  const index = buildIndex(ctx);

  // 2. keyword, longest match first
  for (const e of index) {
    if (name.includes(e.word)) {
      // A one-character match inside a longer name is coincidence, not a hit.
      if (e.word.length === 1 && name.length > 2) continue;
      return {
        subKey: e.subKey,
        categoryKey: e.categoryKey,
        confidence: e.word === name ? 0.95 : 0.86,
        matched: e.word,
      };
    }
  }

  /**
   * 3. fuzzy — for latin only.
   *
   * Kana is dense: せんざい (detergent) and せんべい (rice cracker) are one
   * substitution apart and mean entirely different things, so fuzzy matching
   * Japanese produced confident nonsense — detergent filed as a snack at 0.7.
   * Latin typos are the case this layer was built for ("grocries"), and those
   * come from the user typing, not from OCR. So: no fuzzy on Japanese.
   */
  if (hasJapanese(name)) return { subKey: null, categoryKey: null, confidence: 0, matched: null };

  const budget = name.length <= 6 ? 1 : 2;
  let best: { e: Entry; d: number } | null = null;
  for (const e of index) {
    if (Math.abs(e.word.length - name.length) > budget) continue;
    const d = levenshtein(name, e.word);
    if (d <= budget && (!best || d < best.d)) best = { e, d };
  }
  if (best) {
    return {
      subKey: best.e.subKey,
      categoryKey: best.e.categoryKey,
      confidence: best.d === 1 ? 0.7 : 0.6,
      matched: best.e.word,
    };
  }

  return { subKey: null, categoryKey: null, confidence: 0, matched: null };
}
