'use client';

import React, { useEffect, useState } from 'react';
import { Button, Chip, IconBadge, Sheet, inputClass } from './ui';
import { CategoryPicker, DatePicker } from './pickers';
import { useStore } from '@/lib/store';
import * as q from '@/lib/queries';
import { dayLabel, toMinor } from '@/lib/format';
import type { NewTxn, TxnView } from '@/lib/types';

const METHODS = ['Cash', 'UPI', 'Card', 'Bank', 'Wallet'];

export function TxnEditor({
  open,
  txn,
  seed,
  onClose,
}: {
  open: boolean;
  txn?: TxnView | null;
  seed?: Partial<NewTxn>;
  onClose: () => void;
}) {
  const { categories, accounts, currency, pinnedDate, user, refresh } = useStore();
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [categoryId, setCategoryId] = useState('');
  const [date, setDate] = useState(pinnedDate);
  const [method, setMethod] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [showCat, setShowCat] = useState(false);
  const [showDate, setShowDate] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const fallback = categories.find((c) => c.key === 'other')?.id ?? categories[0]?.id ?? '';
    if (txn) {
      setAmount(String(txn.amount_minor / 100));
      setType(txn.type);
      setCategoryId(txn.category_id ?? fallback);
      setDate(txn.local_date);
      setMethod(txn.method);
      setAccountId(txn.account_id);
      setNote(txn.note ?? '');
    } else {
      setAmount(seed?.amount_minor ? String(seed.amount_minor / 100) : '');
      setType(seed?.type ?? 'expense');
      setCategoryId(seed?.category_id ?? fallback);
      setDate(seed?.local_date ?? pinnedDate);
      setMethod(seed?.method ?? null);
      setAccountId(seed?.account_id ?? null);
      setNote(seed?.note ?? '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, txn?.id]);

  const category = categories.find((c) => c.id === categoryId);

  const save = async () => {
    const minor = toMinor(Number(amount || '0'));
    if (!minor || minor <= 0) return;
    setBusy(true);
    try {
      // A manual category change is the strongest training signal there is.
      const source = (note || txn?.note || txn?.raw_input || seed?.note || '').toLowerCase();
      const token = source.split(/[^a-z0-9']+/).find((w) => w.length >= 3);
      if (token && (!txn || txn.category_id !== categoryId)) await q.learnAlias(user.id, token, categoryId);

      if (txn) {
        await q.updateTxn(txn.id, {
          amount_minor: minor,
          type,
          category_id: categoryId,
          local_date: date,
          method,
          account_id: accountId,
          note: note.trim() || null,
        });
      } else {
        await q.insertTxn(user.id, {
          amount_minor: minor,
          type,
          category_id: categoryId,
          local_date: date,
          method,
          account_id: accountId,
          note: note.trim() || null,
          source: 'manual',
        });
      }
      await refresh();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!txn) return;
    setBusy(true);
    try {
      await q.softDeleteTxn(txn.id);
      await refresh();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Sheet open={open} onClose={onClose} title={txn ? 'Edit entry' : 'New entry'}>
        <div className="flex gap-2">
          <Chip label="Expense" active={type === 'expense'} onClick={() => setType('expense')} />
          <Chip label="Income" active={type === 'income'} onClick={() => setType('income')} />
        </div>

        <div className="flex items-center rounded-xl bg-card-alt px-3.5">
          <span className="text-2xl font-bold text-dim">{currency}</span>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
            inputMode="decimal"
            placeholder="0"
            autoFocus={!txn}
            className="tabular w-full bg-transparent px-2 py-3 text-3xl font-extrabold outline-none"
          />
        </div>

        <button
          type="button"
          onClick={() => setShowCat(true)}
          className="flex items-center gap-3 rounded-xl bg-card-alt p-3 text-left active:opacity-80"
        >
          <IconBadge icon={category?.icon ?? '📦'} color={category?.color ?? '#90A4AE'} size={34} />
          <span className="flex-1 text-[15px] font-semibold">{category?.name ?? 'Choose category'}</span>
          <span className="text-faint">›</span>
        </button>

        <button
          type="button"
          onClick={() => setShowDate(true)}
          className="flex items-center gap-3 rounded-xl bg-card-alt p-3.5 text-left active:opacity-80"
        >
          <span className="text-dim">📅</span>
          <span className="flex-1 text-[15px] font-semibold">{dayLabel(date)}</span>
          <span className="text-faint">›</span>
        </button>

        <div className="flex flex-wrap gap-2">
          {METHODS.map((m) => (
            <Chip key={m} label={m} small active={method === m} onClick={() => setMethod(method === m ? null : m)} />
          ))}
        </div>

        {accounts.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {accounts.map((a) => (
              <Chip
                key={a.id}
                icon={a.icon}
                label={a.name}
                small
                active={accountId === a.id}
                onClick={() => setAccountId(accountId === a.id ? null : a.id)}
              />
            ))}
          </div>
        )}

        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional)"
          className={inputClass}
        />

        <Button onClick={save} loading={busy}>
          {txn ? 'Save changes' : 'Add entry'}
        </Button>
        {txn && (
          <Button variant="danger" onClick={remove} disabled={busy}>
            Delete
          </Button>
        )}
      </Sheet>

      <CategoryPicker
        open={showCat}
        categories={categories}
        value={categoryId}
        kind={type}
        onClose={() => setShowCat(false)}
        onPick={(id) => {
          if (id) setCategoryId(id);
          setShowCat(false);
        }}
      />
      <DatePicker
        open={showDate}
        value={date}
        onClose={() => setShowDate(false)}
        onPick={(d) => {
          setDate(d);
          setShowDate(false);
        }}
      />
    </>
  );
}
