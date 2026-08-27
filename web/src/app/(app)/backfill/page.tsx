'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import * as q from '@/lib/queries';
import { parseInput, type ParsedEntry } from '@/lib/parser';
import { totalsByCategory } from '@/lib/analytics';
import { Button, Card, Chip, IconBadge, SectionTitle, Segmented, cx, inputClass } from '@/components/ui';
import { DatePicker, MonthPicker } from '@/components/pickers';
import {
  currentMonth,
  dayLabel,
  monthEnd,
  monthLabel,
  monthStart,
  shiftMonth,
  toMinor,
  todayLocal,
} from '@/lib/format';

type Mode = 'totals' | 'paste' | 'daily';

export default function BackfillPage() {
  const [ym, setYm] = useState(() => shiftMonth(currentMonth(), -1));
  const [mode, setMode] = useState<Mode>('totals');
  const [showMonth, setShowMonth] = useState(false);

  const targetDate = useMemo(() => {
    const end = monthEnd(ym);
    const today = todayLocal();
    return end > today ? today : end;
  }, [ym]);

  return (
    <div className="px-4 pb-8">
      <header className="pt-4 pb-3">
        <h1 className="text-3xl font-extrabold tracking-tight">Add past months</h1>
        <p className="mt-2 text-[13.5px] leading-6 text-dim">
          Already spent months before you started tracking? Fill them in here. Anything you add shows up in Overview and
          Analytics exactly like a normal entry.
        </p>
      </header>

      <button
        type="button"
        onClick={() => setShowMonth(true)}
        className="mb-4 flex w-full items-center gap-3 rounded-xl bg-card p-3.5 text-left active:opacity-80"
      >
        <span className="text-lg">📅</span>
        <span className="flex-1">
          <span className="block text-[11px] font-bold uppercase tracking-wider text-faint">Filling in</span>
          <span className="block text-[17px] font-bold">{monthLabel(ym)}</span>
        </span>
        <span className="text-faint">›</span>
      </button>

      <Segmented
        options={[
          { value: 'totals', label: 'Monthly totals' },
          { value: 'paste', label: 'Paste a list' },
          { value: 'daily', label: 'Day by day' },
        ]}
        value={mode}
        onChange={setMode}
      />

      {mode === 'totals' && <TotalsMode ym={ym} targetDate={targetDate} />}
      {mode === 'paste' && <PasteMode ym={ym} targetDate={targetDate} />}
      {mode === 'daily' && <DailyMode ym={ym} />}

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

/* --------------------------------------------------- one lump sum per category */

function TotalsMode({ ym, targetDate }: { ym: string; targetDate: string }) {
  const { categories, txns, currency, fmt, user, refresh } = useStore();
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

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
      <IconBadge icon={c.icon} color={c.color} size={34} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14.5px] font-semibold">{c.name}</span>
        {existing.has(c.id) && (
          <span className="block text-[11px] text-faint">already recorded: {fmt(existing.get(c.id) ?? 0)}</span>
        )}
      </span>
      <span className="flex w-28 items-center rounded-lg bg-card-alt px-2.5">
        <span className="text-sm text-faint">{currency}</span>
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
      <p className="mt-5 text-[12.5px] leading-5 text-dim">
        Remember roughly what you spent per category? Put the whole month&apos;s total against each one. Each becomes a
        single entry dated {dayLabel(targetDate)}.
      </p>

      <SectionTitle>Expenses</SectionTitle>
      <Card>{categories.filter((c) => c.kind === 'expense' && !c.archived).map(row)}</Card>

      <SectionTitle>Income</SectionTitle>
      <Card>{categories.filter((c) => c.kind === 'income' && !c.archived).map(row)}</Card>

      {done && (
        <p className="mt-4 rounded-xl bg-accent-soft px-3.5 py-2.5 text-[13px] font-semibold text-accent">{done}</p>
      )}

      <div className="mt-4 flex flex-col gap-3">
        {pending > 0 && (
          <div className="flex items-center">
            <span className="flex-1 text-[13px] text-dim">About to add</span>
            <span className="tabular text-[17px] font-bold">{fmt(toMinor(pending))}</span>
          </div>
        )}
        <Button onClick={save} disabled={pending <= 0} loading={busy}>
          Save {monthLabel(ym, true)}
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ paste a list */

function PasteMode({ ym, targetDate }: { ym: string; targetDate: string }) {
  const { categories, aliasMap, fmt, user, refresh } = useStore();
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<ParsedEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const parse = () => {
    const out: ParsedEntry[] = [];
    for (const line of text.split('\n').map((l) => l.trim()).filter(Boolean)) {
      const res = parseInput(line, {
        categories,
        aliases: aliasMap,
        defaultDate: targetDate,
        today: todayLocal(),
      });
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
      setDone(`${n} ${n === 1 ? 'entry' : 'entries'} saved to ${monthLabel(ym)}.`);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const total = preview.filter((p) => p.type === 'expense').reduce((a, b) => a + b.amountMinor, 0);

  return (
    <div>
      <p className="mt-5 text-[12.5px] leading-5 text-dim">
        One entry per line, written the same way you would in chat. Add a day if you remember it — otherwise everything
        lands on {dayLabel(targetDate)}.
      </p>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={7}
        placeholder={'rent 12000 on 1\ngroceries 6400\npetrol 3200 on 12\nswiggy 480 on 14\nsalary 45000 received on 1'}
        className={cx(inputClass, 'mt-3 min-h-40 resize-y leading-6')}
      />

      <Button variant="ghost" onClick={parse} className="mt-3">
        Preview
      </Button>

      {done && (
        <p className="mt-4 rounded-xl bg-accent-soft px-3.5 py-2.5 text-[13px] font-semibold text-accent">{done}</p>
      )}

      {preview.length > 0 && (
        <>
          <SectionTitle right={<span className="tabular text-[13px] font-bold text-dim">{fmt(total)}</span>}>
            {preview.length} entries ready
          </SectionTitle>
          <Card>
            {preview.map((p, i) => {
              const cat = categories.find((c) => c.id === p.categoryId);
              return (
                <div
                  key={i}
                  className={cx('flex items-center gap-2.5 py-2.5', i > 0 && 'border-t border-line')}
                >
                  <IconBadge icon={cat?.icon ?? '📦'} color={cat?.color ?? '#90A4AE'} size={30} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-semibold">{p.categoryName}</span>
                    <span className="block truncate text-[11px] text-faint">
                      {dayLabel(p.date)}
                      {p.note ? ` · ${p.note}` : ''}
                      {p.confidence < 0.6 ? ' · low confidence' : ''}
                    </span>
                  </span>
                  <span className={cx('tabular text-sm font-bold', p.type === 'income' && 'text-accent')}>
                    {p.type === 'income' ? '+' : ''}
                    {fmt(p.amountMinor)}
                  </span>
                </div>
              );
            })}
          </Card>
          <Button onClick={commit} loading={busy} className="mt-3">
            Add all {preview.length}
          </Button>
          <p className="mt-2 text-center text-[11.5px] text-faint">
            Anything mis-categorised can be fixed by tapping it in History.
          </p>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------- pin the chat to a day */

function DailyMode({ ym }: { ym: string }) {
  const router = useRouter();
  const { setPinnedDate } = useStore();
  const [date, setDate] = useState(monthStart(ym));
  const [showDate, setShowDate] = useState(false);

  React.useEffect(() => {
    setDate(monthStart(ym));
  }, [ym]);

  return (
    <div>
      <p className="mt-5 text-[12.5px] leading-5 text-dim">
        Pin the chat to an older day and type normally. Everything you send goes to that day until you reset it.
      </p>

      <button
        type="button"
        onClick={() => setShowDate(true)}
        className="mt-3 flex w-full items-center gap-3 rounded-xl bg-card p-3.5 text-left active:opacity-80"
      >
        <span>📅</span>
        <span className="flex-1 text-[15px] font-semibold">{dayLabel(date)}</span>
        <span className="text-faint">›</span>
      </button>

      <Button
        className="mt-3"
        onClick={() => {
          setPinnedDate(date);
          router.push('/add');
        }}
      >
        Pin chat to this day
      </Button>

      <div className="mt-3 flex flex-wrap gap-2">
        <Chip label="1st" onClick={() => setDate(monthStart(ym))} />
        <Chip label="15th" onClick={() => setDate(`${ym}-15`)} />
        <Chip label="Last day" onClick={() => setDate(monthEnd(ym))} />
      </div>

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
