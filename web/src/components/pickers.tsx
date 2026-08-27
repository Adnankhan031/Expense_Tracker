'use client';

import React, { useMemo, useState } from 'react';
import { Chip, IconBadge, Sheet, cx, inputClass } from './ui';
import {
  MONTHS_SHORT,
  WEEKDAYS_SHORT,
  addDays,
  currentMonth,
  daysInMonth,
  fromLocalDate,
  monthKey,
  monthLabel,
  pad2,
  shiftMonth,
  todayLocal,
} from '@/lib/format';
import type { Category, TxnType } from '@/lib/types';

export function DatePicker({
  open,
  value,
  onClose,
  onPick,
  title = 'Pick a date',
}: {
  open: boolean;
  value: string;
  onClose: () => void;
  onPick: (d: string) => void;
  title?: string;
}) {
  const [ym, setYm] = useState(monthKey(value || todayLocal()));
  React.useEffect(() => {
    if (open) setYm(monthKey(value || todayLocal()));
  }, [open, value]);

  const today = todayLocal();
  const cells = useMemo(() => {
    const total = daysInMonth(ym);
    const first = fromLocalDate(`${ym}-01`).getDay();
    const out: (string | null)[] = Array.from({ length: first }, () => null);
    for (let d = 1; d <= total; d++) out.push(`${ym}-${pad2(d)}`);
    return out;
  }, [ym]);

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="flex flex-wrap gap-2">
        <Chip label="Today" active={value === today} onClick={() => onPick(today)} />
        <Chip label="Yesterday" active={value === addDays(today, -1)} onClick={() => onPick(addDays(today, -1))} />
        <Chip label="2 days ago" active={value === addDays(today, -2)} onClick={() => onPick(addDays(today, -2))} />
      </div>

      <div className="flex items-center justify-between">
        <button type="button" onClick={() => setYm(shiftMonth(ym, -1))} className="px-3 py-1 text-dim">
          ‹
        </button>
        <span className="text-base font-bold">{monthLabel(ym)}</span>
        <button type="button" onClick={() => setYm(shiftMonth(ym, 1))} className="px-3 py-1 text-dim">
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 text-center text-[10.5px] font-bold text-faint">
        {WEEKDAYS_SHORT.map((d) => (
          <span key={d}>{d[0]}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((date, i) =>
          date ? (
            <button
              key={i}
              type="button"
              onClick={() => onPick(date)}
              className={cx(
                'grid aspect-square place-items-center rounded-xl text-sm transition active:scale-95',
                date === value
                  ? 'bg-accent font-extrabold text-on-accent'
                  : date === today
                    ? 'bg-accent-soft font-extrabold text-accent'
                    : 'text-ink',
                date > today && 'opacity-35'
              )}
            >
              {+date.slice(-2)}
            </button>
          ) : (
            <span key={i} />
          )
        )}
      </div>
    </Sheet>
  );
}

export function MonthPicker({
  open,
  value,
  onClose,
  onPick,
}: {
  open: boolean;
  value: string;
  onClose: () => void;
  onPick: (ym: string) => void;
}) {
  const [year, setYear] = useState(+value.slice(0, 4));
  React.useEffect(() => {
    if (open) setYear(+value.slice(0, 4));
  }, [open, value]);
  const cur = currentMonth();

  return (
    <Sheet open={open} onClose={onClose} title="Pick a month">
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => setYear(year - 1)} className="px-3 py-1 text-dim">
          ‹
        </button>
        <span className="text-lg font-extrabold">{year}</span>
        <button type="button" onClick={() => setYear(year + 1)} className="px-3 py-1 text-dim">
          ›
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {MONTHS_SHORT.map((m, i) => {
          const ym = `${year}-${pad2(i + 1)}`;
          return (
            <button
              key={m}
              type="button"
              onClick={() => onPick(ym)}
              className={cx(
                'rounded-xl py-3.5 font-bold transition active:scale-95',
                ym === value ? 'bg-accent text-on-accent' : 'bg-card-alt text-ink',
                ym > cur && 'opacity-40'
              )}
            >
              {m}
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}

export function CategoryPicker({
  open,
  categories,
  value,
  kind,
  allowAll,
  onClose,
  onPick,
}: {
  open: boolean;
  categories: Category[];
  value: string | null;
  kind?: TxnType | 'all';
  allowAll?: boolean;
  onClose: () => void;
  onPick: (id: string | null) => void;
}) {
  const [q, setQ] = useState('');
  const list = categories
    .filter((c) => !c.archived)
    .filter((c) => (kind && kind !== 'all' ? c.kind === kind : true))
    .filter((c) => (q ? c.name.toLowerCase().includes(q.toLowerCase()) : true));

  return (
    <Sheet open={open} onClose={onClose} title="Category">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search categories"
        className={inputClass}
      />
      {allowAll && (
        <button
          type="button"
          onClick={() => onPick(null)}
          className="flex items-center gap-3 py-2 text-left active:opacity-70"
        >
          <IconBadge icon="🗂" color="#90A4AE" />
          <span className="flex-1 text-[15px] font-semibold">All categories</span>
          {value === null && <span className="text-accent">✓</span>}
        </button>
      )}
      {list.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onPick(c.id)}
          className="flex items-center gap-3 py-2 text-left active:opacity-70"
        >
          <IconBadge icon={c.icon} color={c.color} />
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold">{c.name}</span>
            <span className="block text-[11px] text-faint">{c.kind === 'income' ? 'Income' : 'Expense'}</span>
          </span>
          {value === c.id && <span className="text-accent">✓</span>}
        </button>
      ))}
    </Sheet>
  );
}
