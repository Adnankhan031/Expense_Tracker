'use client';

import React, { useMemo, useState } from 'react';
import { Check, Plus, Search } from 'lucide-react';
import { Button, cx, inputClass } from './ui';
import { IconTile } from '@/lib/icons';
import { useStore } from '@/lib/store';
import * as q from '@/lib/queries';
import { toMinor } from '@/lib/format';

const METHODS = ['Cash', 'Card', 'UPI', 'Bank', 'Wallet'];

/**
 * The fast path for typing several entries against one date: pick a category
 * tile, type the amount, add, repeat. No sheet, no navigation.
 */
export function QuickAdd({ date, onAdded }: { date: string; onAdded?: () => void }) {
  const { categories, currency, user, refresh } = useStore();
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [method, setMethod] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState(false);

  const list = useMemo(
    () =>
      categories
        .filter((c) => !c.archived && c.kind === type)
        .filter((c) => (search ? c.name.toLowerCase().includes(search.toLowerCase()) : true)),
    [categories, type, search]
  );

  const selected = categories.find((c) => c.id === categoryId);
  const canAdd = !!categoryId && Number(amount) > 0;

  const add = async () => {
    if (!canAdd) return;
    setBusy(true);
    try {
      await q.insertTxn(user.id, {
        amount_minor: toMinor(Number(amount)),
        type,
        category_id: categoryId!,
        local_date: date,
        method,
        note: note.trim() || null,
        source: 'manual',
      });
      setAmount('');
      setNote('');
      setFlash(true);
      setTimeout(() => setFlash(false), 900);
      await refresh();
      onAdded?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        {(['expense', 'income'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setType(t);
              setCategoryId(null);
            }}
            className={cx(
              'flex-1 rounded-lg py-2 text-[13px] font-bold capitalize transition',
              type === t
                ? t === 'income'
                  ? 'bg-up text-white'
                  : 'bg-brand text-on-brand'
                : 'bg-sunken text-dim'
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* category tiles */}
      {categories.length > 12 && (
        <div className="relative">
          <Search size={14} className="absolute top-1/2 left-3 -translate-y-1/2 text-faint" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Find a category"
            className={cx(inputClass, 'py-2 pl-9 text-[14px]')}
          />
        </div>
      )}

      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
        {list.map((c) => {
          const on = c.id === categoryId;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategoryId(on ? null : c.id)}
              className={cx(
                'flex flex-col items-center gap-1.5 rounded-xl border p-2 transition active:scale-95',
                on ? 'border-transparent' : 'border-line bg-sunken'
              )}
              style={on ? { background: c.color + '24', borderColor: c.color } : undefined}
            >
              <IconTile name={c.icon} color={c.color} size={32} />
              <span className={cx('w-full truncate text-center text-[10px] font-semibold', on ? 'text-ink' : 'text-dim')}>
                {c.name}
              </span>
            </button>
          );
        })}
      </div>

      {/* amount */}
      <div
        className={cx(
          'flex items-center rounded-xl border px-3.5 transition',
          selected ? 'border-line bg-sunken' : 'border-line-soft bg-sunken opacity-60'
        )}
      >
        <span className="text-xl font-bold text-dim">{currency.symbol}</span>
        <input
          value={amount}
          disabled={!selected}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          inputMode="decimal"
          placeholder="0"
          className="tabular w-full bg-transparent px-2 py-3 text-[26px] font-extrabold outline-none"
        />
      </div>

      <div className="flex gap-2">
        <input
          value={note}
          disabled={!selected}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="Note (optional)"
          className={cx(inputClass, 'flex-1 py-2.5 text-[14px]')}
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {METHODS.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMethod(method === m ? null : m)}
            className={cx(
              'rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition active:scale-95',
              method === m ? 'border-transparent bg-brand text-on-brand' : 'border-line bg-sunken text-dim'
            )}
          >
            {m}
          </button>
        ))}
      </div>

      <Button onClick={add} disabled={!canAdd} loading={busy} icon={flash ? Check : Plus}>
        {flash ? 'Added' : 'Add entry'}
      </Button>
    </div>
  );
}
