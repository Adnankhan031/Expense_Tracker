'use client';

import React, { useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Layers, Search } from 'lucide-react';
import { Chip, Sheet, cx, inputClass } from './ui';
import { IconTile } from '@/lib/icons';
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

function NavHeader({ label, onPrev, onNext, disableNext }: { label: string; onPrev: () => void; onNext: () => void; disableNext?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <button type="button" onClick={onPrev} className="grid size-9 place-items-center rounded-lg bg-sunken text-dim active:scale-90">
        <ChevronLeft size={18} />
      </button>
      <span className="text-base font-bold">{label}</span>
      <button
        type="button"
        onClick={onNext}
        disabled={disableNext}
        className={cx('grid size-9 place-items-center rounded-lg bg-sunken text-dim active:scale-90', disableNext && 'opacity-30')}
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}

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

      <NavHeader label={monthLabel(ym)} onPrev={() => setYm(shiftMonth(ym, -1))} onNext={() => setYm(shiftMonth(ym, 1))} />

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
                'grid aspect-square place-items-center rounded-xl text-sm font-semibold transition active:scale-90',
                date === value
                  ? 'bg-brand font-extrabold text-on-brand'
                  : date === today
                    ? 'bg-brand-soft font-extrabold text-brand'
                    : 'text-ink hover:bg-sunken',
                date > today && 'opacity-30'
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
      <NavHeader label={String(year)} onPrev={() => setYear(year - 1)} onNext={() => setYear(year + 1)} />
      <div className="grid grid-cols-3 gap-2">
        {MONTHS_SHORT.map((m, i) => {
          const ym = `${year}-${pad2(i + 1)}`;
          return (
            <button
              key={m}
              type="button"
              onClick={() => onPick(ym)}
              className={cx(
                'rounded-xl py-3.5 text-[14px] font-bold transition active:scale-95',
                ym === value ? 'bg-brand text-on-brand' : 'bg-sunken text-ink hover:bg-raised',
                ym > cur && 'opacity-35'
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
      <div className="relative">
        <Search size={15} className="absolute top-1/2 left-3.5 -translate-y-1/2 text-faint" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search categories"
          className={cx(inputClass, 'pl-10')}
        />
      </div>

      {allowAll && (
        <button
          type="button"
          onClick={() => onPick(null)}
          className="flex items-center gap-3 rounded-xl px-1 py-2 text-left transition active:opacity-70"
        >
          <span className="grid size-[38px] shrink-0 place-items-center rounded-xl bg-sunken text-dim">
            <Layers size={19} />
          </span>
          <span className="flex-1 text-[15px] font-semibold">All categories</span>
          {value === null && <Check size={18} className="text-brand" />}
        </button>
      )}

      {list.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onPick(c.id)}
          className="flex items-center gap-3 rounded-xl px-1 py-2 text-left transition active:opacity-70"
        >
          <IconTile name={c.icon} color={c.color} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-semibold">{c.name}</span>
            <span className="block text-[11px] text-faint">{c.kind === 'income' ? 'Income' : 'Expense'}</span>
          </span>
          {value === c.id && <Check size={18} className="text-brand" />}
        </button>
      ))}
    </Sheet>
  );
}
