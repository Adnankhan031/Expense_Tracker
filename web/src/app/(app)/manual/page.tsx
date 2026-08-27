'use client';

import React, { useMemo, useState } from 'react';
import {
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  LayoutGrid,
  Trash2,
} from 'lucide-react';
import { useStore } from '@/lib/store';
import * as q from '@/lib/queries';
import { parseInput, type ParsedEntry } from '@/lib/parser';
import { totalsByCategory } from '@/lib/analytics';
import { Button, Card, PageTitle, SectionTitle, Segmented, cx, inputClass } from '@/components/ui';
import { QuickAdd } from '@/components/QuickAdd';
import { DatePicker, MonthPicker } from '@/components/pickers';
import { IconTile } from '@/lib/icons';
import { TxnEditor } from '@/components/TxnEditor';
import {
  WEEKDAYS_SHORT,
  addDays,
  currentMonth,
  dayLabel,
  fromLocalDate,
  monthEnd,
  monthLabel,
  monthStart,
  shortDayLabel,
  toMinor,
  todayLocal,
} from '@/lib/format';
import type { TxnView } from '@/lib/types';

type Mode = 'day' | 'week' | 'month' | 'paste';

export default function ManualPage() {
  const [mode, setMode] = useState<Mode>('day');

  return (
    <div className="px-4 pb-10">
      <PageTitle
        title="Add entries"
        subtitle="For any day, week or month — past or present. The chat is the shortcut; this is the full control."
      />

      <div className="mt-4">
        <Segmented
          options={[
            { value: 'day' as Mode, label: 'Day' },
            { value: 'week' as Mode, label: 'Week' },
            { value: 'month' as Mode, label: 'Month' },
            { value: 'paste' as Mode, label: 'Paste' },
          ]}
          value={mode}
          onChange={setMode}
        />
      </div>

      {mode === 'day' && <DayMode />}
      {mode === 'week' && <WeekMode />}
      {mode === 'month' && <MonthMode />}
      {mode === 'paste' && <PasteMode />}
    </div>
  );
}

/* ------------------------------------------------------------------- day */

