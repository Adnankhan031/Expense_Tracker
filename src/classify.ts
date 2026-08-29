import { foldJa, hasJapanese, stripDakuten } from './jp';
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

type Entry = {
  subKey: string | null;
  categoryKey: string | null;
  word: string;
  /** Names what the product is, so it outranks any flavour word. */
  strong: boolean;
};

let cache: { key: unknown; index: Entry[]; bare: Map<string, Entry> } | null = null;

/**
 * Index of Japanese entries keyed by their dakuten-stripped form.
 *
 * Anything that collides once stripped is dropped rather than guessed at, so
 * adding a keyword can never turn this layer into a source of wrong answers.
 */
function buildBareIndex(index: Entry[]): Map<string, Entry> {
  const seen = new Map<string, Entry | null>();
  for (const e of index) {
    if (!hasJapanese(e.word)) continue;
    const bare = stripDakuten(e.word);
    if (!seen.has(bare)) {
      seen.set(bare, e);
      continue;
    }
    const first = seen.get(bare);
    const sameTarget = first && first.subKey === e.subKey && first.categoryKey === e.categoryKey;
    if (!sameTarget) seen.set(bare, null); // ambiguous — refuse to guess
  }

  const out = new Map<string, Entry>();
  for (const [bare, e] of seen) if (e) out.set(bare, e);
  return out;
}

function buildIndex(ctx: ClassifyContext): Entry[] {
  const subs = ctx.subCategories ?? SUB_CATEGORIES;
  if (cache && cache.key === ctx.categories) return cache.index;

  const entries: Entry[] = [];

  for (const s of subs) {
    for (const k of s.strong ?? []) {
      const word = foldJa(k);
      if (word) entries.push({ subKey: s.key, categoryKey: null, word, strong: true });
    }
    for (const k of s.keywords) {
      const word = foldJa(k);
      if (word) entries.push({ subKey: s.key, categoryKey: null, word, strong: false });
    }
  }

  // Top-level categories come second so a grocery subcategory wins a tie —
  // "oil" is a condiment on a supermarket receipt, not a car expense.
  for (const c of ctx.categories) {
    for (const k of (c.keywords || '').split('|')) {
      const word = foldJa(k);
      if (word) entries.push({ subKey: null, categoryKey: c.key, word, strong: false });
    }
  }

  /**
   * Strong words first, then longest.
   *
   * バナナカステラ is a castella flavoured with banana, and 果汁グミぶどう is a
   * gummy flavoured with grape. Sorting on length alone made the flavour win,
   * so banana cake was filed as fresh fruit. A word that names the product's
   * form is checked before any flavour, however long the flavour is.
   */
  entries.sort((a, b) => (a.strong === b.strong ? b.word.length - a.word.length : a.strong ? -1 : 1));
  cache = { key: ctx.categories, index: entries, bare: buildBareIndex(entries) };
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
   * 3. dakuten-blind, for Japanese.
   *
   * OCR drops the voicing marks first — a real reading returned パナナ for
   * バナナ and センサイ for センザイ. Comparing stripped forms recovers those
   * without the licence that general edit distance would give: only the marks
   * are ignored, every other character must still match exactly.
   */
  if (hasJapanese(name)) {
    const bareIndex = cache?.bare;
    const bare = stripDakuten(name);
    const hit = bareIndex?.get(bare);
    if (hit) return { subKey: hit.subKey, categoryKey: hit.categoryKey, confidence: 0.8, matched: hit.word };

    if (bareIndex) {
      /**
       * One missing kana, whole word.
       *
       * ギュウニュウ came back as キュウニウ — the marks gone and one small ゅ
       * lost. Distance 1 on the stripped form recovers it. This stays safe
       * where general fuzzy did not: せんざい and せんべい are still distance 2
       * apart once stripped, so detergent cannot become a rice cracker.
       */
      let near: Entry | null = null;
      let ambiguous = false;
      if (bare.length >= 4) {
        for (const [key, e] of bareIndex) {
          if (Math.abs(key.length - bare.length) > 1 || key.length < 4) continue;
          if (levenshtein(bare, key) > 1) continue;
          if (near && (near.subKey !== e.subKey || near.categoryKey !== e.categoryKey)) ambiguous = true;
          if (!near) near = e;
        }
      }
      if (near && !ambiguous) {
        return { subKey: near.subKey, categoryKey: near.categoryKey, confidence: 0.78, matched: near.word };
      }
      /**
       * Two different answers a single edit away means we genuinely cannot
       * tell — キュウニウ sits one character from both ギュウニュウ (milk) and
       * ギュウニク (beef). Stop here rather than falling through to the looser
       * prefix layer, which would answer "meat" with false confidence. An
       * uncategorised row asks for one tap; a wrong one is never noticed.
       */
      if (ambiguous) return { subKey: null, categoryKey: null, confidence: 0, matched: null };

      /**
       * A product-form word, with its voicing marks gone.
       *
       * OCR returned ツイストーナツ for ツイストドーナツ — the ド lost its
       * dakuten and then its consonant. Stripped, どーなつ becomes とーなつ,
       * which the garbled name still contains. Only strong words are searched
       * this way: they name what a thing is, so finding one anywhere in the
       * name is meaningful, where finding a flavour word would not be.
       */
      let inner: Entry | null = null;
      for (const [key, e] of bareIndex) {
        if (!e.strong || key.length < 3 || !bare.includes(key)) continue;
        if (!inner || key.length > stripDakuten(inner.word).length) inner = e;
      }
      if (inner) {
        return { subKey: inner.subKey, categoryKey: inner.categoryKey, confidence: 0.75, matched: inner.word };
      }

      /**
       * Last resort: the name starts with a known word.
       *
       * Catches "タマコ 10コ" and "ﾌﾞﾀﾊﾞﾗ" once the size is tacked on. Anchored
       * to the start deliberately — an unanchored search matched ぎゅう inside
       * キュウニウ and filed milk as meat.
       */
      let prefix: Entry | null = null;
      for (const [key, e] of bareIndex) {
        if (key.length < 2 || !bare.startsWith(key)) continue;
        if (!prefix || key.length > stripDakuten(prefix.word).length) prefix = e;
      }
      if (prefix) {
        return { subKey: prefix.subKey, categoryKey: prefix.categoryKey, confidence: 0.74, matched: prefix.word };
      }
    }
  }

  /**
   * 4. fuzzy — for latin only.
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
