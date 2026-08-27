import {
  CatTotal,
  countInRange,
  dailyTotals,
  listBudgets,
  monthlyTotals,
  searchTxns,
  sumInRange,
  topNotes,
  totalsByCategory,
  totalsByMethod,
  totalsByWeekday,
} from './db';
import type { QuerySpec } from './parser';
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

/* ------------------------------------------------------------------ */
/* month stats — powers the Overview tab                               */
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
  budgetUsed: number;
  overBudget: { name: string; color: string; used: number; limit: number }[];
};

export function monthStats(ym: string): MonthStats {
  const from = monthStart(ym);
  const to = monthEnd(ym);
  const today = todayLocal();
  const expense = sumInRange(from, to, 'expense');
  const income = sumInRange(from, to, 'income');
  const byCategory = totalsByCategory(from, to, 'expense');
  const count = countInRange(from, to);

  const totalDays = daysInMonth(ym);
  const map = new Map(dailyTotals(from, to).map((d) => [d.local_date, d.total]));
  const daily = Array.from({ length: totalDays }, (_, i) => {
    const date = `${ym}-${pad2(i + 1)}`;
    return { label: String(i + 1), value: map.get(date) ?? 0, highlight: date === today };
  });

  const isCurrent = monthKey(today) === ym;
  const elapsed = isCurrent ? fromLocalDate(today).getDate() : totalDays;
  const avgPerDay = elapsed > 0 ? expense / elapsed : 0;
  const projected = isCurrent ? Math.round(avgPerDay * totalDays) : expense;

  const prevYm = shiftMonth(ym, -1);
  const prevExpense = sumInRange(monthStart(prevYm), monthEnd(prevYm), 'expense');
  const deltaPct = prevExpense > 0 ? ((expense - prevExpense) / prevExpense) * 100 : null;

  const budgets = listBudgets();
  const overall = budgets.find((b) => b.category_id === null);
  const perCat = new Map(budgets.filter((b) => b.category_id).map((b) => [b.category_id!, b.amount_minor]));
  const overBudget = byCategory
    .filter((c) => perCat.has(c.category_id))
    .map((c) => ({ name: c.name, color: c.color, used: c.total, limit: perCat.get(c.category_id)! }))
    .filter((c) => c.used >= c.limit * 0.8)
    .sort((a, b) => b.used / b.limit - a.used / a.limit);

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
    projected,
    prevExpense,
    deltaPct,
    budgetTotal: overall?.amount_minor ?? 0,
    budgetUsed: expense,
    overBudget,
  };
}

/* ------------------------------------------------------------------ */
/* long-range stats — powers the Analytics tab                         */
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

