'use client';

import React, { useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useStore } from '@/lib/store';
import { Bars, HBar, Ring } from '@/components/charts';
import { ChevronLeft, CircleHelp, NotebookPen } from 'lucide-react';
import { Card, EmptyState, SectionTitle, Segmented, Spinner, cx } from '@/components/ui';
import { IconTile } from '@/lib/icons';
import { TxnEditor } from '@/components/TxnEditor';
import { MONTHS_SHORT, currentMonth, dayLabel, monthEnd, monthLabel, monthStart, shiftMonth } from '@/lib/format';
import type { TxnView } from '@/lib/types';

type Span = '1m' | '6m' | '12m';

export default function CategoryPage() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const { categories, txns, budgets, fmt, loading } = useStore();
  const [span, setSpan] = useState<Span>('6m');
  const [editing, setEditing] = useState<TxnView | null>(null);

  const category = categories.find((c) => c.id === params.id);
  const baseMonth = search.get('ym') || currentMonth();

  const range = useMemo(() => {
    if (span === '1m')
      return { from: monthStart(baseMonth), to: monthEnd(baseMonth), months: 1, label: monthLabel(baseMonth) };
    const back = span === '6m' ? 5 : 11;
    return {
      from: monthStart(shiftMonth(currentMonth(), -back)),
      to: monthEnd(currentMonth()),
      months: back + 1,
      label: `Last ${back + 1} months`,
    };
  }, [span, baseMonth]);

  const rows = useMemo(
    () => txns.filter((t) => t.category_id === params.id && t.local_date >= range.from && t.local_date <= range.to),
    [txns, params.id, range]
  );

  const total = rows.filter((r) => r.type === 'expense').reduce((a, b) => a + b.amount_minor, 0);
  const budget = budgets.find((b) => b.category_id === params.id)?.amount_minor ?? 0;

  const buckets = useMemo(
    () =>
      Array.from({ length: range.months }, (_, i) => {
        const ym = shiftMonth(span === '1m' ? baseMonth : currentMonth(), -(range.months - 1 - i));
        const from = monthStart(ym);
        const to = monthEnd(ym);
        return {
          label: MONTHS_SHORT[+ym.slice(5, 7) - 1],
          value: rows
            .filter((r) => r.type === 'expense' && r.local_date >= from && r.local_date <= to)
            .reduce((a, b) => a + b.amount_minor, 0),
          highlight: ym === currentMonth(),
        };
      }),
    [rows, range.months, span, baseMonth]
  );

  const thisMonthSpend = buckets[buckets.length - 1]?.value ?? 0;

  if (loading) {
    return (
      <div className="grid h-[60dvh] place-items-center text-dim">
        <Spinner />
      </div>
    );
  }

  if (!category) {
    return (
      <div className="px-4 pt-6">
        <EmptyState icon={CircleHelp} title="Category not found" />
      </div>
    );
  }

  return (
    <div className="px-4 pb-8">
      <header className="flex items-center gap-2 pt-4 pb-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="grid size-9 shrink-0 place-items-center rounded-lg bg-sunken text-dim active:scale-90"
        >
          <ChevronLeft size={18} />
        </button>
        <IconTile name={category.icon} color={category.color} size={44} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xl font-extrabold tracking-tight">{category.name}</span>
          <span className="block text-[12.5px] text-dim">
            {rows.length} entries · {range.label}
          </span>
        </span>
        {budget > 0 && (
          <Ring progress={thisMonthSpend / budget} size={58} thickness={7}>
            <span className="text-[12px] font-extrabold">{Math.round((thisMonthSpend / budget) * 100)}%</span>
          </Ring>
        )}
      </header>

      <Segmented
        options={[
          { value: '1m' as Span, label: 'Month' },
          { value: '6m' as Span, label: '6 months' },
          { value: '12m' as Span, label: '1 year' },
        ]}
        value={span}
        onChange={setSpan}
      />

      <div className="mt-4 grid grid-cols-3 gap-3">
        <Stat label="Total" value={fmt(total)} />
        <Stat label="Per month" value={fmt(range.months ? Math.round(total / range.months) : 0)} />
        <Stat label="Per entry" value={fmt(rows.length ? Math.round(total / rows.length) : 0)} />
      </div>

      {range.months > 1 && (
        <>
          <SectionTitle>Month by month</SectionTitle>
          <Card>
            <Bars data={buckets} height={110} color={category.color} />
          </Card>
        </>
      )}

      {budget > 0 && (
        <>
          <SectionTitle>Budget</SectionTitle>
          <Card>
            <div className="mb-2 flex items-center text-[13px]">
              <span className="flex-1 text-dim">{monthLabel(currentMonth(), true)} so far</span>
              <span className="tabular font-bold">{fmt(thisMonthSpend)}</span>
              <span className="px-1 text-faint">/</span>
              <span className="tabular font-bold text-faint">{fmt(budget)}</span>
            </div>
            <HBar
              fraction={thisMonthSpend / budget}
              height={9}
              color={
                thisMonthSpend >= budget
                  ? 'var(--color-down)'
                  : thisMonthSpend >= budget * 0.8
                    ? 'var(--color-warn)'
                    : category.color
              }
            />
          </Card>
        </>
      )}

      <SectionTitle>Entries</SectionTitle>
      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={NotebookPen} title="No entries yet" body={`Nothing logged under ${category.name} in this window.`} />
        </Card>
      ) : (
        <Card>
          {rows.map((x, i) => (
            <button
              key={x.id}
              type="button"
              onClick={() => setEditing(x)}
              className={cx('flex w-full items-center py-3 text-left active:opacity-70', i > 0 && 'border-t border-line')}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{x.note || category.name}</span>
                <span className="block text-[11.5px] text-faint">
                  {dayLabel(x.local_date)}
                  {x.method ? ` · ${x.method}` : ''}
                </span>
              </span>
              <span className="tabular text-[14.5px] font-bold">{fmt(x.amount_minor)}</span>
            </button>
          ))}
        </Card>
      )}

      <TxnEditor open={!!editing} txn={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-surface p-3.5">
      <p className="text-[10.5px] font-bold uppercase tracking-wider text-faint">{label}</p>
      <p className="tabular mt-1 truncate text-lg font-bold">{value}</p>
    </div>
  );
}
