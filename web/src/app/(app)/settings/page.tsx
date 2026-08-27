'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  ChevronRight,
  CirclePlus,
  Eye,
  EyeOff,
  FileSpreadsheet,
  FileText,
  FileDown,
  Gauge,
  ListPlus,
  LogOut,
  Monitor,
  Moon,
  Sparkles,
  Sun,
  Tags,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';
import { signOut, useStore } from '@/lib/store';
import * as q from '@/lib/queries';
import { Button, Card, Chip, Divider, PageTitle, Row, SectionTitle, Segmented, cx, inputClass } from '@/components/ui';
import { HBar } from '@/components/charts';
import { CategoryIcon, ICON_CHOICES, IconTile } from '@/lib/icons';
import { CATEGORY_COLORS } from '@/lib/colors';
import { CURRENCIES } from '@/lib/currency';
import { exportCsv, exportPdf, exportXlsx } from '@/lib/export';
import { currentMonth, dayLabel, monthEnd, monthLabel, monthStart, toMinor } from '@/lib/format';
import { totalsByCategory } from '@/lib/analytics';
import type { Category } from '@/lib/types';

type Panel = 'none' | 'categories' | 'budgets' | 'accounts' | 'learned';
type ThemeMode = 'system' | 'light' | 'dark';

export default function SettingsPage() {
  const { user, txns, aliases, currency, setCurrencyCode, refresh } = useStore();
  const [panel, setPanel] = useState<Panel>('none');
  const [theme, setTheme] = useState<ThemeMode>('dark');
  const [busy, setBusy] = useState<string | null>(null);

  React.useEffect(() => {
    setTheme((localStorage.getItem('spendly-theme') as ThemeMode) || 'dark');
  }, []);

  const applyTheme = (mode: ThemeMode) => {
    setTheme(mode);
    localStorage.setItem('spendly-theme', mode);
    const light = mode === 'light' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: light)').matches);
    if (light) document.documentElement.dataset.theme = 'light';
    else delete document.documentElement.dataset.theme;
  };

  const since = txns.length ? txns[txns.length - 1].local_date : null;

  const meta = useMemo(() => {
    const from = txns.length ? txns[txns.length - 1].local_date : monthStart(currentMonth());
    const to = txns.length ? txns[0].local_date : monthEnd(currentMonth());
    return {
      currency,
      label: 'All time',
      from,
      to,
      expense: txns.filter((t) => t.type === 'expense').reduce((a, b) => a + b.amount_minor, 0),
      income: txns.filter((t) => t.type === 'income').reduce((a, b) => a + b.amount_minor, 0),
      byCategory: totalsByCategory(txns, from, to, 'expense'),
    };
  }, [txns, currency]);

  const run = async (kind: string, fn: () => void | Promise<void>) => {
    if (!txns.length) {
      alert('Nothing to export yet — add a few entries first.');
      return;
    }
    setBusy(kind);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
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
    <div className="px-4 pb-10">
      <PageTitle
        title="Settings"
        subtitle={`${txns.length} entries${since ? ` since ${dayLabel(since)}` : ''} · ${aliases.length} learned words`}
      />
      <p className="mt-1 text-[12px] text-faint">{user.email}</p>

      <SectionTitle>Adding entries</SectionTitle>
      <Link href="/manual" className="block">
        <Card tone="brand">
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
              <ListPlus size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15.5px] font-bold">Add by day, week or month</span>
              <span className="mt-0.5 block text-[12.5px] leading-5 text-dim">
                Full manual control for any date — including months from before you started.
              </span>
            </span>
            <ChevronRight size={17} className="text-faint" />
          </div>
        </Card>
      </Link>

      <SectionTitle>Appearance</SectionTitle>
      <Card>
        <p className="mb-2 text-xs font-semibold text-dim">Theme</p>
        <div className="flex gap-1 rounded-xl border border-line bg-sunken p-1">
          {(
            [
              ['system', 'System', Monitor],
              ['light', 'Light', Sun],
              ['dark', 'Dark', Moon],
            ] as const
          ).map(([mode, label, Icon]) => (
            <button
              key={mode}
              type="button"
              onClick={() => applyTheme(mode)}
              className={cx(
                'flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[13px] font-bold transition',
                theme === mode ? 'bg-brand text-on-brand' : 'text-dim'
              )}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        <p className="mt-5 mb-2 text-xs font-semibold text-dim">Currency</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {CURRENCIES.map((c) => (
            <button
              key={c.code}
              type="button"
              onClick={() => setCurrencyCode(c.code)}
              className={cx(
                'flex items-center gap-2 rounded-xl border p-2.5 text-left transition active:scale-95',
                currency.code === c.code ? 'border-brand bg-brand-soft' : 'border-line bg-sunken'
              )}
            >
              <span
                className={cx(
                  'tabular grid size-8 shrink-0 place-items-center rounded-lg text-[15px] font-bold',
                  currency.code === c.code ? 'bg-brand text-on-brand' : 'bg-raised text-dim'
                )}
              >
                {c.symbol.trim()}
              </span>
              <span className="min-w-0">
                <span className="block text-[12.5px] font-bold">{c.code}</span>
                <span className="block truncate text-[10.5px] text-faint">{c.name}</span>
              </span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] leading-4 text-faint">
          {currency.digits === 0
            ? `${currency.name} has no decimal places, so amounts show as whole ${currency.code}.`
            : `Grouped ${currency.grouping === 'indian' ? 'the Indian way (1,00,000)' : 'as 100,000'}.`}
        </p>
      </Card>

      <SectionTitle>Manage</SectionTitle>
      <Card>
        <Row
          icon={<Tags size={19} />}
          title="Categories"
          subtitle="Icons, colours, keywords"
          right={<ChevronRight size={17} className="text-faint" />}
          onClick={() => setPanel('categories')}
        />
        <Divider />
        <Row
          icon={<Gauge size={19} />}
          title="Budgets"
          subtitle="Monthly caps overall and per category"
          right={<ChevronRight size={17} className="text-faint" />}
          onClick={() => setPanel('budgets')}
        />
        <Divider />
        <Row
          icon={<Wallet size={19} />}
          title="Accounts"
          subtitle="Cash, bank, card, wallet"
          right={<ChevronRight size={17} className="text-faint" />}
          onClick={() => setPanel('accounts')}
        />
        <Divider />
        <Row
          icon={<Sparkles size={19} />}
          title="Learned words"
          subtitle={`${aliases.length} words mapped to categories`}
          right={<ChevronRight size={17} className="text-faint" />}
          onClick={() => setPanel('learned')}
        />
      </Card>

      <SectionTitle>Export</SectionTitle>
      <Card>
        <Row
          icon={<FileSpreadsheet size={19} />}
          title="Excel workbook"
          subtitle="Summary, every transaction, and a month-by-month sheet"
          right={busy === 'xlsx' ? <span className="text-[11px] text-dim">Working…</span> : <FileDown size={16} className="text-faint" />}
          onClick={() => run('xlsx', () => exportXlsx(txns, meta))}
        />
        <Divider />
        <Row
          icon={<FileText size={19} />}
          title="PDF report"
          subtitle="Formatted report with totals and category breakdown"
          right={busy === 'pdf' ? <span className="text-[11px] text-dim">Working…</span> : <FileDown size={16} className="text-faint" />}
          onClick={() => run('pdf', () => exportPdf(txns, meta))}
        />
        <Divider />
        <Row
          icon={<FileDown size={19} />}
          title="CSV"
          subtitle="Plain rows for any other tool"
          onClick={() => run('csv', () => exportCsv(txns, currency))}
        />
      </Card>

      <SectionTitle>Danger zone</SectionTitle>
      <Card>
        <Row icon={<Trash2 size={19} />} title="Delete all data" subtitle="Cannot be undone" danger onClick={wipe} />
        <Divider />
        <Row icon={<LogOut size={19} />} title="Sign out" subtitle={user.email ?? ''} onClick={() => void signOut()} />
      </Card>

      <p className="mt-8 text-center text-[11.5px] leading-5 text-faint">
        Synced to your Supabase project.
        <br />
        Add this page to your Home Screen for a fullscreen app.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ shared */

function PanelHeader({ title, onBack, action }: { title: string; onBack: () => void; action?: React.ReactNode }) {
  return (
    <header className="flex items-center gap-2 pt-5 pb-2">
      <button
        type="button"
        onClick={onBack}
        className="grid size-9 shrink-0 place-items-center rounded-lg bg-sunken text-dim active:scale-90"
      >
        <ChevronLeft size={18} />
      </button>
      <h1 className="flex-1 text-[24px] font-extrabold tracking-[-0.02em]">{title}</h1>
      {action}
    </header>
  );
}

/* -------------------------------------------------------------- categories */

function CategoriesPanel({ onBack }: { onBack: () => void }) {
  const { categories, user, refresh } = useStore();
  const [editing, setEditing] = useState<Category | null>(null);
  const [creating, setCreating] = useState(false);
  const [showHidden, setShowHidden] = useState(false);

  const list = categories.filter((c) => (showHidden ? true : !c.archived));

  return (
    <div className="px-4 pb-10">
      <PanelHeader
        title="Categories"
        onBack={onBack}
        action={
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="grid size-9 place-items-center rounded-lg bg-brand text-on-brand active:scale-90"
          >
            <CirclePlus size={18} />
          </button>
        }
      />
      <p className="text-[13px] leading-5 text-dim">
        Keywords are what the chat parser matches on. Add the words you actually type — shop names, nicknames, anything.
      </p>

      <div className="mt-3">
        <Chip
          label={showHidden ? 'Hide hidden' : 'Show hidden'}
          icon={showHidden ? EyeOff : Eye}
          onClick={() => setShowHidden(!showHidden)}
        />
      </div>

      {(['expense', 'income'] as const).map((kind) => (
        <React.Fragment key={kind}>
          <SectionTitle>{kind === 'expense' ? 'Expense' : 'Income'}</SectionTitle>
          <Card className="p-0">
            {list
              .filter((c) => c.kind === kind)
              .map((c, i) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setEditing(c)}
                  className={cx(
                    'flex w-full items-center gap-3 px-4 py-3 text-left transition active:opacity-70',
                    i > 0 && 'border-t border-line',
                    c.archived && 'opacity-45'
                  )}
                >
                  <IconTile name={c.icon} color={c.color} size={36} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold">{c.name}</span>
                    <span className="block truncate text-[11px] text-faint">
                      {c.archived ? 'Hidden · ' : ''}
                      {c.keywords.split('|').filter(Boolean).slice(0, 4).join(', ') || 'no keywords'}
                    </span>
                  </span>
                  <ChevronRight size={16} className="text-faint" />
                </button>
              ))}
          </Card>
        </React.Fragment>
      ))}

      <CategoryEditor
        open={!!editing || creating}
        category={editing}
        userId={user.id}
        onClose={() => {
          setEditing(null);
          setCreating(false);
        }}
        onSaved={async () => {
          await refresh();
          setEditing(null);
          setCreating(false);
        }}
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
  const [icon, setIcon] = useState('package');
  const [color, setColor] = useState(CATEGORY_COLORS[0]);
  const [kind, setKind] = useState<'expense' | 'income'>('expense');
  const [keywords, setKeywords] = useState('');
  const [busy, setBusy] = useState(false);

  React.useEffect(() => {
    if (!open) return;
    setName(category?.name ?? '');
    setIcon(category?.icon ?? 'package');
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
    <div className="fixed inset-0 z-50 flex flex-col justify-end sm:items-center sm:justify-center">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/65 backdrop-blur-[3px]" />
      <div className="sheet-in safe-b relative max-h-[88dvh] w-full overflow-y-auto rounded-t-3xl border-t border-line bg-raised p-4 shadow-[var(--shadow-pop)] sm:max-w-md sm:rounded-3xl sm:border">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="flex-1 text-[17px] font-bold">{category ? 'Edit category' : 'New category'}</h2>
          <button type="button" onClick={onClose} className="grid size-8 place-items-center rounded-lg bg-sunken text-dim">
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3 rounded-xl border border-line bg-sunken p-3">
            <IconTile name={icon} color={color} size={44} />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Category name"
              className="w-full bg-transparent text-[16px] font-bold outline-none"
            />
          </div>

          <div className="flex gap-2">
            <Chip label="Expense" active={kind === 'expense'} onClick={() => setKind('expense')} />
            <Chip label="Income" active={kind === 'income'} onClick={() => setKind('income')} />
          </div>

          <p className="text-xs font-semibold text-dim">Icon</p>
          <div className="grid max-h-44 grid-cols-8 gap-1.5 overflow-y-auto rounded-xl border border-line bg-sunken p-2">
            {ICON_CHOICES.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setIcon(n)}
                className="grid aspect-square place-items-center rounded-lg transition active:scale-90"
                style={
                  icon === n
                    ? { background: color + '2e', color, outline: `1.5px solid ${color}` }
                    : { background: 'var(--color-raised)', color: 'var(--color-dim)' }
                }
              >
                <CategoryIcon name={n} size={17} />
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
                aria-label={c}
                className="size-8 rounded-[10px] transition active:scale-90"
                style={{ background: c, outline: color === c ? '2.5px solid var(--color-ink)' : undefined, outlineOffset: 2 }}
              />
            ))}
          </div>

          <p className="text-xs font-semibold text-dim">Keywords (comma separated)</p>
          <textarea
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            rows={3}
            placeholder="lunch, dinner, cafe, restaurant"
            className={cx(inputClass, 'resize-y')}
          />

          <Button onClick={save} loading={busy} disabled={!name.trim()}>
            Save
          </Button>
          {category && (
            <Button
              variant="ghost"
              icon={category.archived ? Eye : EyeOff}
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
    <span className="flex w-28 items-center rounded-lg border border-line bg-sunken px-2.5">
      <span className="text-[13px] text-faint">{currency.symbol}</span>
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
    <div className="px-4 pb-10">
      <PanelHeader title="Budgets" onBack={onBack} />
      <p className="text-[13px] leading-5 text-dim">
        Monthly caps. Leave a category blank for no limit. Overview shows progress and nudges you past 80%.
      </p>

      <SectionTitle>Overall</SectionTitle>
      <Card>
        <div className="flex items-center gap-3">
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold">Everything, {monthLabel(ym, true)}</span>
            <span className="tabular block text-[11.5px] text-faint">Spent so far: {fmt(totalSpent)}</span>
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
                  ? 'var(--color-down)'
                  : totalSpent >= toMinor(overall) * 0.8
                    ? 'var(--color-warn)'
                    : 'var(--color-up)'
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
                  <IconTile name={c.icon} color={c.color} size={34} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-semibold">{c.name}</span>
                    {used > 0 && <span className="tabular block text-[11px] text-faint">{fmt(used)} used</span>}
                  </span>
                  {field(c.id)}
                </div>
                {limit > 0 && (
                  <div className="mt-2 ml-11">
                    <HBar
                      fraction={used / toMinor(limit)}
                      color={
                        used >= toMinor(limit)
                          ? 'var(--color-down)'
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
    <div className="px-4 pb-10">
      <PanelHeader title="Accounts" onBack={onBack} />
      <p className="text-[13px] leading-5 text-dim">
        Tag entries with where the money came from. The figure is income minus expenses for that account, not a bank
        balance.
      </p>

      <SectionTitle>Accounts</SectionTitle>
      <Card className="p-0">
        {accounts.map((a, i) => {
          const net = totals.get(a.id) ?? 0;
          return (
            <div key={a.id} className={cx('flex items-center gap-3 px-4 py-3', i > 0 && 'border-t border-line')}>
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-sunken text-info">
                <Wallet size={17} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold">{a.name}</span>
                <span className="block text-[11.5px] capitalize text-faint">{a.kind}</span>
              </span>
              <span className={cx('tabular text-sm font-bold', net >= 0 ? 'text-up' : 'text-down')}>
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
                className="text-faint active:scale-90"
              >
                <X size={16} />
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
          className="w-auto shrink-0 px-5"
          loading={busy}
          disabled={!name.trim()}
          onClick={async () => {
            setBusy(true);
            try {
              await q.saveAccount(user.id, { name: name.trim(), kind: 'cash', icon: 'wallet' });
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
    <div className="px-4 pb-10">
      <PanelHeader title="Learned words" onBack={onBack} />
      <p className="text-[13px] leading-5 text-dim">
        Every time you correct a category, the word you typed gets bound to it. That is why the app gets faster the
        longer you use it.
      </p>

      <SectionTitle>{aliases.length} words</SectionTitle>
      <Card className="p-0">
        {aliases.length === 0 && (
          <p className="px-4 py-8 text-center text-[13px] text-dim">
            Nothing learned yet. Correct a category on any entry and the word you typed is remembered here.
          </p>
        )}
        {aliases.map((a, i) => {
          const cat = categories.find((c) => c.id === a.category_id);
          return (
            <div key={a.id} className={cx('flex items-center gap-2.5 px-4 py-3', i > 0 && 'border-t border-line')}>
              <IconTile name={cat?.icon} color={cat?.color ?? '#8a9099'} size={32} />
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
                className="text-faint active:scale-90"
              >
                <X size={16} />
              </button>
            </div>
          );
        })}
      </Card>
    </div>
  );
}
