'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '@/lib/store';
import * as q from '@/lib/queries';
import { parseInput } from '@/lib/parser';
import { runQuery, type Answer } from '@/lib/analytics';
import { DatePicker } from '@/components/pickers';
import { TxnEditor } from '@/components/TxnEditor';
import { IconTile } from '@/lib/icons';
import { ArrowUp, MessageSquareText, Plus, Trash2, X } from 'lucide-react';
import { Chip, EmptyState, Spinner, cx } from '@/components/ui';
import { dayLabel, shortDayLabel, todayLocal } from '@/lib/format';
import type { ChatMessage, TxnView } from '@/lib/types';

const HINTS = ['food 300', 'groceries 2400 and auto 80', 'petrol 1500 on 5th', 'salary 45000 received'];

export default function AddPage() {
  const store = useStore();
  const { categories, aliasMap, pinnedDate, setPinnedDate, txns, user, fmt, refresh, loading } = store;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showDate, setShowDate] = useState(false);
  const [editing, setEditing] = useState<TxnView | null>(null);
  const [creating, setCreating] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    void q.fetchMessages().then(setMessages).catch(() => {});
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  const txnById = useMemo(() => new Map(txns.map((t) => [t.id, t])), [txns]);
  const today = todayLocal();
  const todayTotal = txns.reduce(
    (a, t) => (t.local_date === today && t.type === 'expense' ? a + t.amount_minor : a),
    0
  );
  const pinnedIsToday = pinnedDate === today;

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    setSending(true);
    try {
      const mine = await q.addMessage(user.id, { role: 'user', kind: 'text', text });
      setMessages((m) => [...m, mine]);

      const result = parseInput(text, {
        categories,
        aliases: aliasMap,
        defaultDate: pinnedDate,
        today: todayLocal(),
      });

      const added: ChatMessage[] = [];

      if (result.kind === 'entries') {
        for (const e of result.entries) {
          const row = await q.insertTxn(user.id, {
            amount_minor: e.amountMinor,
            type: e.type,
            category_id: e.categoryId,
            local_date: e.date,
            method: e.method,
            note: e.note,
            raw_input: e.raw,
            source: 'chat',
            confidence: e.confidence,
          });
          if (e.learnToken && e.confidence >= 0.9) await q.learnAlias(user.id, e.learnToken, e.categoryId);
          added.push(await q.addMessage(user.id, { role: 'app', kind: 'txn', text: '', txn_id: row.id }));
        }
      } else if (result.kind === 'query') {
        const answer = runQuery(result.query, txns, fmt);
        added.push(
          await q.addMessage(user.id, { role: 'app', kind: 'answer', text: answer.headline, payload: answer })
        );
      } else {
        added.push(
          await q.addMessage(user.id, {
            role: 'app',
            kind: 'note',
            text: 'I could not find an amount in that. Try something like "food 300".',
          })
        );
      }

      setMessages((m) => [...m, ...added]);
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setMessages((m) => [
        ...m,
        {
          id: 'err-' + Date.now(),
          user_id: user.id,
          role: 'app',
          kind: 'note',
          text: `Could not save that: ${message}`,
          txn_id: null,
          payload: null,
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
    }
  }, [input, sending, categories, aliasMap, pinnedDate, user.id, txns, fmt, refresh]);

  const removeTxn = async (msg: ChatMessage) => {
    if (msg.txn_id) await q.softDeleteTxn(msg.txn_id);
    await q.deleteMessage(msg.id);
    setMessages((m) => m.filter((x) => x.id !== msg.id));
    await refresh();
  };

  const clearThread = async () => {
    await q.clearMessages(user.id);
    setMessages([]);
  };

  return (
    <div className="flex min-h-[calc(100dvh-72px)] flex-col">
      {/* header */}
      <header className="sticky top-0 z-20 bg-bg/95 px-4 pt-3 pb-2 backdrop-blur-lg">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <p className="text-xs font-semibold text-dim">Spent today</p>
            <p className="tabular text-2xl font-extrabold">{fmt(todayTotal)}</p>
          </div>
          <button
            type="button"
            onClick={() => setCreating(true)}
            aria-label="Add manually"
            className="grid size-9 place-items-center rounded-xl bg-sunken text-dim active:scale-95"
          >
            <Plus size={18} />
          </button>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={clearThread}
              aria-label="Clear thread"
              className="grid size-9 place-items-center rounded-xl bg-sunken text-dim active:scale-95"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowDate(true)}
            className={cx(
              'rounded-full px-3 py-1.5 text-[12.5px] font-bold transition active:scale-95',
              pinnedIsToday ? 'bg-sunken text-dim' : 'bg-brand-soft text-brand'
            )}
          >
            Adding to · {dayLabel(pinnedDate)}
          </button>
          {!pinnedIsToday && <Chip label="Reset" small onClick={() => setPinnedDate(today)} />}
        </div>
      </header>

      {/* thread */}
      <div className="flex flex-1 flex-col gap-2 px-4 pb-4">
        {loading && messages.length === 0 && (
          <div className="grid flex-1 place-items-center text-dim">
            <Spinner />
          </div>
        )}

        {!loading && messages.length === 0 && (
          <div className="flex flex-1 flex-col justify-center">
            <EmptyState
              icon={MessageSquareText}
              title="Type what you spent"
              body="No forms. Write it the way you would say it — the amount, what it was for, and a date if it was not today."
            />
            <div className="flex flex-col items-center gap-2">
              {HINTS.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => {
                    setInput(h);
                    taRef.current?.focus();
                  }}
                  className="rounded-full bg-sunken px-3.5 py-2 text-[13px] text-dim active:scale-95"
                >
                  {h}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => {
          if (m.role === 'user') {
            return (
              <div key={m.id} className="rise max-w-[84%] self-end">
                <div className="rounded-2xl rounded-br-sm bg-brand px-3.5 py-2.5 text-[15px] font-semibold text-on-brand">
                  {m.text}
                </div>
              </div>
            );
          }

          if (m.kind === 'txn') {
            const tx = m.txn_id ? txnById.get(m.txn_id) : undefined;
            if (!tx) return null;
            return (
              <div key={m.id} className="rise w-[92%] self-start">
                <div
                  className="rounded-2xl rounded-bl-sm border border-line bg-surface p-3"
                  style={{ borderLeft: `3px solid ${tx.cat_color}` }}
                >
                  <div className="flex items-center gap-2">
                    <IconTile name={tx.cat_icon} color={tx.cat_color} size={32} />
                    <button
                      type="button"
                      onClick={() => setEditing(tx)}
                      className="min-w-0 flex-1 text-left active:opacity-70"
                    >
                      <span className="block truncate text-[14.5px] font-bold">{tx.cat_name}</span>
                      {tx.note && <span className="block truncate text-xs text-dim">{tx.note}</span>}
                    </button>
                    <span
                      className={cx('tabular text-[17px] font-bold', tx.type === 'income' && 'text-brand')}
                    >
                      {tx.type === 'income' ? '+' : ''}
                      {fmt(tx.amount_minor)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeTxn(m)}
                      aria-label="Delete"
                      className="pl-1 text-faint active:opacity-60"
                    >
                      <X size={15} />
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <MiniChip label={shortDayLabel(tx.local_date)} tone="accent" />
                    {tx.method && <MiniChip label={tx.method} />}
                    {tx.confidence < 0.6 && <MiniChip label="tap to fix" tone="warn" />}
                  </div>
                </div>
              </div>
            );
          }

          if (m.kind === 'answer') {
            const a = m.payload as Answer | null;
            if (!a) return null;
            const max = Math.max(1, ...a.bars.map((b) => b.value));
            return (
              <div key={m.id} className="rise w-[94%] self-start rounded-2xl rounded-bl-sm border border-line bg-surface p-3.5">
                <p className="text-[11.5px] font-bold uppercase tracking-wider text-dim">{a.headline}</p>
                <p className="tabular mt-1 text-3xl font-extrabold">{a.value}</p>
                <p className="mt-1 text-[13px] leading-5 text-dim">{a.detail}</p>
                {a.bars.length > 1 && (
                  <div className="mt-3 flex h-9 items-end gap-0.5">
                    {a.bars.map((b, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-sm bg-brand"
                        style={{
                          height: Math.max(2, (b.value / max) * 36),
                          opacity: b.value === 0 ? 0.15 : b.highlight ? 1 : 0.5,
                        }}
                      />
                    ))}
                  </div>
                )}
                {a.breakdown.length > 0 && (
                  <div className="mt-3 flex flex-col gap-1.5">
                    {a.breakdown.map((b, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="size-2 rounded-sm" style={{ background: b.color }} />
                        <span className="flex-1 truncate text-[12.5px] text-dim">{b.name}</span>
                        <span className="tabular text-[12.5px] font-semibold text-dim">{fmt(b.total)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          return (
            <div key={m.id} className="rise max-w-[88%] self-start">
              <div className="rounded-2xl rounded-bl-sm bg-sunken px-3.5 py-2.5 text-[13.5px] leading-5 text-dim">
                {m.text}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* composer */}
      <div className="safe-b sticky bottom-[calc(72px+env(safe-area-inset-bottom,0px))] z-20 border-t border-line bg-surface px-3 py-2.5">
        <div className="mx-auto flex max-w-2xl items-end gap-2">
          <textarea
            ref={taRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            rows={1}
            placeholder={pinnedIsToday ? 'food 300' : `Adding to ${dayLabel(pinnedDate)}…`}
            className="max-h-28 flex-1 resize-none rounded-[20px] bg-sunken px-4 py-2.5 text-[15.5px] outline-none"
          />
          <button
            type="button"
            onClick={send}
            disabled={!input.trim() || sending}
            aria-label="Send"
            className={cx(
              'grid size-10 shrink-0 place-items-center rounded-full text-lg transition active:scale-95',
              input.trim() ? 'bg-brand text-on-brand' : 'bg-sunken text-faint'
            )}
          >
            {sending ? <Spinner /> : <ArrowUp size={18} />}
          </button>
        </div>
      </div>

      <DatePicker
        open={showDate}
        value={pinnedDate}
        title="Add entries to…"
        onClose={() => setShowDate(false)}
        onPick={(d) => {
          setPinnedDate(d);
          setShowDate(false);
        }}
      />
      <TxnEditor open={!!editing} txn={editing} onClose={() => setEditing(null)} />
      <TxnEditor open={creating} seed={{ local_date: pinnedDate }} onClose={() => setCreating(false)} />
    </div>
  );
}

function MiniChip({ label, tone }: { label: string; tone?: 'accent' | 'warn' }) {
  return (
    <span
      className={cx(
        'rounded-full px-2 py-0.5 text-[10.5px] font-bold',
        tone === 'accent' && 'bg-brand-soft text-brand',
        tone === 'warn' && 'bg-down-soft text-down',
        !tone && 'bg-sunken text-dim'
      )}
    >
      {label}
    </span>
  );
}
