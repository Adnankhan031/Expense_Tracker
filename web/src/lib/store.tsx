'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabaseBrowser } from './supabase/client';
import * as q from './queries';
import { formatMoney, todayLocal } from './format';
import type { Account, Alias, Budget, Category, TxnView } from './types';

type NumberStyle = 'indian' | 'international';

type Store = {
  /** The layout redirects to /login before rendering, so this is always set. */
  user: User;
  loading: boolean;
  error: string | null;
  categories: Category[];
  accounts: Account[];
  txns: TxnView[];
  aliases: Alias[];
  aliasMap: Map<string, string>;
  budgets: Budget[];
  currency: string;
  numberStyle: NumberStyle;
  pinnedDate: string;
  setPinnedDate: (d: string) => void;
  setCurrency: (c: string) => void;
  setNumberStyle: (s: NumberStyle) => void;
  fmt: (minor: number) => string;
  fmtCompact: (minor: number) => string;
  refresh: () => Promise<void>;
};

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ user, children }: { user: User; children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [txns, setTxns] = useState<TxnView[]>([]);
  const [aliases, setAliases] = useState<Alias[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [currency, setCurrencyState] = useState('₹');
  const [numberStyle, setNumberStyleState] = useState<NumberStyle>('indian');
  const [pinnedDate, setPinnedDate] = useState(todayLocal());

  const refresh = useCallback(async () => {
    try {
      setError(null);
      await q.ensureSeeded(user.id);
      const [cats, accs, rows, als, buds, settings] = await Promise.all([
        q.fetchCategories(),
        q.fetchAccounts(),
        q.fetchTxns(),
        q.fetchAliases(),
        q.fetchBudgets(),
        q.fetchSettings(),
      ]);
      setCategories(cats);
      setAccounts(accs);
      setTxns(q.withCategory(rows, cats));
      setAliases(als);
      setBudgets(buds);
      if (settings.currency) setCurrencyState(settings.currency);
      if (settings.numberStyle) setNumberStyleState(settings.numberStyle as NumberStyle);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setCurrency = useCallback(
    (c: string) => {
      setCurrencyState(c);
      void q.setSetting(user.id, 'currency', c);
    },
    [user.id]
  );

  const setNumberStyle = useCallback(
    (s: NumberStyle) => {
      setNumberStyleState(s);
      void q.setSetting(user.id, 'numberStyle', s);
    },
    [user.id]
  );

  const aliasMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of aliases) m.set(a.keyword, a.category_id);
    return m;
  }, [aliases]);

  const fmt = useCallback(
    (minor: number) => formatMoney(minor, { symbol: currency, style: numberStyle }),
    [currency, numberStyle]
  );
  const fmtCompact = useCallback(
    (minor: number) => formatMoney(minor, { symbol: currency, style: numberStyle, compact: true }),
    [currency, numberStyle]
  );

  const value: Store = {
    user,
    loading,
    error,
    categories,
    accounts,
    txns,
    aliases,
    aliasMap,
    budgets,
    currency,
    numberStyle,
    pinnedDate,
    setPinnedDate,
    setCurrency,
    setNumberStyle,
    fmt,
    fmtCompact,
    refresh,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}

export async function signOut() {
  await supabaseBrowser().auth.signOut();
  window.location.href = '/login';
}
