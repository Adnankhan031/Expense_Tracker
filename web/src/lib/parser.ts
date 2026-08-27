// Mirrored from the native app (../../src/parser.ts). The only difference is
// that category ids are uuids here, so fallbacks look up the stable `key` slug.
import type { Category, TxnType } from './types';
import { METHOD_WORDS } from './seed';
import { addDays, fromLocalDate, monthEnd, monthKey, monthStart, pad2, shiftMonth, toLocalDate } from './format';

export type ParsedEntry = {
  amountMinor: number;
  type: TxnType;
  categoryId: string;
  categoryName: string;
  confidence: number;
  date: string;
  method: string | null;
  note: string | null;
  learnToken: string | null;
  raw: string;
};

export type QueryPeriod = { from: string; to: string; label: string };

export type QuerySpec = {
  metric: 'total' | 'count' | 'average' | 'top';
  type: TxnType;
  categoryId: string | null;
  categoryName: string | null;
  period: QueryPeriod;
  raw: string;
};

export type ParseResult =
  | { kind: 'entries'; entries: ParsedEntry[] }
  | { kind: 'query'; query: QuerySpec }
  | { kind: 'empty' };

export type ParseContext = {
  categories: Category[];
  aliases: Map<string, string>;
  defaultDate: string;
  today: string;
};

const MONTH_WORDS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9,
  september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

const WEEKDAY_WORDS: Record<string, number> = {
  sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2, wed: 3,
  wednesday: 3, thu: 4, thur: 4, thurs: 4, thursday: 4, fri: 5, friday: 5, sat: 6, saturday: 6,
};

const INCOME_WORDS = [
  'salary', 'received', 'recieved', 'credited', 'income', 'refund', 'refunded', 'earned',
  'earning', 'bonus', 'cashback', 'profit', 'dividend', 'won', 'prize', 'reimbursed',
  'reimbursement', 'stipend', 'freelance payment', 'got paid', 'payout', 'interest received',
];

const QUESTION_STARTERS = [
  'how much', 'how many', 'what did', 'what is', 'whats', "what's", 'show me', 'show',
  'total', 'avg', 'average', 'where did', 'which category', 'top ',
];

/* ------------------------------------------------------------------ */
/* small helpers                                                       */
/* ------------------------------------------------------------------ */

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length || !b.length) return Math.max(a.length, b.length);
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/** Day-of-month in the recent past: if it would be in the future, roll back a month. */
function pastDayOfMonth(day: number, today: string, monthNum?: number, year?: number): string {
  const t = fromLocalDate(today);
  let y = year ?? t.getFullYear();
  let m = monthNum ?? t.getMonth() + 1;
  if (monthNum && !year && monthNum > t.getMonth() + 1) y -= 1;
  let candidate = `${y}-${pad2(m)}-${pad2(day)}`;
  if (!monthNum && candidate > today) {
    const prev = shiftMonth(`${y}-${pad2(m)}`, -1);
    candidate = `${prev}-${pad2(day)}`;
  }
  return candidate;
}

/* ------------------------------------------------------------------ */
/* date extraction                                                     */
/* ------------------------------------------------------------------ */

type DateHit = { date: string; matched: string } | null;

