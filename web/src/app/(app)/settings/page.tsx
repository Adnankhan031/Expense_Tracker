'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { signOut, useStore } from '@/lib/store';
import * as q from '@/lib/queries';
import { Button, Card, Chip, Divider, IconBadge, Row, SectionTitle, Segmented, cx, inputClass } from '@/components/ui';
import { HBar } from '@/components/charts';
import { CATEGORY_COLORS } from '@/lib/colors';
import { currentMonth, dayLabel, monthEnd, monthLabel, monthStart, toMinor } from '@/lib/format';
import { totalsByCategory } from '@/lib/analytics';
import type { Category } from '@/lib/types';

type Panel = 'none' | 'categories' | 'budgets' | 'accounts' | 'learned';
type ThemeMode = 'system' | 'light' | 'dark';

export default function SettingsPage() {
  const store = useStore();
  const { user, txns, aliases, currency, setCurrency, numberStyle, setNumberStyle, refresh } = store;
  const [panel, setPanel] = useState<Panel>('none');
  const [theme, setTheme] = useState<ThemeMode>('dark');

  React.useEffect(() => {
    const saved = (localStorage.getItem('spendly-theme') as ThemeMode) || 'dark';
    setTheme(saved);
  }, []);

  const applyTheme = (mode: ThemeMode) => {
    setTheme(mode);
    localStorage.setItem('spendly-theme', mode);
    const light =
      mode === 'light' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: light)').matches);
    if (light) document.documentElement.dataset.theme = 'light';
    else delete document.documentElement.dataset.theme;
  };

  const since = txns.length ? txns[txns.length - 1].local_date : null;

  const exportCsv = () => {
    const header = 'date,type,category,amount,method,note,source\n';
    const body = txns
      .map((r) =>
        [
          r.local_date,
          r.type,
          `"${r.cat_name.replace(/"/g, '""')}"`,
          (r.amount_minor / 100).toFixed(2),
          r.method ?? '',
          `"${(r.note ?? '').replace(/"/g, '""')}"`,
          r.source,
        ].join(',')
      )
      .join('\n');
    const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `spendly-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const wipe = async () => {
    if (!confirm('Delete every transaction, chat message, budget and learned word? This cannot be undone.')) return;
    await q.wipeAllData(user.id);
    await refresh();
  };

  if (panel === 'categories') return <CategoriesPanel onBack={() => setPanel('none')} />;
  if (panel === 'budgets') return <BudgetsPanel onBack={() => setPanel('none')} />;
  if (panel === 'accounts') return <AccountsPanel onBack={() => setPanel('none')} />;
  if (panel === 'learned') return <LearnedPanel onBack={() => setPanel('none')} />;

  return (
    <div className="px-4 pb-8">
      <header className="pt-4">
        <h1 className="text-3xl font-extrabold tracking-tight">Settings</h1>
        <p className="mt-1 text-[13px] text-dim">
          {txns.length} entries{since ? ` since ${dayLabel(since)}` : ''} · {aliases.length} learned words
        </p>
        <p className="mt-0.5 text-[12px] text-faint">{user.email}</p>
      </header>

      <SectionTitle>Catching up</SectionTitle>
      <Link href="/backfill" className="block">
        <Card>
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-lg">🕘</span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15.5px] font-bold">Add past months</span>
              <span className="mt-0.5 block text-[12.5px] leading-5 text-dim">
                Lump sum per category, paste a whole list, or pin the chat to an older day.
              </span>
            </span>
            <span className="text-faint">›</span>
          </div>
        </Card>
      </Link>

      <SectionTitle>Appearance</SectionTitle>
      <Card>
        <p className="mb-2 text-xs font-semibold text-dim">Theme</p>
        <Segmented
          options={[
            { value: 'system' as ThemeMode, label: 'System' },
            { value: 'light' as ThemeMode, label: 'Light' },
            { value: 'dark' as ThemeMode, label: 'Dark' },
          ]}
          value={theme}
          onChange={applyTheme}
        />

        <p className="mt-5 mb-2 text-xs font-semibold text-dim">Currency</p>
        <div className="flex flex-wrap gap-2">
          {['₹', '$', '€', '£', '¥', 'AED', '₦'].map((c) => (
            <Chip key={c} label={c} active={currency === c} onClick={() => setCurrency(c)} />
          ))}
        </div>

        <p className="mt-5 mb-2 text-xs font-semibold text-dim">Number grouping</p>
        <Segmented
          options={[
            { value: 'indian' as const, label: '1,00,000' },
            { value: 'international' as const, label: '100,000' },
          ]}
          value={numberStyle}
          onChange={setNumberStyle}
        />
      </Card>

      <SectionTitle>Manage</SectionTitle>
      <Card>
        <Row title="Categories" subtitle="Add, rename, recolour, or hide" right={<span className="text-faint">›</span>} onClick={() => setPanel('categories')} />
        <Divider />
        <Row title="Budgets" subtitle="Monthly caps overall and per category" right={<span className="text-faint">›</span>} onClick={() => setPanel('budgets')} />
        <Divider />
        <Row title="Accounts" subtitle="Cash, bank, card, wallet" right={<span className="text-faint">›</span>} onClick={() => setPanel('accounts')} />
        <Divider />
        <Row
          title="Learned words"
          subtitle={`${aliases.length} words mapped to categories`}
          right={<span className="text-faint">›</span>}
          onClick={() => setPanel('learned')}
        />
      </Card>

      <SectionTitle>Data</SectionTitle>
      <Card>
        <Row title="Export as CSV" subtitle="Download every entry as a spreadsheet" onClick={exportCsv} />
        <Divider />
        <Row title="Delete all data" subtitle="Cannot be undone" danger onClick={wipe} />
      </Card>

      <SectionTitle>Account</SectionTitle>
      <Card>
        <Row title="Sign out" subtitle={user.email ?? ''} onClick={() => void signOut()} />
      </Card>

      <p className="mt-8 text-center text-[11.5px] leading-5 text-faint">
        Synced to your Supabase project.
        <br />
        Add this page to your Home Screen for a fullscreen app.
      </p>
    </div>
  );
}

/* --------------------------------------------------------------- categories */

function PanelHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <header className="flex items-center gap-2 pt-4 pb-2">
      <button type="button" onClick={onBack} className="-ml-2 px-2 text-2xl text-dim">
        ‹
      </button>
      <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
    </header>
  );
}

const ICON_CHOICES = [
  '🍜', '🛒', '🚕', '⛽', '💡', '🏠', '🛍️', '🩺', '🎬', '🔁', '✈️', '📚',
  '💇', '🎁', '⚡', '👨‍👩‍👧', '📈', '🏦', '📦', '💰', '💼', '🪙', '↩️', '✨',
  '☕', '🍺', '🐶', '🎮', '🚗', '📱', '💊', '🧾',
];

function CategoriesPanel({ onBack }: { onBack: () => void }) {
  const { categories, user, refresh } = useStore();
  const [editing, setEditing] = useState<Category | null>(null);
  const [creating, setCreating] = useState(false);
  const [showHidden, setShowHidden] = useState(false);

  const list = categories.filter((c) => (showHidden ? true : !c.archived));

  return (
    <div className="px-4 pb-8">
      <PanelHeader title="Categories" onBack={onBack} />
      <p className="text-[13px] leading-5 text-dim">
        Keywords are what the chat parser looks for. Add the words you actually type — shop names, nicknames, anything.
      </p>

      <div className="mt-3 flex gap-2">
        <Chip label="＋ New category" active onClick={() => setCreating(true)} />
        <Chip label={showHidden ? 'Hide hidden' : 'Show hidden'} onClick={() => setShowHidden(!showHidden)} />
      </div>

      {(['expense', 'income'] as const).map((kind) => (
        <React.Fragment key={kind}>
          <SectionTitle>{kind === 'expense' ? 'Expense' : 'Income'}</SectionTitle>
          <Card>
            {list
              .filter((c) => c.kind === kind)
              .map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setEditing(c)}
                  className={cx('flex w-full items-center gap-3 py-2.5 text-left', c.archived && 'opacity-45')}
                >
                  <IconBadge icon={c.icon} color={c.color} size={36} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold">{c.name}</span>
                    <span className="block truncate text-[11px] text-faint">
                      {c.archived ? 'Hidden · ' : ''}
                      {c.keywords.split('|').filter(Boolean).slice(0, 4).join(', ') || 'no keywords'}
                    </span>
                  </span>
                  <span className="text-faint">›</span>
                </button>
              ))}
          </Card>
        </React.Fragment>
      ))}

      <CategoryEditor
        open={!!editing || creating}
        category={editing}
        onClose={() => {
          setEditing(null);
          setCreating(false);
        }}
        onSaved={async () => {
          await refresh();
          setEditing(null);
          setCreating(false);
        }}
        userId={user.id}
      />
    </div>
  );
}

function CategoryEditor({
  open,
  category,
  userId,
  onClose,
  onSaved,
}: {
  open: boolean;
  category: Category | null;
  userId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('📦');
  const [color, setColor] = useState(CATEGORY_COLORS[0]);
  const [kind, setKind] = useState<'expense' | 'income'>('expense');
  const [keywords, setKeywords] = useState('');
  const [busy, setBusy] = useState(false);

  React.useEffect(() => {
    if (!open) return;
    setName(category?.name ?? '');
    setIcon(category?.icon ?? '📦');
    setColor(category?.color ?? CATEGORY_COLORS[0]);
    setKind(category?.kind ?? 'expense');
    setKeywords((category?.keywords ?? '').split('|').filter(Boolean).join(', '));
  }, [open, category]);

  if (!open) return null;

  const save = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await q.saveCategory(userId, {
        id: category?.id,
        name: name.trim(),
        icon,
        color,
        kind,
        keywords: keywords
          .split(',')
          .map((k) => k.trim().toLowerCase())
          .filter(Boolean)
          .join('|'),
      });
      onSaved();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/60" />
      <div className="rise safe-b relative max-h-[88dvh] overflow-y-auto rounded-t-3xl border-t border-line bg-elev p-4">
        <h2 className="mb-3 text-[17px] font-bold">{category ? 'Edit category' : 'New category'}</h2>
        <div className="flex flex-col gap-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className={inputClass} />
          <div className="flex gap-2">
            <Chip label="Expense" active={kind === 'expense'} onClick={() => setKind('expense')} />
            <Chip label="Income" active={kind === 'income'} onClick={() => setKind('income')} />
          </div>

          <p className="text-xs font-semibold text-dim">Icon</p>
          <div className="flex flex-wrap gap-1.5">
            {ICON_CHOICES.map((ic) => (
              <button
                key={ic}
                type="button"
                onClick={() => setIcon(ic)}
                className="grid size-10 place-items-center rounded-xl text-lg"
                style={{
                  background: icon === ic ? color + '33' : 'var(--color-card-alt)',
                  outline: icon === ic ? `1.5px solid ${color}` : undefined,
                }}
              >
                {ic}
              </button>
            ))}
          </div>

          <p className="text-xs font-semibold text-dim">Colour</p>
          <div className="flex flex-wrap gap-2">
            {CATEGORY_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className="size-8 rounded-[10px]"
                style={{ background: c, outline: color === c ? '3px solid var(--color-ink)' : undefined }}
              />
            ))}
          </div>

          <p className="text-xs font-semibold text-dim">Keywords (comma separated)</p>
          <textarea
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            rows={3}
            placeholder="swiggy, zomato, lunch, dinner"
            className={cx(inputClass, 'resize-y')}
          />

          <Button onClick={save} loading={busy}>
            Save
          </Button>
          {category && (
            <Button
              variant="ghost"
              onClick={async () => {
                await q.setCategoryArchived(category.id, !category.archived);
                onSaved();
              }}
            >
              {category.archived ? 'Unhide category' : 'Hide category'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ budgets */

function BudgetsPanel({ onBack }: { onBack: () => void }) {
  const { categories, budgets, txns, currency, fmt, user, refresh } = useStore();
  const ym = currentMonth();
  const [values, setValues] = useState<Record<string, string>>(() => {
    const next: Record<string, string> = {};
    for (const b of budgets) next[b.category_id ?? '__all__'] = String(b.amount_minor / 100);
    return next;
  });
  const [busy, setBusy] = useState(false);

  const spent = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of totalsByCategory(txns, monthStart(ym), monthEnd(ym), 'expense')) map.set(c.category_id, c.total);
    return map;
  }, [txns, ym]);
  const totalSpent = useMemo(() => [...spent.values()].reduce((a, b) => a + b, 0), [spent]);

  const save = async () => {
    setBusy(true);
    try {
      await q.setBudget(user.id, null, values['__all__'] ? toMinor(Number(values['__all__'])) : 0);
      for (const c of categories) {
        await q.setBudget(user.id, c.id, values[c.id] ? toMinor(Number(values[c.id])) : 0);
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const field = (key: string) => (
    <span className="flex w-28 items-center rounded-lg bg-card-alt px-2.5">
      <span className="text-sm text-faint">{currency}</span>
      <input
        value={values[key] ?? ''}
        onChange={(e) => setValues((s) => ({ ...s, [key]: e.target.value.replace(/[^0-9.]/g, '') }))}
        inputMode="decimal"
        placeholder="—"
        className="tabular w-full bg-transparent py-2 pl-1 text-right text-[15px] font-bold outline-none"
      />
    </span>
  );

  const overall = Number(values['__all__'] || 0);

  return (
    <div className="px-4 pb-8">
      <PanelHeader title="Budgets" onBack={onBack} />
      <p className="text-[13px] leading-5 text-dim">
        Monthly caps. Leave a category blank for no limit. You will see progress on Overview and a nudge once you cross
        80%.
      </p>

      <SectionTitle>Overall budget</SectionTitle>
      <Card>
        <div className="flex items-center gap-3">
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold">Everything, {monthLabel(ym, true)}</span>
            <span className="block text-[11.5px] text-faint">Spent so far: {fmt(totalSpent)}</span>
          </span>
          {field('__all__')}
        </div>
        {overall > 0 && (
          <div className="mt-3">
            <HBar
              fraction={totalSpent / toMinor(overall)}
              height={9}
              color={
                totalSpent >= toMinor(overall)
                  ? 'var(--color-danger)'
                  : totalSpent >= toMinor(overall) * 0.8
                    ? 'var(--color-warn)'
                    : 'var(--color-accent)'
              }
            />
          </div>
        )}
      </Card>

      <SectionTitle>Per category</SectionTitle>
      <Card>
        {categories
          .filter((c) => c.kind === 'expense' && !c.archived)
          .map((c) => {
            const limit = Number(values[c.id] || 0);
            const used = spent.get(c.id) ?? 0;
            return (
              <div key={c.id} className="py-2">
                <div className="flex items-center gap-2.5">
                  <IconBadge icon={c.icon} color={c.color} size={34} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-semibold">{c.name}</span>
                    {used > 0 && <span className="block text-[11px] text-faint">{fmt(used)} used</span>}
                  </span>
                  {field(c.id)}
                </div>
                {limit > 0 && (
                  <div className="mt-2 ml-11">
                    <HBar
                      fraction={used / toMinor(limit)}
                      color={
                        used >= toMinor(limit)
                          ? 'var(--color-danger)'
                          : used >= toMinor(limit) * 0.8
                            ? 'var(--color-warn)'
                            : c.color
                      }
                    />
                  </div>
                )}
              </div>
            );
          })}
      </Card>

      <Button onClick={save} loading={busy} className="mt-4">
        Save budgets
      </Button>
    </div>
  );
}

/* ----------------------------------------------------------------- accounts */

function AccountsPanel({ onBack }: { onBack: () => void }) {
  const { accounts, txns, fmt, user, refresh } = useStore();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const totals = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of txns) {
      if (!t.account_id) continue;
      map.set(t.account_id, (map.get(t.account_id) ?? 0) + (t.type === 'income' ? t.amount_minor : -t.amount_minor));
    }
    return map;
  }, [txns]);

  return (
    <div className="px-4 pb-8">
      <PanelHeader title="Accounts" onBack={onBack} />
      <p className="text-[13px] leading-5 text-dim">
        Tag entries with where the money came from. The number below is income minus expenses for that account, not a
        bank balance.
      </p>

      <SectionTitle>Accounts</SectionTitle>
      <Card>
        {accounts.map((a, i) => {
          const net = totals.get(a.id) ?? 0;
          return (
            <div key={a.id} className={cx('flex items-center gap-3 py-3', i > 0 && 'border-t border-line')}>
              <IconBadge icon={a.icon} color="#63A9FF" size={36} />
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold">{a.name}</span>
                <span className="block text-[11.5px] capitalize text-faint">{a.kind}</span>
              </span>
              <span className={cx('tabular text-sm font-bold', net >= 0 ? 'text-accent' : 'text-danger')}>
                {net > 0 ? '+' : ''}
                {fmt(net)}
              </span>
              <button
                type="button"
                aria-label={`Remove ${a.name}`}
                onClick={async () => {
                  await q.archiveAccount(a.id);
                  await refresh();
                }}
                className="pl-1 text-faint"
              >
                ✕
              </button>
            </div>
          );
        })}
      </Card>

      <SectionTitle>Add an account</SectionTitle>
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          className={cx(inputClass, 'flex-1')}
        />
        <Button
          className="w-auto px-5"
          loading={busy}
          disabled={!name.trim()}
          onClick={async () => {
            setBusy(true);
            try {
              await q.saveAccount(user.id, { name: name.trim(), kind: 'cash', icon: '💵' });
              setName('');
              await refresh();
            } finally {
              setBusy(false);
            }
          }}
        >
          Add
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ learned words */

function LearnedPanel({ onBack }: { onBack: () => void }) {
  const { aliases, categories, refresh } = useStore();

  return (
    <div className="px-4 pb-8">
      <PanelHeader title="Learned words" onBack={onBack} />
      <p className="text-[13px] leading-5 text-dim">
        Every time you correct a category, the word you typed gets bound to it. That is why the app gets faster the
        longer you use it.
      </p>

      <SectionTitle>{aliases.length} words</SectionTitle>
      <Card>
        {aliases.length === 0 && (
          <p className="py-6 text-center text-[13px] text-dim">
            Nothing learned yet. Correct a category on any entry and the word you typed is remembered here.
          </p>
        )}
        {aliases.map((a, i) => {
          const cat = categories.find((c) => c.id === a.category_id);
          return (
            <div key={a.id} className={cx('flex items-center gap-2.5 py-2.5', i > 0 && 'border-t border-line')}>
              <IconBadge icon={cat?.icon ?? '📦'} color={cat?.color ?? '#90A4AE'} size={30} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14.5px] font-semibold">{a.keyword}</span>
                <span className="block truncate text-[11.5px] text-faint">
                  → {cat?.name ?? 'Unknown'} · used {a.hits}×
                </span>
              </span>
              <button
                type="button"
                aria-label={`Forget ${a.keyword}`}
                onClick={async () => {
                  await q.deleteAlias(a.id);
                  await refresh();
                }}
                className="text-faint"
              >
                ✕
              </button>
            </div>
          );
        })}
      </Card>
    </div>
  );
}