export function rangeStats(from: string, to: string, label: string): RangeStats {
  const expense = sumInRange(from, to, 'expense');
  const income = sumInRange(from, to, 'income');
  const count = countInRange(from, to);
  const days = daySpan(from, to);

  const monthsRaw = monthlyTotals(monthKey(from), monthKey(to));
  const monthMap = new Map(monthsRaw.map((m) => [m.ym, m]));
  const months: RangeStats['months'] = [];
  let cursor = monthKey(from);
  const end = monthKey(to);
  let guard = 0;
  while (cursor <= end && guard++ < 120) {
    const hit = monthMap.get(cursor);
    months.push({
      ym: cursor,
      label: MONTHS_SHORT[+cursor.slice(5, 7) - 1],
      expense: hit?.expense ?? 0,
      income: hit?.income ?? 0,
    });
    cursor = shiftMonth(cursor, 1);
  }

  const wd = totalsByWeekday(from, to);
  const wdMap = new Map(wd.map((w) => [+w.dow, w.total]));
  const weekday = WEEKDAYS_SHORT.map((label, i) => ({ label: label[0], value: wdMap.get(i) ?? 0 }));

  const dailies = dailyTotals(from, to);
  const biggest = dailies.reduce<{ date: string; total: number } | null>(
    (acc, d) => (!acc || d.total > acc.total ? { date: d.local_date, total: d.total } : acc),
    null
  );

  const txns = searchTxns({ from, to, type: 'expense', limit: 1 });
  const allInRange = searchTxns({ from, to, type: 'expense', limit: 2000 });
  const maxTxn = allInRange.reduce<RangeStats['biggestTxn']>(
    (acc, x) =>
      !acc || x.amount_minor > acc.amount
        ? { note: x.note || x.cat_name || 'Expense', amount: x.amount_minor, date: x.local_date }
        : acc,
    null
  );
  void txns;

  return {
    from,
    to,
    label,
    expense,
    income,
    count,
    days,
    avgPerDay: days > 0 ? expense / days : 0,
    avgPerMonth: months.length > 0 ? expense / months.length : expense,
    byCategory: totalsByCategory(from, to, 'expense'),
    months,
    weekday,
    methods: totalsByMethod(from, to).map((m) => ({ method: m.method ?? 'Unspecified', total: m.total, count: m.count })),
    merchants: topNotes(from, to, 8),
    biggestDay: biggest,
    biggestTxn: maxTxn,
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
  amountMinor: number | null;
};

export function runQuery(spec: QuerySpec, fmt: (m: number) => string): Answer {
  const { from, to, label } = spec.period;
  const scope = spec.categoryName ? spec.categoryName : spec.type === 'income' ? 'Income' : 'Spending';

  const cats = totalsByCategory(from, to, spec.type);
  const filtered = spec.categoryId ? cats.filter((c) => c.category_id === spec.categoryId) : cats;
  const total = filtered.reduce((a, b) => a + b.total, 0);
  const count = filtered.reduce((a, b) => a + b.count, 0);

  const dailies = dailyTotals(from, to, spec.type);
  const dayMap = new Map(dailies.map((d) => [d.local_date, d.total]));
  const span = Math.min(daySpan(from, to), 31);
  const startForBars = span >= 31 ? addDays(to, -30) : from;
  const bars = Array.from({ length: span }, (_, i) => {
    const date = addDays(startForBars, i);
    return { label: date.slice(-2), value: dayMap.get(date) ?? 0, highlight: date === todayLocal() };
  });

  const breakdown = cats.slice(0, 6).map((c) => ({ name: c.name, color: c.color, total: c.total }));
  const days = Math.max(1, daySpan(from, to));

  if (spec.metric === 'count') {
    return {
      headline: `${scope} · ${label}`,
      value: String(count),
      detail: count === 0 ? 'Nothing logged in that window.' : `${count} entries, ${fmt(total)} in total.`,
      bars,
      breakdown: spec.categoryId ? [] : breakdown,
      amountMinor: total,
    };
  }

  if (spec.metric === 'average') {
    const avg = Math.round(total / days);
    return {
      headline: `Average · ${label}`,
      value: fmt(avg),
      detail: `${fmt(total)} over ${days} day${days === 1 ? '' : 's'}${spec.categoryName ? ` on ${spec.categoryName}` : ''}.`,
      bars,
      breakdown: spec.categoryId ? [] : breakdown,
      amountMinor: avg,
    };
  }

  if (spec.metric === 'top') {
    const top = cats[0];
    return {
      headline: `Top categories · ${label}`,
      value: top ? fmt(top.total) : fmt(0),
      detail: top ? `${top.name} led with ${fmt(top.total)} of ${fmt(total)}.` : 'Nothing logged in that window.',
      bars,
      breakdown,
      amountMinor: top?.total ?? 0,
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
    breakdown: spec.categoryId ? [] : breakdown,
    amountMinor: total,
  };
}

/* ------------------------------------------------------------------ */
/* insight cards                                                       */
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
    const usedPct = Math.round((stats.budgetUsed / stats.budgetTotal) * 100);
    out.push({
      icon: usedPct >= 100 ? '🚨' : usedPct >= 80 ? '⚠️' : '✅',
      text:
        usedPct >= 100
          ? `You are ${fmt(stats.budgetUsed - stats.budgetTotal)} over your ${fmt(stats.budgetTotal)} budget.`
          : `${usedPct}% of your ${fmt(stats.budgetTotal)} budget used, ${fmt(stats.budgetTotal - stats.budgetUsed)} left.`,
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
