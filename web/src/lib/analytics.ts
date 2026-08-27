import type { QuerySpec } from './parser';
import type { Budget, Category, TxnType, TxnView } from './types';
import {
  MONTHS_SHORT,
  WEEKDAYS_SHORT,
  addDays,
  daySpan,
  daysInMonth,
  fromLocalDate,
  monthEnd,
  monthKey,
  monthLabel,
  monthStart,
  pad2,
  shiftMonth,
  todayLocal,
} from './format';

/**
 * The web app holds every transaction in memory — one person's spending is a few
 * thousand rows at most — so these are plain array reductions rather than SQL.
 */

export type CatTotal = {
  category_id: string;
  name: string;
  icon: string;
  color: string;
  total: number;
  count: number;
};

const inRange = (t: TxnView, from: string, to: string) => t.local_date >= from && t.local_date <= to;

export function sumRange(txns: TxnView[], from: string, to: string, type: TxnType) {
  return txns.reduce((a, t) => (t.type === type && inRange(t, from, to) ? a + t.amount_minor : a), 0);
}

export function totalsByCategory(txns: TxnView[], from: string, to: string, type: TxnType = 'expense'): CatTotal[] {
  const map = new Map<string, CatTotal>();
  for (const t of txns) {
    if (t.type !== type || !inRange(t, from, to)) continue;
    const key = t.category_id ?? 'none';
    const cur = map.get(key);
    if (cur) {
      cur.total += t.amount_minor;
      cur.count += 1;
    } else {
      map.set(key, {
        category_id: key,
        name: t.cat_name,
        icon: t.cat_icon,
        color: t.cat_color,
        total: t.amount_minor,
        count: 1,
      });
    }
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

export function dailyTotals(txns: TxnView[], from: string, to: string, type: TxnType = 'expense') {
  const map = new Map<string, number>();
  for (const t of txns) {
    if (t.type !== type || !inRange(t, from, to)) continue;
    map.set(t.local_date, (map.get(t.local_date) ?? 0) + t.amount_minor);
  }
  return map;
}

/* ------------------------------------------------------------------ */
/* month stats                                                         */
/* ------------------------------------------------------------------ */

export type MonthStats = {
  ym: string;
  from: string;
  to: string;
  expense: number;
  income: number;
  net: number;
  count: number;
  byCategory: CatTotal[];
  daily: { label: string; value: number; highlight: boolean }[];
  avgPerDay: number;
  projected: number;
  prevExpense: number;
  deltaPct: number | null;
  budgetTotal: number;
  overBudget: { name: string; color: string; used: number; limit: number }[];
};

export function monthStats(txns: TxnView[], budgets: Budget[], ym: string): MonthStats {
  const from = monthStart(ym);
  const to = monthEnd(ym);
  const today = todayLocal();

  const expense = sumRange(txns, from, to, 'expense');
  const income = sumRange(txns, from, to, 'income');
  const byCategory = totalsByCategory(txns, from, to, 'expense');
  const count = txns.filter((t) => inRange(t, from, to)).length;

  const total = daysInMonth(ym);
  const map = dailyTotals(txns, from, to);
  const daily = Array.from({ length: total }, (_, i) => {
    const date = `${ym}-${pad2(i + 1)}`;
    return { label: String(i + 1), value: map.get(date) ?? 0, highlight: date === today };
  });

  const isCurrent = monthKey(today) === ym;
  const elapsed = isCurrent ? fromLocalDate(today).getDate() : total;
  const avgPerDay = elapsed > 0 ? expense / elapsed : 0;

  const prevYm = shiftMonth(ym, -1);
  const prevExpense = sumRange(txns, monthStart(prevYm), monthEnd(prevYm), 'expense');

  const overall = budgets.find((b) => b.category_id === null);
  const perCat = new Map(budgets.filter((b) => b.category_id).map((b) => [b.category_id!, b.amount_minor]));

  return {
    ym,
    from,
    to,
    expense,
    income,
    net: income - expense,
    count,
    byCategory,
    daily,
    avgPerDay,
    projected: isCurrent ? Math.round(avgPerDay * total) : expense,
    prevExpense,
    deltaPct: prevExpense > 0 ? ((expense - prevExpense) / prevExpense) * 100 : null,
    budgetTotal: overall?.amount_minor ?? 0,
    overBudget: byCategory
      .filter((c) => perCat.has(c.category_id))
      .map((c) => ({ name: c.name, color: c.color, used: c.total, limit: perCat.get(c.category_id)! }))
      .filter((c) => c.used >= c.limit * 0.8)
      .sort((a, b) => b.used / b.limit - a.used / a.limit),
  };
}

/* ------------------------------------------------------------------ */
/* range stats                                                         */
/* ------------------------------------------------------------------ */

export type RangeStats = {
  from: string;
  to: string;
  label: string;
  expense: number;
  income: number;
  count: number;
  days: number;
  avgPerDay: number;
  avgPerMonth: number;
  byCategory: CatTotal[];
  months: { ym: string; label: string; expense: number; income: number }[];
  weekday: { label: string; value: number }[];
  methods: { method: string; total: number; count: number }[];
  merchants: { note: string; total: number; count: number }[];
  biggestDay: { date: string; total: number } | null;
  biggestTxn: { note: string; amount: number; date: string } | null;
};

export function rangeStats(txns: TxnView[], from: string, to: string, label: string): RangeStats {
  const scoped = txns.filter((t) => inRange(t, from, to));
  const expense = scoped.reduce((a, t) => (t.type === 'expense' ? a + t.amount_minor : a), 0);
  const income = scoped.reduce((a, t) => (t.type === 'income' ? a + t.amount_minor : a), 0);
  const days = daySpan(from, to);

  const months: RangeStats['months'] = [];
  let cursor = monthKey(from);
  const end = monthKey(to);
  let guard = 0;
  while (cursor <= end && guard++ < 240) {
    const mFrom = monthStart(cursor);
    const mTo = monthEnd(cursor);
    months.push({
      ym: cursor,
      label: MONTHS_SHORT[+cursor.slice(5, 7) - 1],
      expense: sumRange(scoped, mFrom, mTo, 'expense'),
      income: sumRange(scoped, mFrom, mTo, 'income'),
    });
    cursor = shiftMonth(cursor, 1);
  }

  const dow = new Array(7).fill(0) as number[];
  for (const t of scoped) if (t.type === 'expense') dow[fromLocalDate(t.local_date).getDay()] += t.amount_minor;

  const methodMap = new Map<string, { total: number; count: number }>();
  for (const t of scoped) {
    if (t.type !== 'expense') continue;
    const k = t.method ?? 'Unspecified';
    const cur = methodMap.get(k) ?? { total: 0, count: 0 };
    cur.total += t.amount_minor;
    cur.count += 1;
    methodMap.set(k, cur);
  }

  const noteMap = new Map<string, { total: number; count: number }>();
  for (const t of scoped) {
    if (t.type !== 'expense' || !t.note?.trim()) continue;
    const k = t.note.trim().toLowerCase();
    const cur = noteMap.get(k) ?? { total: 0, count: 0 };
    cur.total += t.amount_minor;
    cur.count += 1;
    noteMap.set(k, cur);
  }

  const byDay = dailyTotals(scoped, from, to);
  let biggestDay: RangeStats['biggestDay'] = null;
  byDay.forEach((total, date) => {
    if (!biggestDay || total > biggestDay.total) biggestDay = { date, total };
  });

  const biggestTxn = scoped
    .filter((t) => t.type === 'expense')
    .reduce<RangeStats['biggestTxn']>(
      (acc, t) =>
        !acc || t.amount_minor > acc.amount
          ? { note: t.note || t.cat_name, amount: t.amount_minor, date: t.local_date }
          : acc,
      null
    );

  return {
    from,
    to,
    label,
    expense,
    income,
    count: scoped.length,
    days,
    avgPerDay: days > 0 ? expense / days : 0,
    avgPerMonth: months.length > 0 ? expense / months.length : expense,
    byCategory: totalsByCategory(scoped, from, to, 'expense'),
    months,
    weekday: WEEKDAYS_SHORT.map((l, i) => ({ label: l[0], value: dow[i] })),
    methods: [...methodMap.entries()]
      .map(([method, v]) => ({ method, ...v }))
      .sort((a, b) => b.total - a.total),
    merchants: [...noteMap.entries()]
      .map(([note, v]) => ({ note, ...v }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8),
    biggestDay,
    biggestTxn,
  };
}

/* ------------------------------------------------------------------ */
/* chat answers                                                        */
/* ------------------------------------------------------------------ */

export type Answer = {
  headline: string;
  value: string;
  detail: string;
  bars: { label: string; value: number; highlight: boolean }[];
  breakdown: { name: string; color: string; total: number }[];
};

export function runQuery(spec: QuerySpec, txns: TxnView[], fmt: (m: number) => string): Answer {
  const { from, to, label } = spec.period;
  const scope = spec.categoryName ?? (spec.type === 'income' ? 'Income' : 'Spending');

  const cats = totalsByCategory(txns, from, to, spec.type);
  const filtered = spec.categoryId ? cats.filter((c) => c.category_id === spec.categoryId) : cats;
  const total = filtered.reduce((a, b) => a + b.total, 0);
  const count = filtered.reduce((a, b) => a + b.count, 0);

  const dayMap = dailyTotals(txns, from, to, spec.type);
  const span = Math.min(daySpan(from, to), 31);
  const start = span >= 31 ? addDays(to, -30) : from;
  const bars = Array.from({ length: span }, (_, i) => {
    const date = addDays(start, i);
    return { label: date.slice(-2), value: dayMap.get(date) ?? 0, highlight: date === todayLocal() };
  });

  const breakdown = spec.categoryId
    ? []
    : cats.slice(0, 6).map((c) => ({ name: c.name, color: c.color, total: c.total }));
  const days = Math.max(1, daySpan(from, to));

  if (spec.metric === 'count') {
    return {
      headline: `${scope} · ${label}`,
      value: String(count),
      detail: count === 0 ? 'Nothing logged in that window.' : `${count} entries, ${fmt(total)} in total.`,
      bars,
      breakdown,
    };
  }

  if (spec.metric === 'average') {
    return {
      headline: `Average · ${label}`,
      value: fmt(Math.round(total / days)),
      detail: `${fmt(total)} over ${days} day${days === 1 ? '' : 's'}${spec.categoryName ? ` on ${spec.categoryName}` : ''}.`,
      bars,
      breakdown,
    };
  }

  if (spec.metric === 'top') {
    const top = cats[0];
    return {
      headline: `Top categories · ${label}`,
      value: fmt(top?.total ?? 0),
      detail: top
        ? `${top.name} led with ${fmt(top.total)} of ${fmt(total)}.`
        : 'Nothing logged in that window.',
      bars,
      breakdown: cats.slice(0, 6).map((c) => ({ name: c.name, color: c.color, total: c.total })),
    };
  }

  return {
    headline: `${scope} · ${label}`,
    value: fmt(total),
    detail:
      count === 0
        ? 'Nothing logged in that window yet.'
        : `${count} entr${count === 1 ? 'y' : 'ies'} · ${fmt(Math.round(total / days))} a day on average.`,
    bars,
    breakdown,
  };
}

/* ------------------------------------------------------------------ */
/* insights                                                            */
/* ------------------------------------------------------------------ */

export type Insight = { icon: string; text: string; tone: 'good' | 'warn' | 'bad' | 'neutral' };

export function buildInsights(stats: MonthStats, fmt: (m: number) => string): Insight[] {
  const out: Insight[] = [];
  const isCurrent = monthKey(todayLocal()) === stats.ym;

  if (stats.deltaPct !== null && Math.abs(stats.deltaPct) >= 8 && stats.prevExpense > 0) {
    const up = stats.deltaPct > 0;
    out.push({
      icon: up ? '📈' : '📉',
      text: `You spent ${Math.abs(Math.round(stats.deltaPct))}% ${up ? 'more' : 'less'} than ${monthLabel(
        shiftMonth(stats.ym, -1),
        true
      )} (${fmt(stats.prevExpense)}).`,
      tone: up ? 'warn' : 'good',
    });
  }

  const top = stats.byCategory[0];
  if (top && stats.expense > 0) {
    out.push({
      icon: top.icon,
      text: `${top.name} is your biggest category at ${fmt(top.total)} — ${Math.round(
        (top.total / stats.expense) * 100
      )}% of the month.`,
      tone: 'neutral',
    });
  }

  if (stats.budgetTotal > 0) {
    const usedPct = Math.round((stats.expense / stats.budgetTotal) * 100);
    out.push({
      icon: usedPct >= 100 ? '🚨' : usedPct >= 80 ? '⚠️' : '✅',
      text:
        usedPct >= 100
          ? `You are ${fmt(stats.expense - stats.budgetTotal)} over your ${fmt(stats.budgetTotal)} budget.`
          : `${usedPct}% of your ${fmt(stats.budgetTotal)} budget used, ${fmt(stats.budgetTotal - stats.expense)} left.`,
      tone: usedPct >= 100 ? 'bad' : usedPct >= 80 ? 'warn' : 'good',
    });
  }

  for (const c of stats.overBudget.slice(0, 2)) {
    const p = Math.round((c.used / c.limit) * 100);
    out.push({
      icon: p >= 100 ? '🔴' : '🟠',
      text: `${c.name} is at ${p}% of its ${fmt(c.limit)} budget.`,
      tone: p >= 100 ? 'bad' : 'warn',
    });
  }

  if (isCurrent && stats.expense > 0) {
    out.push({
      icon: '🔮',
      text: `At ${fmt(Math.round(stats.avgPerDay))} a day you are on track for about ${fmt(stats.projected)} this month.`,
      tone: 'neutral',
    });
  }

  if (stats.income > 0) {
    const rate = Math.round(((stats.income - stats.expense) / stats.income) * 100);
    out.push({
      icon: rate >= 0 ? '🏦' : '⚡',
      text:
        rate >= 0
          ? `You kept ${rate}% of what you earned — ${fmt(stats.net)} saved.`
          : `You spent ${fmt(-stats.net)} more than you earned this month.`,
      tone: rate >= 20 ? 'good' : rate >= 0 ? 'neutral' : 'bad',
    });
  }

  const zeroDays = stats.daily.filter((d) => d.value === 0).length;
  if (stats.count >= 5 && zeroDays > 0) {
    out.push({
      icon: '🧘',
      text: `${zeroDays} no-spend day${zeroDays === 1 ? '' : 's'} this month.`,
      tone: 'good',
    });
  }

  return out;
}

export function categoryList(categories: Category[], kind?: TxnType) {
  return categories.filter((c) => !c.archived && (kind ? c.kind === kind : true));
}