function DayMode() {
  const { txns, fmt, refresh } = useStore();
  const [date, setDate] = useState(todayLocal());
  const [showDate, setShowDate] = useState(false);
  const [editing, setEditing] = useState<TxnView | null>(null);

  const dayTxns = useMemo(() => txns.filter((t) => t.local_date === date), [txns, date]);
  const spent = dayTxns.filter((t) => t.type === 'expense').reduce((a, b) => a + b.amount_minor, 0);
  const earned = dayTxns.filter((t) => t.type === 'income').reduce((a, b) => a + b.amount_minor, 0);

  return (
    <div>
      <Card tone="brand" className="mt-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDate(addDays(date, -1))}
            className="grid size-9 place-items-center rounded-lg bg-sunken text-dim active:scale-90"
          >
            <ChevronLeft size={18} />
          </button>
          <button type="button" onClick={() => setShowDate(true)} className="min-w-0 flex-1 text-center">
            <span className="block text-[17px] font-extrabold tracking-tight">{dayLabel(date)}</span>
            <span className="tabular block text-[12px] text-dim">
              {fmt(spent)} spent{earned > 0 ? ` · ${fmt(earned)} in` : ''}
            </span>
          </button>
          <button
            type="button"
            onClick={() => date < todayLocal() && setDate(addDays(date, 1))}
            className={cx(
              'grid size-9 place-items-center rounded-lg bg-sunken text-dim active:scale-90',
              date >= todayLocal() && 'opacity-30'
            )}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </Card>

      <SectionTitle>Add to {shortDayLabel(date)}</SectionTitle>
      <Card>
        <QuickAdd date={date} />
      </Card>

      {dayTxns.length > 0 && (
        <>
          <SectionTitle right={<span className="tabular text-[12px] font-bold text-dim">{fmt(spent)}</span>}>
            {dayTxns.length} on this day
          </SectionTitle>
          <Card className="p-0">
            {dayTxns.map((t, i) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setEditing(t)}
                className={cx(
                  'flex w-full items-center gap-3 px-4 py-3 text-left transition active:opacity-70',
                  i > 0 && 'border-t border-line'
                )}
              >
                <IconTile name={t.cat_icon} color={t.cat_color} size={34} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-semibold">{t.note || t.cat_name}</span>
                  <span className="block truncate text-[11.5px] text-faint">
                    {t.cat_name}
                    {t.method ? ` · ${t.method}` : ''}
                  </span>
                </span>
                <span className={cx('tabular text-[15px] font-bold', t.type === 'income' && 'text-up')}>
                  {t.type === 'income' ? '+' : ''}
                  {fmt(t.amount_minor)}
                </span>
                <Trash2
                  size={15}
                  className="text-faint"
                  onClick={async (e) => {
                    e.stopPropagation();
                    await q.softDeleteTxn(t.id);
                    await refresh();
                  }}
                />
              </button>
            ))}
          </Card>
        </>
      )}

      <DatePicker
        open={showDate}
        value={date}
        onClose={() => setShowDate(false)}
        onPick={(d) => {
          setDate(d);
          setShowDate(false);
        }}
      />
      <TxnEditor open={!!editing} txn={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

/* ------------------------------------------------------------------ week */

function WeekMode() {
  const { txns, fmt } = useStore();
  const today = todayLocal();
  const [anchor, setAnchor] = useState(today);
  const [openDay, setOpenDay] = useState<string | null>(null);

  const weekStart = useMemo(() => addDays(anchor, -fromLocalDate(anchor).getDay()), [anchor]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const weekEnd = days[6];

  const totals = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of txns) {
      if (t.type !== 'expense' || t.local_date < weekStart || t.local_date > weekEnd) continue;
      map.set(t.local_date, (map.get(t.local_date) ?? 0) + t.amount_minor);
    }
    return map;
  }, [txns, weekStart, weekEnd]);

  const weekTotal = [...totals.values()].reduce((a, b) => a + b, 0);
  const max = Math.max(1, ...totals.values());

  return (
    <div>
      <Card tone="brand" className="mt-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAnchor(addDays(anchor, -7))}
            className="grid size-9 place-items-center rounded-lg bg-sunken text-dim active:scale-90"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="min-w-0 flex-1 text-center">
            <span className="block text-[15px] font-extrabold tracking-tight">
              {shortDayLabel(weekStart)} – {shortDayLabel(weekEnd)}
            </span>
            <span className="tabular block text-[12px] text-dim">{fmt(weekTotal)} this week</span>
          </div>
          <button
            type="button"
            onClick={() => weekEnd < today && setAnchor(addDays(anchor, 7))}
            className={cx(
              'grid size-9 place-items-center rounded-lg bg-sunken text-dim active:scale-90',
              weekEnd >= today && 'opacity-30'
            )}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </Card>

      <SectionTitle>Tap a day to add</SectionTitle>
      <Card className="p-0">
        {days.map((d, i) => {
          const total = totals.get(d) ?? 0;
          const future = d > today;
          return (
            <button
              key={d}
              type="button"
              disabled={future}
              onClick={() => setOpenDay(openDay === d ? null : d)}
              className={cx(
                'flex w-full items-center gap-3 px-4 py-3 text-left transition active:opacity-70',
                i > 0 && 'border-t border-line',
                future && 'opacity-35',
                openDay === d && 'bg-sunken'
              )}
            >
              <span
                className={cx(
                  'grid size-10 shrink-0 place-items-center rounded-xl text-[11px] font-bold',
                  d === today ? 'bg-brand text-on-brand' : 'bg-sunken text-dim'
                )}
              >
                {WEEKDAYS_SHORT[fromLocalDate(d).getDay()][0]}
                {fromLocalDate(d).getDate()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold">{dayLabel(d)}</span>
                <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-sunken">
                  <span
                    className="block h-full rounded-full bg-brand transition-[width] duration-500"
                    style={{ width: `${total ? Math.max(4, (total / max) * 100) : 0}%` }}
                  />
                </span>
              </span>
              <span className="tabular text-[14px] font-bold">{total ? fmt(total) : '—'}</span>
            </button>
          );
        })}
      </Card>

      {openDay && (
        <>
          <SectionTitle>Add to {dayLabel(openDay)}</SectionTitle>
          <Card>
            <QuickAdd date={openDay} />
          </Card>
        </>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- month */

function MonthMode() {
  const { categories, txns, currency, fmt, user, refresh } = useStore();
  const [ym, setYm] = useState(() => currentMonth());
  const [showMonth, setShowMonth] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const targetDate = useMemo(() => {
    const end = monthEnd(ym);
    return end > todayLocal() ? todayLocal() : end;
  }, [ym]);

  const existing = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of totalsByCategory(txns, monthStart(ym), monthEnd(ym), 'expense')) map.set(c.category_id, c.total);
    return map;
  }, [txns, ym]);

  const pending = Object.values(values).reduce((a, v) => a + (Number(v) || 0), 0);

  const save = async () => {
    const entries = Object.entries(values).filter(([, v]) => Number(v) > 0);
    if (!entries.length) return;
    setBusy(true);
    setDone(null);
    try {
      await q.insertTxns(
        user.id,
        entries.map(([catId, v]) => {
          const cat = categories.find((c) => c.id === catId);
          return {
            amount_minor: toMinor(Number(v)),
            type: (cat?.kind === 'income' ? 'income' : 'expense') as 'income' | 'expense',
            category_id: catId,
            local_date: targetDate,
            note: `${monthLabel(ym, true)} total`,
            source: 'backfill' as const,
          };
        })
      );
      setValues({});
      setDone(`${entries.length} ${entries.length === 1 ? 'entry' : 'entries'} added to ${monthLabel(ym)}.`);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const row = (c: (typeof categories)[number]) => (
    <div key={c.id} className="flex items-center gap-2.5 py-1.5">
      <IconTile name={c.icon} color={c.color} size={34} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14.5px] font-semibold">{c.name}</span>
        {existing.has(c.id) && (
          <span className="block text-[11px] text-faint">already recorded: {fmt(existing.get(c.id) ?? 0)}</span>
        )}
      </span>
      <span className="flex w-28 items-center rounded-lg border border-line bg-sunken px-2.5">
        <span className="text-[13px] text-faint">{currency.symbol}</span>
        <input
          value={values[c.id] ?? ''}
          onChange={(e) => setValues((s) => ({ ...s, [c.id]: e.target.value.replace(/[^0-9.]/g, '') }))}
          inputMode="decimal"
          placeholder="0"
          className="tabular w-full bg-transparent py-2 pl-1 text-right text-[15px] font-bold outline-none"
        />
      </span>
    </div>
  );

  return (
    <div>
      <Card tone="brand" className="mt-4" onClick={() => setShowMonth(true)}>
        <div className="flex items-center gap-3">
          <CalendarRange size={19} className="text-brand" />
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-faint">Filling in</span>
            <span className="block text-[17px] font-extrabold">{monthLabel(ym)}</span>
          </span>
          <ChevronRight size={17} className="text-faint" />
        </div>
      </Card>

      <p className="mt-4 text-[12.5px] leading-5 text-dim">
        Know roughly what a whole month cost per category? Put the totals in here — each becomes one entry dated{' '}
        {dayLabel(targetDate)}. Good for months that predate the app.
      </p>

      <SectionTitle>Expenses</SectionTitle>
      <Card>{categories.filter((c) => c.kind === 'expense' && !c.archived).map(row)}</Card>

      <SectionTitle>Income</SectionTitle>
      <Card>{categories.filter((c) => c.kind === 'income' && !c.archived).map(row)}</Card>

      {done && (
        <p className="mt-4 rounded-xl bg-up-soft px-3.5 py-2.5 text-[13px] font-semibold text-up">{done}</p>
      )}

      <div className="mt-4 flex flex-col gap-3">
        {pending > 0 && (
          <div className="flex items-center">
            <span className="flex-1 text-[13px] text-dim">About to add</span>
            <span className="tabular text-[17px] font-extrabold">{fmt(toMinor(pending))}</span>
          </div>
        )}
        <Button onClick={save} disabled={pending <= 0} loading={busy}>
          Save {monthLabel(ym, true)}
        </Button>
      </div>

      <MonthPicker
        open={showMonth}
        value={ym}
        onClose={() => setShowMonth(false)}
        onPick={(m) => {
          setYm(m);
          setShowMonth(false);
        }}
      />
    </div>
  );
}

/* ----------------------------------------------------------------- paste */

function PasteMode() {
  const { categories, aliasMap, fmt, user, refresh } = useStore();
  const [date, setDate] = useState(todayLocal());
  const [showDate, setShowDate] = useState(false);
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<ParsedEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const parse = () => {
    const out: ParsedEntry[] = [];
    for (const line of text.split('\n').map((l) => l.trim()).filter(Boolean)) {
      const res = parseInput(line, { categories, aliases: aliasMap, defaultDate: date, today: todayLocal() });
      if (res.kind === 'entries') out.push(...res.entries);
    }
    setPreview(out);
    setDone(null);
  };

  const commit = async () => {
    setBusy(true);
    try {
      await q.insertTxns(
        user.id,
        preview.map((e) => ({
          amount_minor: e.amountMinor,
          type: e.type,
          category_id: e.categoryId,
          local_date: e.date,
          method: e.method,
          note: e.note,
          raw_input: e.raw,
          source: 'backfill' as const,
          confidence: e.confidence,
        }))
      );
      const n = preview.length;
      setPreview([]);
      setText('');
      setDone(`${n} ${n === 1 ? 'entry' : 'entries'} saved.`);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const total = preview.filter((p) => p.type === 'expense').reduce((a, b) => a + b.amountMinor, 0);

  return (
    <div>
      <Card tone="brand" className="mt-4" onClick={() => setShowDate(true)}>
        <div className="flex items-center gap-3">
          <CalendarDays size={19} className="text-brand" />
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-faint">
              Lines without a date land on
            </span>
            <span className="block text-[17px] font-extrabold">{dayLabel(date)}</span>
          </span>
          <ChevronRight size={17} className="text-faint" />
        </div>
      </Card>

      <p className="mt-4 text-[12.5px] leading-5 text-dim">
        One entry per line, written the way you would in chat. Add a day where you remember it.
      </p>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={7}
        placeholder={'rent 12000 on 1\ngroceries 6400\npetrol 3200 on 12\nlunch 480 on 14\nsalary 45000 received on 1'}
        className={cx(inputClass, 'mt-3 min-h-40 resize-y leading-6')}
      />

      <Button variant="outline" onClick={parse} className="mt-3" icon={ClipboardList} disabled={!text.trim()}>
        Preview
      </Button>

      {done && <p className="mt-4 rounded-xl bg-up-soft px-3.5 py-2.5 text-[13px] font-semibold text-up">{done}</p>}

      {preview.length > 0 && (
        <>
          <SectionTitle right={<span className="tabular text-[13px] font-bold text-dim">{fmt(total)}</span>}>
            {preview.length} entries ready
          </SectionTitle>
          <Card className="p-0">
            {preview.map((p, i) => {
              const cat = categories.find((c) => c.id === p.categoryId);
              return (
                <div key={i} className={cx('flex items-center gap-2.5 px-4 py-2.5', i > 0 && 'border-t border-line')}>
                  <IconTile name={cat?.icon} color={cat?.color ?? '#8a9099'} size={30} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-semibold">{p.categoryName}</span>
                    <span className="block truncate text-[11px] text-faint">
                      {dayLabel(p.date)}
                      {p.note ? ` · ${p.note}` : ''}
                      {p.confidence < 0.6 ? ' · low confidence' : ''}
                    </span>
                  </span>
                  <span className={cx('tabular text-sm font-bold', p.type === 'income' && 'text-up')}>
                    {p.type === 'income' ? '+' : ''}
                    {fmt(p.amountMinor)}
                  </span>
                </div>
              );
            })}
          </Card>
          <Button onClick={commit} loading={busy} className="mt-3" icon={LayoutGrid}>
            Add all {preview.length}
          </Button>
          <p className="mt-2 text-center text-[11.5px] text-faint">
            Anything mis-categorised can be fixed by tapping it in History.
          </p>
        </>
      )}

      <DatePicker
        open={showDate}
        value={date}
        onClose={() => setShowDate(false)}
        onPick={(d) => {
          setDate(d);
          setShowDate(false);
        }}
      />
    </div>
  );
}
