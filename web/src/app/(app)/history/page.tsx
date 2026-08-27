'use client';

import React, { useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import { dailyTotals } from '@/lib/analytics';
import { HeatGrid } from '@/components/charts';
import { ChevronLeft, ChevronRight, Search, SearchX } from 'lucide-react';
import { Card, Chip, EmptyState, Spinner, cx, inputClass } from '@/components/ui';
import { IconTile } from '@/lib/icons';
import { CategoryPicker, MonthPicker } from '@/components/pickers';
import { TxnEditor } from '@/components/TxnEditor';
import {
  WEEKDAYS_SHORT,
  currentMonth,
  dayLabel,
  daysInMonth,
  fromLocalDate,
  monthEnd,
  monthLabel,
  monthStart,
  pad2,
  shiftMonth,
} from '@/lib/format';
import type { TxnView } from '@/lib/types';

export default function HistoryPage() {
  const { txns, categories, fmt, loading } = useStore();
  const [ym, setYm] = useState(currentMonth());
  const [day, setDay] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [showCat, setShowCat] = useState(false);
  const [showMonth, setShowMonth] = useState(false);
  const [editing, setEditing] = useState<TxnView | null>(null);

  const from = monthStart(ym);
  const to = monthEnd(ym);

  const heat = useMemo(() => dailyTotals(txns, from, to), [txns, from, to]);
  const monthTotal = useMemo(
    () =>
      txns.reduce(
        (a, t) => (t.type === 'expense' && t.local_date >= from && t.local_date <= to ? a + t.amount_minor : a),
        0
      ),
    [txns, from, to]
  );

  const cells = useMemo(() => {
    const total = daysInMonth(ym);
    const first = fromLocalDate(`${ym}-01`).getDay();
    const out: { date: string; day: number; value: number; muted?: boolean }[] = [];
    for (let i = 0; i < first; i++) out.push({ date: `pad-${i}`, day: 0, value: 0, muted: true });
    for (let d = 1; d <= total; d++) {
      const date = `${ym}-${pad2(d)}`;
      out.push({ date, day: d, value: heat.get(date) ?? 0 });
    }
    return out;
  }, [ym, heat]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return txns.filter((t) => {
      if (day ? t.local_date !== day : t.local_date < from || t.local_date > to) return false;
      if (categoryId && t.category_id !== categoryId) return false;
      if (needle) {
        const hay = `${t.note ?? ''} ${t.raw_input ?? ''} ${t.cat_name}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [txns, day, from, to, categoryId, q]);

  const groups = useMemo(() => {
    const map = new Map<string, TxnView[]>();
    for (const r of rows) {
      if (!map.has(r.local_date)) map.set(r.local_date, []);
      map.get(r.local_date)!.push(r);
    }
    return [...map.entries()].map(([date, items]) => ({
      date,
      items,
      total: items.filter((i) => i.type === 'expense').reduce((a, b) => a + b.amount_minor, 0),
    }));
  }, [rows]);

  const selectedCategory = categories.find((c) => c.id === categoryId);

  if (loading) {
    return (
      <div className="grid h-[60dvh] place-items-center text-dim">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="px-4 pb-6">
      <div className="flex items-center py-4">
        <button
          type="button"
          onClick={() => {
            setYm(shiftMonth(ym, -1));
            setDay(null);
          }}
          className="grid size-9 place-items-center rounded-lg bg-sunken text-dim active:scale-90"
        >
          <ChevronLeft size={18} />
        </button>
        <button type="button" onClick={() => setShowMonth(true)} className="flex-1 text-center">
          <span className="block text-xl font-extrabold tracking-tight">{monthLabel(ym)}</span>
          <span className="tabular block text-[12px] font-semibold text-faint">{fmt(monthTotal)}</span>
        </button>
        <button
          type="button"
          onClick={() => {
            if (ym < currentMonth()) {
              setYm(shiftMonth(ym, 1));
              setDay(null);
            }
          }}
          className={cx('grid size-9 place-items-center rounded-lg bg-sunken text-dim active:scale-90', ym >= currentMonth() && 'opacity-25')}
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <Card>
        <div className="mb-1.5 grid grid-cols-7 text-center text-[10px] font-bold text-faint">
          {WEEKDAYS_SHORT.map((d) => (
            <span key={d}>{d[0]}</span>
          ))}
        </div>
        <HeatGrid cells={cells} selected={day} onPick={(d) => setDay(day === d ? null : d)} />
        <p className="mt-2 text-center text-[11px] text-faint">
          {day ? `Showing ${dayLabel(day)} — tap again to clear` : 'Tap a day to filter'}
        </p>
      </Card>

      <div className="mt-3 flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={15} className="absolute top-1/2 left-3.5 -translate-y-1/2 text-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search notes"
            className={cx(inputClass, 'py-2.5 pl-10')}
          />
        </div>
        <Chip
          label={selectedCategory ? selectedCategory.name : 'All'}
          active={!!selectedCategory}
          color={selectedCategory?.color}
          onClick={() => setShowCat(true)}
        />
      </div>

      {rows.length > 0 && (
        <p className="mt-3 text-[11.5px] text-faint">
          {rows.length} {rows.length === 1 ? 'entry' : 'entries'}
        </p>
      )}

      <div className="mt-2">
        {groups.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title="Nothing here"
            body={
              q || categoryId || day
                ? 'No entries match those filters.'
                : `No entries in ${monthLabel(ym, true)} yet.`
            }
          />
        ) : (
          groups.map((g) => (
            <section key={g.date}>
              <div className="sticky top-0 z-10 flex items-center bg-bg py-2">
                <h3 className="flex-1 text-xs font-bold text-dim">{dayLabel(g.date)}</h3>
                <span className="tabular text-xs font-bold text-faint">{fmt(g.total)}</span>
              </div>
              <div className="flex flex-col gap-2">
                {g.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setEditing(item)}
                    className="flex items-center gap-3 rounded-xl bg-surface p-3 text-left active:opacity-75"
                  >
                    <IconTile name={item.cat_icon} color={item.cat_color} size={36} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14.5px] font-semibold">{item.note || item.cat_name}</span>
                      <span className="block truncate text-[11.5px] text-faint">
                        {item.cat_name}
                        {item.method ? ` · ${item.method}` : ''}
                        {item.source === 'backfill' ? ' · backfilled' : ''}
                      </span>
                    </span>
                    <span
                      className={cx('tabular text-[15px] font-bold', item.type === 'income' && 'text-up')}
                    >
                      {item.type === 'income' ? '+' : ''}
                      {fmt(item.amount_minor)}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ))
        )}
      </div>

      <CategoryPicker
        open={showCat}
        categories={categories}
        value={categoryId}
        kind="all"
        allowAll
        onClose={() => setShowCat(false)}
        onPick={(id) => {
          setCategoryId(id);
          setShowCat(false);
        }}
      />
      <MonthPicker
        open={showMonth}
        value={ym}
        onClose={() => setShowMonth(false)}
        onPick={(m) => {
          setYm(m);
          setDay(null);
          setShowMonth(false);
        }}
      />
      <TxnEditor open={!!editing} txn={editing} onClose={() => setEditing(null)} />
    </div>
  );
}
