import * as SQLite from 'expo-sqlite';
import { SEED_ACCOUNTS, SEED_CATEGORIES } from './seed';

export const db = SQLite.openDatabaseSync('spendly.db');

export type TxnType = 'expense' | 'income';
export type TxnSource = 'chat' | 'quick' | 'backfill' | 'manual' | 'import';

export type Category = {
  id: string;
  name: string;
  icon: string;
  color: string;
  kind: TxnType;
  keywords: string;
  sort: number;
  archived: number;
};

export type Account = { id: string; name: string; kind: string; icon: string; sort: number; archived: number };

export type Txn = {
  id: string;
  amount_minor: number;
  type: TxnType;
  category_id: string;
  account_id: string | null;
  method: string | null;
  occurred_at: string;
  local_date: string;
  note: string | null;
  raw_input: string | null;
  source: TxnSource;
  confidence: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type TxnWithCategory = Txn & { cat_name: string; cat_icon: string; cat_color: string };

export type Budget = { id: string; category_id: string | null; amount_minor: number; created_at: string };

export type ChatMessage = {
  id: string;
  role: 'user' | 'app';
  kind: 'text' | 'txn' | 'answer' | 'note';
  text: string;
  txn_id: string | null;
  payload: string | null;
  created_at: string;
};

export function uid(): string {
  return (
    Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10)
  );
}

const nowIso = () => new Date().toISOString();

/* ------------------------------------------------------------------ */
/* schema                                                              */
/* ------------------------------------------------------------------ */

export function initDb() {
  db.execSync('PRAGMA journal_mode = WAL;');
  db.execSync('PRAGMA foreign_keys = ON;');

  const row = db.getFirstSync<{ user_version: number }>('PRAGMA user_version');
  const version = row?.user_version ?? 0;

  if (version < 1) {
    db.execSync(`
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        icon TEXT NOT NULL DEFAULT '📦',
        color TEXT NOT NULL DEFAULT '#90A4AE',
        kind TEXT NOT NULL DEFAULT 'expense',
        keywords TEXT NOT NULL DEFAULT '',
        sort INTEGER NOT NULL DEFAULT 0,
        archived INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        kind TEXT NOT NULL DEFAULT 'cash',
        icon TEXT NOT NULL DEFAULT '💵',
        sort INTEGER NOT NULL DEFAULT 0,
        archived INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY NOT NULL,
        amount_minor INTEGER NOT NULL,
        type TEXT NOT NULL DEFAULT 'expense',
        category_id TEXT NOT NULL,
        account_id TEXT,
        method TEXT,
        occurred_at TEXT NOT NULL,
        local_date TEXT NOT NULL,
        note TEXT,
        raw_input TEXT,
        source TEXT NOT NULL DEFAULT 'chat',
        confidence REAL NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_txn_date ON transactions(local_date);
      CREATE INDEX IF NOT EXISTS idx_txn_cat ON transactions(category_id);
      CREATE TABLE IF NOT EXISTS aliases (
        keyword TEXT PRIMARY KEY NOT NULL,
        category_id TEXT NOT NULL,
        hits INTEGER NOT NULL DEFAULT 1,
        last_used_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS budgets (
        id TEXT PRIMARY KEY NOT NULL,
        category_id TEXT,
        amount_minor INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_budget_cat ON budgets(IFNULL(category_id,'__all__'));
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY NOT NULL,
        role TEXT NOT NULL,
        kind TEXT NOT NULL DEFAULT 'text',
        text TEXT NOT NULL DEFAULT '',
        txn_id TEXT,
        payload TEXT,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
    `);
    db.execSync('PRAGMA user_version = 1');
  }

  seedIfEmpty();
}

