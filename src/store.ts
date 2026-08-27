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
import { CURRENCIES, DEFAULT_CURRENCY, currencyByCode, type Currency } from './currency';

/* ------------------------------------------------------------------ */
/* settings                                                            */
/* ------------------------------------------------------------------ */

export type ThemeMode = 'system' | 'light' | 'dark';

type SettingsState = {
  themeMode: ThemeMode;
  currencyCode: string;
  currency: Currency;
  hydrated: boolean;
  hydrate: () => void;
  setThemeMode: (m: ThemeMode) => void;
  setCurrencyCode: (code: string) => void;
};

export const useSettings = create<SettingsState>((set) => ({
  themeMode: 'dark',
  currencyCode: DEFAULT_CURRENCY,
  currency: currencyByCode(DEFAULT_CURRENCY),
  hydrated: false,
  hydrate: () => {
    const code = getSetting('currencyCode');
    const valid = code && CURRENCIES.some((c) => c.code === code) ? code : DEFAULT_CURRENCY;
    set({
      themeMode: (getSetting('themeMode') as ThemeMode) ?? 'dark',
      currencyCode: valid,
      currency: currencyByCode(valid),
      hydrated: true,
    });
  },
  setThemeMode: (m) => {
    setSetting('themeMode', m);
    set({ themeMode: m });
  },
  setCurrencyCode: (code) => {
    setSetting('currencyCode', code);
    set({ currencyCode: code, currency: currencyByCode(code) });
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
