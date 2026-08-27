import { create } from 'zustand';
import {
  Account,
  Budget,
  Category,
  getSetting,
  listAccounts,
  listAliases,
  listBudgets,
  listCategories,
  setSetting,
} from './db';
import { todayLocal } from './format';

/* ------------------------------------------------------------------ */
/* settings                                                            */
/* ------------------------------------------------------------------ */

export type ThemeMode = 'system' | 'light' | 'dark';
export type NumberStyle = 'indian' | 'international';

type SettingsState = {
  themeMode: ThemeMode;
  currency: string;
  numberStyle: NumberStyle;
  hydrated: boolean;
  hydrate: () => void;
  setThemeMode: (m: ThemeMode) => void;
  setCurrency: (c: string) => void;
  setNumberStyle: (s: NumberStyle) => void;
};

export const useSettings = create<SettingsState>((set) => ({
  themeMode: 'dark',
  currency: '₹',
  numberStyle: 'indian',
  hydrated: false,
  hydrate: () =>
    set({
      themeMode: (getSetting('themeMode') as ThemeMode) ?? 'dark',
      currency: getSetting('currency') ?? '₹',
      numberStyle: (getSetting('numberStyle') as NumberStyle) ?? 'indian',
      hydrated: true,
    }),
  setThemeMode: (m) => {
    setSetting('themeMode', m);
    set({ themeMode: m });
  },
  setCurrency: (c) => {
    setSetting('currency', c);
    set({ currency: c });
  },
  setNumberStyle: (s) => {
    setSetting('numberStyle', s);
    set({ numberStyle: s });
  },
}));

/* ------------------------------------------------------------------ */
/* reference data + a version counter that screens subscribe to        */
/* ------------------------------------------------------------------ */

type DataState = {
  categories: Category[];
  accounts: Account[];
  budgets: Budget[];
  aliases: Map<string, string>;
  version: number;
  pinnedDate: string;
  defaultAccountId: string | null;
  reload: () => void;
  bump: () => void;
  setPinnedDate: (d: string) => void;
  setDefaultAccount: (id: string | null) => void;
};

export const useData = create<DataState>((set, get) => ({
  categories: [],
  accounts: [],
  budgets: [],
  aliases: new Map(),
  version: 0,
  pinnedDate: todayLocal(),
  defaultAccountId: null,
  reload: () => {
    const aliasMap = new Map<string, string>();
    for (const a of listAliases()) aliasMap.set(a.keyword, a.category_id);
    set({
      categories: listCategories(),
      accounts: listAccounts(),
      budgets: listBudgets(),
      aliases: aliasMap,
      defaultAccountId: get().defaultAccountId ?? getSetting('defaultAccountId'),
      version: get().version + 1,
    });
  },
  bump: () => set({ version: get().version + 1 }),
  setPinnedDate: (d) => set({ pinnedDate: d }),
  setDefaultAccount: (id) => {
    if (id) setSetting('defaultAccountId', id);
    set({ defaultAccountId: id });
  },
}));

export const expenseCategories = (cats: Category[]) => cats.filter((c) => c.kind === 'expense');
export const incomeCategories = (cats: Category[]) => cats.filter((c) => c.kind === 'income');