function seedIfEmpty() {
  const c = db.getFirstSync<{ n: number }>('SELECT COUNT(*) as n FROM categories');
  if ((c?.n ?? 0) === 0) {
    SEED_CATEGORIES.forEach((cat, i) => {
      db.runSync(
        'INSERT INTO categories (id,name,icon,color,kind,keywords,sort,archived) VALUES (?,?,?,?,?,?,?,0)',
        [cat.id, cat.name, cat.icon, cat.color, cat.kind, cat.keywords.join('|'), i]
      );
    });
  }
  const a = db.getFirstSync<{ n: number }>('SELECT COUNT(*) as n FROM accounts');
  if ((a?.n ?? 0) === 0) {
    SEED_ACCOUNTS.forEach((acc, i) => {
      db.runSync('INSERT INTO accounts (id,name,kind,icon,sort,archived) VALUES (?,?,?,?,?,0)', [
        acc.id,
        acc.name,
        acc.kind,
        acc.icon,
        i,
      ]);
    });
  }
}

/* ------------------------------------------------------------------ */
/* categories & accounts                                               */
/* ------------------------------------------------------------------ */

export const listCategories = (includeArchived = false): Category[] =>
  db.getAllSync<Category>(
    `SELECT * FROM categories ${includeArchived ? '' : 'WHERE archived = 0'} ORDER BY kind DESC, sort ASC, name ASC`
  );

export const getCategory = (id: string): Category | null =>
  db.getFirstSync<Category>('SELECT * FROM categories WHERE id = ?', [id]);

export function saveCategory(c: Partial<Category> & { name: string }) {
  if (c.id) {
    db.runSync('UPDATE categories SET name=?, icon=?, color=?, kind=?, keywords=? WHERE id=?', [
      c.name,
      c.icon ?? '📦',
      c.color ?? '#90A4AE',
      c.kind ?? 'expense',
      c.keywords ?? '',
      c.id,
    ]);
    return c.id;
  }
  const id = uid();
  const max = db.getFirstSync<{ m: number }>('SELECT IFNULL(MAX(sort),0) as m FROM categories');
  db.runSync('INSERT INTO categories (id,name,icon,color,kind,keywords,sort,archived) VALUES (?,?,?,?,?,?,?,0)', [
    id,
    c.name,
    c.icon ?? '📦',
    c.color ?? '#90A4AE',
    c.kind ?? 'expense',
    c.keywords ?? '',
    (max?.m ?? 0) + 1,
  ]);
  return id;
}

export const archiveCategory = (id: string, archived = true) =>
  db.runSync('UPDATE categories SET archived=? WHERE id=?', [archived ? 1 : 0, id]);

export const listAccounts = (): Account[] =>
  db.getAllSync<Account>('SELECT * FROM accounts WHERE archived = 0 ORDER BY sort ASC');

export function saveAccount(a: Partial<Account> & { name: string }) {
  if (a.id) {
    db.runSync('UPDATE accounts SET name=?, kind=?, icon=? WHERE id=?', [a.name, a.kind ?? 'cash', a.icon ?? '💵', a.id]);
    return a.id;
  }
  const id = uid();
  const max = db.getFirstSync<{ m: number }>('SELECT IFNULL(MAX(sort),0) as m FROM accounts');
  db.runSync('INSERT INTO accounts (id,name,kind,icon,sort,archived) VALUES (?,?,?,?,?,0)', [
    id,
    a.name,
    a.kind ?? 'cash',
    a.icon ?? '💵',
    (max?.m ?? 0) + 1,
  ]);
  return id;
}

export const archiveAccount = (id: string) => db.runSync('UPDATE accounts SET archived=1 WHERE id=?', [id]);

/* ------------------------------------------------------------------ */
/* transactions                                                        */
/* ------------------------------------------------------------------ */

export type NewTxn = {
  amount_minor: number;
  type: TxnType;
  category_id: string;
  account_id?: string | null;
  method?: string | null;
  local_date: string;
  note?: string | null;
  raw_input?: string | null;
  source?: TxnSource;
  confidence?: number;
};

export function insertTxn(t: NewTxn): string {
  const id = uid();
  const ts = nowIso();
  db.runSync(
    `INSERT INTO transactions
     (id,amount_minor,type,category_id,account_id,method,occurred_at,local_date,note,raw_input,source,confidence,created_at,updated_at,deleted_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,NULL)`,
    [
      id,
      Math.round(t.amount_minor),
      t.type,
      t.category_id,
      t.account_id ?? null,
      t.method ?? null,
      new Date(`${t.local_date}T12:00:00`).toISOString(),
      t.local_date,
      t.note ?? null,
      t.raw_input ?? null,
      t.source ?? 'chat',
      t.confidence ?? 1,
      ts,
      ts,
    ]
  );
  return id;
}