export function extractDate(text: string, today: string): DateHit {
  const t = text;

  // 2026-08-05
  let m = t.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (m) return { date: `${m[1]}-${pad2(+m[2])}-${pad2(+m[3])}`, matched: m[0] };

  // 5/8, 05/08/2026, 5-8-26
  m = t.match(/\b(\d{1,2})[\/.](\d{1,2})(?:[\/.](\d{2,4}))?\b/);
  if (m) {
    const day = +m[1];
    const mon = +m[2];
    if (day >= 1 && day <= 31 && mon >= 1 && mon <= 12) {
      let year = m[3] ? +m[3] : undefined;
      if (year !== undefined && year < 100) year += 2000;
      return { date: pastDayOfMonth(day, today, mon, year), matched: m[0] };
    }
  }

  // 5 aug / 5th august / aug 5
  m = t.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]{3,9})\.?(?:\s+(\d{4}))?\b/);
  if (m && MONTH_WORDS[m[2]]) {
    return { date: pastDayOfMonth(+m[1], today, MONTH_WORDS[m[2]], m[3] ? +m[3] : undefined), matched: m[0] };
  }
  m = t.match(/\b([a-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s+(\d{4}))?\b/);
  if (m && MONTH_WORDS[m[1]]) {
    return { date: pastDayOfMonth(+m[2], today, MONTH_WORDS[m[1]], m[3] ? +m[3] : undefined), matched: m[0] };
  }

  // day before yesterday
  m = t.match(/\b(day before yesterday|day before yest|dbf)\b/);
  if (m) return { date: addDays(today, -2), matched: m[0] };

  m = t.match(/\b(yesterday|yest|ystd|yday|y'day)\b/);
  if (m) return { date: addDays(today, -1), matched: m[0] };

  m = t.match(/\b(today|tdy|tday)\b/);
  if (m) return { date: today, matched: m[0] };

  m = t.match(/\b(tomorrow|tmrw)\b/);
  if (m) return { date: addDays(today, 1), matched: m[0] };

  // 3 days ago / 2 days back
  m = t.match(/\b(\d{1,3})\s*(?:days?|d)\s*(?:ago|back|before)\b/);
  if (m) return { date: addDays(today, -Math.abs(+m[1])), matched: m[0] };

  m = t.match(/\b(\d{1,2})\s*(?:weeks?|wks?)\s*(?:ago|back)\b/);
  if (m) return { date: addDays(today, -7 * Math.abs(+m[1])), matched: m[0] };

  m = t.match(/\blast\s+(sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)[a-z]*\b/);
  if (m) {
    const target = WEEKDAY_WORDS[m[1]];
    const cur = fromLocalDate(today).getDay();
    let back = cur - target;
    if (back <= 0) back += 7;
    return { date: addDays(today, -back), matched: m[0] };
  }

  m = t.match(/\blast\s+month\b/);
  if (m) {
    const prev = shiftMonth(monthKey(today), -1);
    const day = Math.min(fromLocalDate(today).getDate(), +monthEnd(prev).slice(-2));
    return { date: `${prev}-${pad2(day)}`, matched: m[0] };
  }

  m = t.match(/\blast\s+week\b/);
  if (m) return { date: addDays(today, -7), matched: m[0] };

  // "on 5" / "5th" — a bare day of month
  m = t.match(/\bon\s+(\d{1,2})(?:st|nd|rd|th)?\b/);
  if (m && +m[1] >= 1 && +m[1] <= 31) return { date: pastDayOfMonth(+m[1], today), matched: m[0] };

  m = t.match(/\b(\d{1,2})(st|nd|rd|th)\b/);
  if (m && +m[1] >= 1 && +m[1] <= 31) return { date: pastDayOfMonth(+m[1], today), matched: m[0] };

  return null;
}

/* ------------------------------------------------------------------ */
/* amount extraction                                                   */
/* ------------------------------------------------------------------ */

type AmountHit = { minor: number; matched: string } | null;

export function extractAmount(text: string): AmountHit {
  // number with optional currency prefix/suffix and optional k / l / cr scale
  const re =
    /(?:(?:₹|rs\.?|inr|\$|usd)\s*)?(\d{1,3}(?:,\d{2,3})+|\d+)(?:\.(\d{1,2}))?\s*(k|thousand|l|lac|lakh|lakhs|cr|crore|crores|rs\.?|inr|\/-|rupees?)?/i;
  const m = text.match(re);
  if (!m) return null;

  const intPart = m[1].replace(/,/g, '');
  const decPart = m[2] ?? '';
  let value = parseFloat(`${intPart}.${decPart || '0'}`);
  const scale = (m[3] ?? '').toLowerCase();

  if (scale === 'k' || scale === 'thousand') value *= 1_000;
  else if (scale === 'l' || scale === 'lac' || scale === 'lakh' || scale === 'lakhs') value *= 100_000;
  else if (scale.startsWith('cr')) value *= 10_000_000;

  if (!isFinite(value) || value <= 0) return null;
  return { minor: Math.round(value * 100), matched: m[0] };
}

/* ------------------------------------------------------------------ */
/* category matching                                                   */
/* ------------------------------------------------------------------ */

type CatHit = { categoryId: string; confidence: number; matched: string | null };

let _indexCache: { key: Category[]; index: Map<string, string> } | null = null;

function buildKeywordIndex(categories: Category[]) {
  if (_indexCache && _indexCache.key === categories) return _indexCache.index;
  const exact = new Map<string, string>();
  for (const c of categories) {
    exact.set(c.name.toLowerCase(), c.id);
    const firstWord = c.name.toLowerCase().split(/[^a-z]+/)[0];
    if (firstWord && !exact.has(firstWord)) exact.set(firstWord, c.id);
    for (const k of (c.keywords || '').split('|')) {
      const key = k.trim().toLowerCase();
      if (key && !exact.has(key)) exact.set(key, c.id);
    }
  }
  _indexCache = { key: categories, index: exact };
  return exact;
}

export function matchCategory(text: string, ctx: ParseContext, wantType?: TxnType): CatHit {
  const index = buildKeywordIndex(ctx.categories);
  const cleaned = text.replace(/[^a-z0-9' ]/gi, ' ').replace(/\s+/g, ' ').trim();
  if (!cleaned) return { categoryId: fallbackId(ctx, wantType), confidence: 0.25, matched: null };

  const words = cleaned.split(' ').filter(Boolean);

  // multi-word phrases first (longest wins), then single words
  for (let size = Math.min(3, words.length); size >= 1; size--) {
    for (let i = 0; i + size <= words.length; i++) {
      const phrase = words.slice(i, i + size).join(' ');
      const alias = ctx.aliases.get(phrase);
      if (alias && ctx.categories.some((c) => c.id === alias))
        return { categoryId: alias, confidence: 0.98, matched: phrase };
      const kw = index.get(phrase);
      if (kw) return { categoryId: kw, confidence: size > 1 ? 0.95 : 0.9, matched: phrase };
    }
  }

  // fuzzy on single words — catches typos and short forms
  let best: { id: string; word: string; dist: number; keyLen: number } | null = null;
  const candidates: [string, string][] = [...ctx.aliases.entries(), ...index.entries()];
  for (const w of words) {
    if (w.length < 4) continue;
    for (const [key, id] of candidates) {
      if (key.includes(' ')) continue;
      const budget = key.length >= 7 ? 2 : 1;
      if (Math.abs(key.length - w.length) > budget) continue;
      const d = levenshtein(w, key);
      if (d <= budget && (!best || d < best.dist)) best = { id, word: w, dist: d, keyLen: key.length };
    }
  }
  if (best) return { categoryId: best.id, confidence: best.dist === 1 ? 0.72 : 0.6, matched: best.word };

  // prefix match: "gro" -> groceries
  for (const w of words) {
    if (w.length < 3) continue;
    for (const [key, id] of candidates) {
      if (key.startsWith(w) && key.length - w.length <= 6) return { categoryId: id, confidence: 0.65, matched: w };
    }
  }

  return { categoryId: fallbackId(ctx, wantType), confidence: 0.25, matched: null };
}

function fallbackId(ctx: ParseContext, wantType?: TxnType) {
  if (wantType === 'income') {
    const inc =
      ctx.categories.find((c) => c.key === 'other_income') ?? ctx.categories.find((c) => c.kind === 'income');
    if (inc) return inc.id;
  }
  return ctx.categories.find((c) => c.key === 'other')?.id ?? ctx.categories[0]?.id ?? '';
}

/* ------------------------------------------------------------------ */
/* method + type                                                       */
/* ------------------------------------------------------------------ */

function extractMethod(text: string): { method: string | null; matched: string | null } {
  const keys = Object.keys(METHOD_WORDS).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    const re = new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (re.test(text)) return { method: METHOD_WORDS[k], matched: k };
  }
  return { method: null, matched: null };
}

function detectType(text: string): TxnType {
  if (/^\s*\+/.test(text)) return 'income';
  for (const w of INCOME_WORDS) {
    if (new RegExp(`\\b${w}\\b`, 'i').test(text)) return 'income';
  }
  return 'expense';
}

/* ------------------------------------------------------------------ */
/* segmentation                                                        */
/* ------------------------------------------------------------------ */

export function splitSegments(text: string): string[] {
  // protect thousands separators so "1,250" never splits into "1" and "250"
  const GUARD = String.fromCharCode(0);
  const guarded = text.replace(/(\d),(?=\d)/g, `$1${GUARD}`);
  const rough = guarded
    .split(/\n|,|;|\s+and\s+|\s+&\s+|\s*\+\s+(?=[a-z])/i)
    .map((s) => s.split(GUARD).join(',').trim())
    .filter(Boolean);
  if (rough.length <= 1) return [text.trim()].filter(Boolean);

  // merge amount-less fragments forward so "coffee and snacks 200" stays one entry
  const out: string[] = [];
  let carry = '';
  for (const seg of rough) {
    const combined = carry ? `${carry} ${seg}` : seg;
    if (extractAmount(seg)) {
      out.push(combined);
      carry = '';
    } else {
      carry = combined;
    }
  }
  if (carry) {
    if (out.length) out[out.length - 1] += ` ${carry}`;
    else out.push(carry);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* query parsing                                                       */
/* ------------------------------------------------------------------ */

export function parsePeriod(text: string, today: string): QueryPeriod {
  const t = text;
  const thisMonth = monthKey(today);

  if (/\btoday\b/.test(t)) return { from: today, to: today, label: 'today' };
  if (/\byesterday\b|\byest\b/.test(t)) {
    const y = addDays(today, -1);
    return { from: y, to: y, label: 'yesterday' };
  }
  if (/\blast month\b|\bprevious month\b/.test(t)) {
    const p = shiftMonth(thisMonth, -1);
    return { from: monthStart(p), to: monthEnd(p), label: 'last month' };
  }
  if (/\bthis month\b|\bcurrent month\b/.test(t))
    return { from: monthStart(thisMonth), to: monthEnd(thisMonth), label: 'this month' };
  if (/\blast week\b/.test(t)) return { from: addDays(today, -13), to: addDays(today, -7), label: 'last week' };
  if (/\bthis week\b/.test(t)) {
    const dow = fromLocalDate(today).getDay();
    return { from: addDays(today, -dow), to: today, label: 'this week' };
  }
  if (/\bthis year\b/.test(t)) {
    const y = today.slice(0, 4);
    return { from: `${y}-01-01`, to: `${y}-12-31`, label: 'this year' };
  }
  if (/\blast year\b/.test(t)) {
    const y = String(+today.slice(0, 4) - 1);
    return { from: `${y}-01-01`, to: `${y}-12-31`, label: 'last year' };
  }
  if (/\ball time\b|\bever\b|\boverall\b|\btotal so far\b/.test(t))
    return { from: '1970-01-01', to: '2999-12-31', label: 'all time' };

  let m = t.match(/\blast\s+(\d{1,3})\s*days?\b/);
  if (m) return { from: addDays(today, -(+m[1] - 1)), to: today, label: `last ${m[1]} days` };

  m = t.match(/\blast\s+(\d{1,2})\s*months?\b/);
  if (m) {
    const start = shiftMonth(thisMonth, -(+m[1] - 1));
    return { from: monthStart(start), to: monthEnd(thisMonth), label: `last ${m[1]} months` };
  }

  m = t.match(/\bin\s+([a-z]{3,9})\b/) || t.match(/\b([a-z]{3,9})\s+(\d{4})\b/);
  if (m && MONTH_WORDS[m[1]]) {
    const now = fromLocalDate(today);
    const mon = MONTH_WORDS[m[1]];
    const yr = m[2] ? +m[2] : mon > now.getMonth() + 1 ? now.getFullYear() - 1 : now.getFullYear();
    const ym = `${yr}-${pad2(mon)}`;
    return { from: monthStart(ym), to: monthEnd(ym), label: monthKey(ym) };
  }

  return { from: monthStart(thisMonth), to: monthEnd(thisMonth), label: 'this month' };
}

function parseQuery(text: string, ctx: ParseContext): QuerySpec {
  const t = norm(text);
  const period = parsePeriod(t, ctx.today);
  const metric: QuerySpec['metric'] = /\bhow many\b|\bcount\b|\btimes\b/.test(t)
    ? 'count'
    : /\baverage\b|\bavg\b|\bper day\b|\bmean\b/.test(t)
      ? 'average'
      : /\btop\b|\bmost\b|\bhighest\b|\bbiggest\b|\bwhere did\b|\bbreakdown\b|\bwhich category\b/.test(t)
        ? 'top'
        : 'total';

  const type: TxnType = /\bearn|\bincome\b|\bsalary\b|\breceived\b|\bcredited\b/.test(t) ? 'income' : 'expense';

  // strip period/metric words before matching a category
  const stripped = t
    .replace(
      /\b(how much|how many|what|whats|what's|did|do|i|we|spend|spent|show|me|total|average|avg|on|in|for|the|my|this|last|month|week|year|today|yesterday|all|time|days?|months?|top|most|highest|count|times|per|day|of|is|was|where|category|breakdown|so far|\?)\b/g,
      ' '
    )
    .replace(/\d+/g, ' ')
    .trim();

  let categoryId: string | null = null;
  let categoryName: string | null = null;
  if (stripped) {
    const hit = matchCategory(stripped, ctx, type);
    if (hit.matched && hit.confidence >= 0.6) {
      categoryId = hit.categoryId;
      categoryName = ctx.categories.find((c) => c.id === hit.categoryId)?.name ?? null;
    }
  }

  return { metric, type, categoryId, categoryName, period, raw: text };
}

export function looksLikeQuestion(text: string): boolean {
  const t = norm(text);
  if (t.includes('?')) return true;
  return QUESTION_STARTERS.some((q) => t.startsWith(q));
}

/* ------------------------------------------------------------------ */
/* main entry point                                                    */
/* ------------------------------------------------------------------ */

export function parseInput(input: string, ctx: ParseContext): ParseResult {
  const raw = input.trim();
  if (!raw) return { kind: 'empty' };

  const hasAmount = !!extractAmount(norm(raw));
  if (looksLikeQuestion(raw) && !hasAmount) return { kind: 'query', query: parseQuery(raw, ctx) };
  if (!hasAmount) {
    // no number at all — treat as a question so the user still gets something useful
    return { kind: 'query', query: parseQuery(raw, ctx) };
  }

  const entries = splitSegments(raw)
    .map((seg) => parseSegment(seg, ctx))
    .filter((e): e is ParsedEntry => e !== null);

  if (!entries.length) return { kind: 'empty' };
  return { kind: 'entries', entries };
}

export function parseSegment(segment: string, ctx: ParseContext): ParsedEntry | null {
  const original = segment.trim();
  let work = norm(original);
  if (!work) return null;

  const type = detectType(work);

  // quantity multiplier: "chai 20 x3"
  let multiplier = 1;
  const mult = work.match(/\b[x*]\s*(\d{1,3})\b|\b(\d{1,3})\s*[x*]\b/);
  if (mult) {
    multiplier = Math.max(1, +(mult[1] ?? mult[2] ?? 1));
    work = work.replace(mult[0], ' ');
  }

  // date first, so "on 5" is never mistaken for an amount
  const dateHit = extractDate(work, ctx.today);
  if (dateHit) work = work.replace(dateHit.matched, ' ');

  const amountHit = extractAmount(work);
  if (!amountHit) return null;
  work = work.replace(amountHit.matched, ' ');

  const methodHit = extractMethod(work);
  if (methodHit.matched) work = work.replace(new RegExp(`\\b${methodHit.matched}\\b`, 'i'), ' ');

  // drop filler words
  const remainder = work
    .replace(
      /\b(paid|pay|spent|spend|bought|buy|for|on|to|at|the|a|an|of|was|is|it|rs|rupees?|inr|got|received|credited|debited|today|expense|income|added|add)\b/g,
      ' '
    )
    .replace(/[^a-z0-9' ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const catHit = matchCategory(remainder || original, ctx, type);
  let category = ctx.categories.find((c) => c.id === catHit.categoryId);

  // "gift received 500" reads as income but lands on an expense category — realign it
  if (category && category.kind !== type) {
    const better = ctx.categories.find((c) => c.id === fallbackId(ctx, type));
    if (catHit.confidence < 0.95 || !catHit.matched) {
      catHit.categoryId = better?.id ?? catHit.categoryId;
      catHit.confidence = Math.min(catHit.confidence, 0.55);
      category = better;
    }
  }

  // note: whatever the user wrote that is not just the category's own name
  let note: string | null = remainder || null;
  if (note && catHit.matched && category) {
    const catWords = category.name.toLowerCase().split(/[^a-z]+/).filter(Boolean);
    if (catWords.includes(catHit.matched)) {
      const rest = note.replace(new RegExp(`\\b${catHit.matched}\\b`, 'g'), ' ').replace(/\s+/g, ' ').trim();
      note = rest || null;
    }
  }
  if (note && note.length > 80) note = note.slice(0, 80);

  const learnToken =
    catHit.matched && catHit.confidence >= 0.9
      ? catHit.matched
      : (remainder.split(' ').find((w) => w.length >= 3) ?? null);

  return {
    amountMinor: amountHit.minor * multiplier,
    type,
    categoryId: catHit.categoryId,
    categoryName: category?.name ?? 'Other',
    confidence: catHit.confidence,
    date: dateHit ? dateHit.date : ctx.defaultDate,
    method: methodHit.method,
    note,
    learnToken,
    raw: original,
  };
}

/* ------------------------------------------------------------------ */
/* a tiny built-in test corpus, used by the Settings > parser check     */
/* ------------------------------------------------------------------ */

export const PARSER_SAMPLES = [
  'food 300',
  'groceries 2400 and auto 80',
  'zomato 480 yest upi',
  'petrol 1500 on 5th',
  'rent 12000 1 aug',
  'chai 20 x3',
  'salary 45000 received',
  'medicines 640 3 days ago',
  'uber 240 card',
  'netflix 199',
  'movie 900 last friday',
  'flight tickets 8.5k',
];
