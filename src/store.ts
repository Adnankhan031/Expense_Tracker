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
  listSubCategories,
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
  cycleStartDay: number;
  hydrated: boolean;
  hydrate: () => void;
  setThemeMode: (m: ThemeMode) => void;
  setCurrencyCode: (code: string) => void;
  setCycleStartDay: (d: number) => void;
};

export const useSettings = create<SettingsState>((set) => ({
  themeMode: 'dark',
  currencyCode: DEFAULT_CURRENCY,
  currency: currencyByCode(DEFAULT_CURRENCY),
  cycleStartDay: 1,
  hydrated: false,
  hydrate: () => {
    const code = getSetting('currencyCode');
    const valid = code && CURRENCIES.some((c) => c.code === code) ? code : DEFAULT_CURRENCY;
    const day = Number(getSetting('cycleStartDay') ?? 1);
    set({
      themeMode: (getSetting('themeMode') as ThemeMode) ?? 'dark',
      currencyCode: valid,
      currency: currencyByCode(valid),
      cycleStartDay: Number.isFinite(day) && day >= 1 && day <= 31 ? day : 1,
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
  setCycleStartDay: (d) => {
    const day = Math.min(31, Math.max(1, Math.round(d)));
    setSetting('cycleStartDay', String(day));
    set({ cycleStartDay: day });
  },
}));

/* ------------------------------------------------------------------ */
/* reference data + a version counter that screens subscribe to        */
/* ------------------------------------------------------------------ */

type DataState = {
  categories: Category[];
  /** Receipt-line subcategories. Kept apart so category pickers stay clean. */
  subCategories: Category[];
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
  subCategories: [],
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
      subCategories: listSubCategories(),
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