export function updateTxn(id: string, patch: Partial<NewTxn>) {
  const cur = getTxn(id);
  if (!cur) return;
  const next = {
    amount_minor: patch.amount_minor ?? cur.amount_minor,
    type: patch.type ?? cur.type,
    category_id: patch.category_id ?? cur.category_id,
    account_id: patch.account_id !== undefined ? patch.account_id : cur.account_id,
    method: patch.method !== undefined ? patch.method : cur.method,
    local_date: patch.local_date ?? cur.local_date,
    note: patch.note !== undefined ? patch.note : cur.note,
  };
  db.runSync(
    `UPDATE transactions SET amount_minor=?, type=?, category_id=?, account_id=?, method=?, local_date=?, occurred_at=?, note=?, updated_at=? WHERE id=?`,
    [
      Math.round(next.amount_minor),
      next.type,
      next.category_id,
      next.account_id,
      next.method,
      next.local_date,
      new Date(`${next.local_date}T12:00:00`).toISOString(),
      next.note,
      nowIso(),
      id,
    ]
  );
}

export const getTxn = (id: string): Txn | null =>
  db.getFirstSync<Txn>('SELECT * FROM transactions WHERE id = ?', [id]);

export const softDeleteTxn = (id: string) =>
  db.runSync('UPDATE transactions SET deleted_at=?, updated_at=? WHERE id=?', [nowIso(), nowIso(), id]);

export const restoreTxn = (id: string) =>
  db.runSync('UPDATE transactions SET deleted_at=NULL, updated_at=? WHERE id=?', [nowIso(), id]);

const TXN_SELECT = `
  SELECT t.*, c.name as cat_name, c.icon as cat_icon, c.color as cat_color
  FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
  WHERE t.deleted_at IS NULL`;

export const txnsInRange = (from: string, to: string): TxnWithCategory[] =>
  db.getAllSync<TxnWithCategory>(
    `${TXN_SELECT} AND t.local_date BETWEEN ? AND ? ORDER BY t.local_date DESC, t.created_at DESC`,
    [from, to]
  );

export const txnsForDay = (date: string): TxnWithCategory[] =>
  db.getAllSync<TxnWithCategory>(`${TXN_SELECT} AND t.local_date = ? ORDER BY t.created_at DESC`, [date]);

export const recentTxns = (limit = 20): TxnWithCategory[] =>
  db.getAllSync<TxnWithCategory>(`${TXN_SELECT} ORDER BY t.local_date DESC, t.created_at DESC LIMIT ?`, [limit]);

export const allTxns = (): TxnWithCategory[] =>
  db.getAllSync<TxnWithCategory>(`${TXN_SELECT} ORDER BY t.local_date DESC, t.created_at DESC`);

export function searchTxns(opts: {
  q?: string;
  categoryId?: string | null;
  type?: TxnType | null;
  from?: string;
  to?: string;
  limit?: number;
}): TxnWithCategory[] {
  const where: string[] = [];
  const params: any[] = [];
  if (opts.q) {
    where.push('(LOWER(IFNULL(t.note,"")) LIKE ? OR LOWER(IFNULL(t.raw_input,"")) LIKE ? OR LOWER(c.name) LIKE ?)');
    const like = `%${opts.q.toLowerCase()}%`;
    params.push(like, like, like);
  }
  if (opts.categoryId) {
    where.push('t.category_id = ?');
    params.push(opts.categoryId);
  }
  if (opts.type) {
    where.push('t.type = ?');
    params.push(opts.type);
  }
  if (opts.from && opts.to) {
    where.push('t.local_date BETWEEN ? AND ?');
    params.push(opts.from, opts.to);
  }
  const sql = `${TXN_SELECT} ${where.length ? 'AND ' + where.join(' AND ') : ''} ORDER BY t.local_date DESC, t.created_at DESC LIMIT ?`;
  params.push(opts.limit ?? 500);
  return db.getAllSync<TxnWithCategory>(sql, params);
}

/* ------------------------------------------------------------------ */
/* aggregates                                                          */
/* ------------------------------------------------------------------ */

export type CatTotal = { category_id: string; name: string; icon: string; color: string; total: number; count: number };

export const totalsByCategory = (from: string, to: string, type: TxnType = 'expense'): CatTotal[] =>
  db.getAllSync<CatTotal>(
    `SELECT t.category_id, c.name, c.icon, c.color, SUM(t.amount_minor) as total, COUNT(*) as count
     FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
     WHERE t.deleted_at IS NULL AND t.type = ? AND t.local_date BETWEEN ? AND ?
     GROUP BY t.category_id ORDER BY total DESC`,
    [type, from, to]
  );

export const sumInRange = (from: string, to: string, type: TxnType): number =>
  db.getFirstSync<{ s: number }>(
    'SELECT IFNULL(SUM(amount_minor),0) as s FROM transactions WHERE deleted_at IS NULL AND type=? AND local_date BETWEEN ? AND ?',
    [type, from, to]
  )?.s ?? 0;

export const countInRange = (from: string, to: string): number =>
  db.getFirstSync<{ n: number }>(
    'SELECT COUNT(*) as n FROM transactions WHERE deleted_at IS NULL AND local_date BETWEEN ? AND ?',
    [from, to]
  )?.n ?? 0;

export const dailyTotals = (from: string, to: string, type: TxnType = 'expense') =>
  db.getAllSync<{ local_date: string; total: number }>(
    `SELECT local_date, SUM(amount_minor) as total FROM transactions
     WHERE deleted_at IS NULL AND type=? AND local_date BETWEEN ? AND ?
     GROUP BY local_date ORDER BY local_date ASC`,
    [type, from, to]
  );

export const monthlyTotals = (fromMonth: string, toMonth: string) =>
  db.getAllSync<{ ym: string; expense: number; income: number }>(
    `SELECT substr(local_date,1,7) as ym,
            IFNULL(SUM(CASE WHEN type='expense' THEN amount_minor END),0) as expense,
            IFNULL(SUM(CASE WHEN type='income'  THEN amount_minor END),0) as income
     FROM transactions WHERE deleted_at IS NULL AND substr(local_date,1,7) BETWEEN ? AND ?
     GROUP BY ym ORDER BY ym ASC`,
    [fromMonth, toMonth]
  );

export const monthsWithData = () =>
  db.getAllSync<{ ym: string }>(
    `SELECT DISTINCT substr(local_date,1,7) as ym FROM transactions WHERE deleted_at IS NULL ORDER BY ym DESC`
  ).map((r) => r.ym);

export const totalsByMethod = (from: string, to: string) =>
  db.getAllSync<{ method: string | null; total: number; count: number }>(
    `SELECT IFNULL(method,'Unspecified') as method, SUM(amount_minor) as total, COUNT(*) as count
     FROM transactions WHERE deleted_at IS NULL AND type='expense' AND local_date BETWEEN ? AND ?
     GROUP BY IFNULL(method,'Unspecified') ORDER BY total DESC`,
    [from, to]
  );

export const totalsByWeekday = (from: string, to: string) =>
  db.getAllSync<{ dow: string; total: number; days: number }>(
    `SELECT strftime('%w', local_date) as dow, SUM(amount_minor) as total, COUNT(DISTINCT local_date) as days
     FROM transactions WHERE deleted_at IS NULL AND type='expense' AND local_date BETWEEN ? AND ?
     GROUP BY dow ORDER BY dow ASC`,
    [from, to]
  );

export const topNotes = (from: string, to: string, limit = 6) =>
  db.getAllSync<{ note: string; total: number; count: number }>(
    `SELECT LOWER(TRIM(note)) as note, SUM(amount_minor) as total, COUNT(*) as count
     FROM transactions
     WHERE deleted_at IS NULL AND type='expense' AND note IS NOT NULL AND TRIM(note) <> ''
       AND local_date BETWEEN ? AND ?
     GROUP BY LOWER(TRIM(note)) HAVING count >= 1 ORDER BY total DESC LIMIT ?`,
    [from, to, limit]
  );

export const firstTxnDate = (): string | null =>
  db.getFirstSync<{ d: string }>(
    'SELECT MIN(local_date) as d FROM transactions WHERE deleted_at IS NULL'
  )?.d ?? null;

export const totalTxnCount = (): number =>
  db.getFirstSync<{ n: number }>('SELECT COUNT(*) as n FROM transactions WHERE deleted_at IS NULL')?.n ?? 0;

/* ------------------------------------------------------------------ */
/* aliases (the learning table)                                         */
/* ------------------------------------------------------------------ */

export const listAliases = () =>
  db.getAllSync<{ keyword: string; category_id: string; hits: number; last_used_at: string }>(
    'SELECT * FROM aliases ORDER BY hits DESC, keyword ASC'
  );

export const findAlias = (keyword: string) =>
  db.getFirstSync<{ keyword: string; category_id: string }>('SELECT * FROM aliases WHERE keyword = ?', [
    keyword.toLowerCase(),
  ]);

export function learnAlias(keyword: string, categoryId: string) {
  const k = keyword.trim().toLowerCase();
  if (!k || k.length < 2 || /^\d+$/.test(k)) return;
  db.runSync(
    `INSERT INTO aliases (keyword,category_id,hits,last_used_at) VALUES (?,?,1,?)
     ON CONFLICT(keyword) DO UPDATE SET category_id=excluded.category_id, hits=hits+1, last_used_at=excluded.last_used_at`,
    [k, categoryId, nowIso()]
  );
}

export const deleteAlias = (keyword: string) => db.runSync('DELETE FROM aliases WHERE keyword = ?', [keyword]);

/* ------------------------------------------------------------------ */
/* budgets                                                             */
/* ------------------------------------------------------------------ */

export const listBudgets = (): Budget[] => db.getAllSync<Budget>('SELECT * FROM budgets');

export function setBudget(categoryId: string | null, amountMinor: number) {
  const existing = db.getFirstSync<Budget>(
    categoryId ? 'SELECT * FROM budgets WHERE category_id = ?' : 'SELECT * FROM budgets WHERE category_id IS NULL',
    categoryId ? [categoryId] : []
  );
  if (amountMinor <= 0) {
    if (existing) db.runSync('DELETE FROM budgets WHERE id = ?', [existing.id]);
    return;
  }
  if (existing) db.runSync('UPDATE budgets SET amount_minor=? WHERE id=?', [Math.round(amountMinor), existing.id]);
  else
    db.runSync('INSERT INTO budgets (id,category_id,amount_minor,created_at) VALUES (?,?,?,?)', [
      uid(),
      categoryId,
      Math.round(amountMinor),
      nowIso(),
    ]);
}

/* ------------------------------------------------------------------ */
/* chat messages                                                       */
/* ------------------------------------------------------------------ */

export const listMessages = (limit = 200): ChatMessage[] =>
  db
    .getAllSync<ChatMessage>('SELECT * FROM messages ORDER BY created_at DESC LIMIT ?', [limit])
    .reverse();

export function addMessage(m: Omit<ChatMessage, 'id' | 'created_at'>): ChatMessage {
  const msg: ChatMessage = { ...m, id: uid(), created_at: nowIso() };
  db.runSync('INSERT INTO messages (id,role,kind,text,txn_id,payload,created_at) VALUES (?,?,?,?,?,?,?)', [
    msg.id,
    msg.role,
    msg.kind,
    msg.text,
    msg.txn_id,
    msg.payload,
    msg.created_at,
  ]);
  return msg;
}

export const deleteMessage = (id: string) => db.runSync('DELETE FROM messages WHERE id = ?', [id]);
export const deleteMessageByTxn = (txnId: string) => db.runSync('DELETE FROM messages WHERE txn_id = ?', [txnId]);
export const clearMessages = () => db.execSync('DELETE FROM messages');

/* ------------------------------------------------------------------ */
/* settings                                                            */
/* ------------------------------------------------------------------ */

export const getSetting = (key: string): string | null =>
  db.getFirstSync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key])?.value ?? null;

export const setSetting = (key: string, value: string) =>
  db.runSync('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', [
    key,
    value,
  ]);

export function wipeAllData() {
  db.execSync(`
    DELETE FROM transactions;
    DELETE FROM messages;
    DELETE FROM aliases;
    DELETE FROM budgets;
  `);
}
