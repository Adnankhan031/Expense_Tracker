import * as SQLite from 'expo-sqlite';
import { SEED_ACCOUNTS, SEED_CATEGORIES } from './seed';
import { ICON_MAP, resolveIconName } from './icons';
import { isUuid, uuid } from './uuid';
import { fromLocalDate, toLocalDate } from './format';

export const db = SQLite.openDatabaseSync('spendly.db');

export type TxnType = 'expense' | 'income';
export type TxnSource = 'chat' | 'quick' | 'backfill' | 'manual' | 'import';

export type Category = {
  id: string;
  /** Stable slug ('food', 'other'). Survives the id becoming a uuid. */
  key: string;
  name: string;
  icon: string;
  color: string;
  kind: TxnType;
  keywords: string;
  sort: number;
  archived: number;
};

export type Account = { id: string; key: string; name: string; kind: string; icon: string; sort: number; archived: number };

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
  /** Money you expect back — a work expense, a shared bill, a claim. */
  reimbursable: number;
  reimbursed_at: string | null;
};

export type TxnWithCategory = Txn & { cat_name: string; cat_icon: string; cat_color: string };

export type Budget = { id: string; category_id: string | null; amount_minor: number; created_at: string };

/**
 * Something you know is coming: next month's rent, a pass you buy on the 1st,
 * a yearly renewal.
 *
 * Deliberately not a transaction. Nothing is counted as spent until it actually
 * happens — a commitment is a reminder that turns into a real entry the day you
 * confirm it. Recurring ones roll their due date forward instead of being
 * recreated, so there is only ever one row per obligation.
 */
export type Recurrence = 'once' | 'weekly' | 'monthly' | 'yearly';

export type Commitment = {
  id: string;
  name: string;
  amount_minor: number;
  category_id: string | null;
  due_date: string;
  recurrence: Recurrence;
  method: string | null;
  note: string | null;
  archived: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type CommitmentView = Commitment & { cat_name: string; cat_icon: string; cat_color: string };

export type ChatMessage = {
  id: string;
  role: 'user' | 'app';
  kind: 'text' | 'txn' | 'answer' | 'note';
  text: string;
  txn_id: string | null;
  payload: string | null;
  created_at: string;
};

export const uid = uuid;

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
        icon TEXT NOT NULL DEFAULT 'package',
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
        icon TEXT NOT NULL DEFAULT 'wallet',
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

  if (version < 2) {
    // Some spending comes back later. Track it rather than pretending it never happened.
    db.execSync(`
      ALTER TABLE transactions ADD COLUMN reimbursable INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE transactions ADD COLUMN reimbursed_at TEXT;
    `);
    db.execSync('PRAGMA user_version = 2');
  }

  if (version < 3) {
    migrateToUuids();
    db.execSync('PRAGMA user_version = 3');
  }

  if (version < 4) {
    db.execSync(`
      CREATE TABLE IF NOT EXISTS commitments (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT,
        name TEXT NOT NULL,
        amount_minor INTEGER NOT NULL,
        category_id TEXT,
        due_date TEXT NOT NULL,
        recurrence TEXT NOT NULL DEFAULT 'once',
        method TEXT,
        note TEXT,
        archived INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_commit_due ON commitments(due_date);
    `);
    db.execSync('PRAGMA user_version = 4');
  }

  seedIfEmpty();
  syncSeedCategories();
  migrateIcons();
}

/**
 * Give every row a uuid, and remember the slug that used to be its id.
 *
 * Sync only works if a local row and its Supabase row share an identifier, and
 * that column is a uuid. Old installs minted short slugs, so every id is
 * rewritten once and every reference to it is rewritten with it. Runs inside a
 * transaction: either the whole database moves across or none of it does.
 */
function migrateToUuids() {
  db.execSync(`
    ALTER TABLE categories ADD COLUMN key TEXT NOT NULL DEFAULT '';
    ALTER TABLE accounts   ADD COLUMN key TEXT NOT NULL DEFAULT '';
    ALTER TABLE transactions ADD COLUMN user_id TEXT;
    ALTER TABLE categories   ADD COLUMN user_id TEXT;
    ALTER TABLE accounts     ADD COLUMN user_id TEXT;
    ALTER TABLE budgets      ADD COLUMN user_id TEXT;
    ALTER TABLE aliases      ADD COLUMN user_id TEXT;
  `);

  db.withTransactionSync(() => {
    db.runSync("UPDATE categories SET key = id WHERE key = ''");
    db.runSync("UPDATE accounts   SET key = id WHERE key = ''");

    for (const row of db.getAllSync<{ id: string }>('SELECT id FROM categories')) {
      if (isUuid(row.id)) continue;
      const next = uuid();
      db.runSync('UPDATE transactions SET category_id=? WHERE category_id=?', [next, row.id]);
      db.runSync('UPDATE budgets      SET category_id=? WHERE category_id=?', [next, row.id]);
      db.runSync('UPDATE aliases      SET category_id=? WHERE category_id=?', [next, row.id]);
      db.runSync('UPDATE categories   SET id=? WHERE id=?', [next, row.id]);
    }

    for (const row of db.getAllSync<{ id: string }>('SELECT id FROM accounts')) {
      if (isUuid(row.id)) continue;
      const next = uuid();
      db.runSync('UPDATE transactions SET account_id=? WHERE account_id=?', [next, row.id]);
      db.runSync('UPDATE accounts     SET id=? WHERE id=?', [next, row.id]);
    }

    for (const row of db.getAllSync<{ id: string }>('SELECT id FROM transactions')) {
      if (isUuid(row.id)) continue;
      const next = uuid();
      db.runSync('UPDATE messages     SET txn_id=? WHERE txn_id=?', [next, row.id]);
      db.runSync('UPDATE transactions SET id=? WHERE id=?', [next, row.id]);
    }

    for (const row of db.getAllSync<{ id: string }>('SELECT id FROM budgets')) {
      if (isUuid(row.id)) continue;
      db.runSync('UPDATE budgets SET id=? WHERE id=?', [uuid(), row.id]);
    }
  });
}

/**
 * Bring an existing install up to date with the shipped catalogue.
 *
 * New seed categories are inserted; for ones the user already has we union the
 * keywords rather than overwrite, so vocabulary improvements land without
 * discarding anything they added themselves. Names, colours and icons are left
 * alone — those are theirs to change.
 */
function syncSeedCategories() {
  const existing = new Map(
    db
      .getAllSync<{ key: string; keywords: string }>('SELECT key, keywords FROM categories')
      .map((r) => [r.key, r.keywords])
  );
  const maxSort =
    db.getFirstSync<{ m: number }>('SELECT IFNULL(MAX(sort),0) as m FROM categories')?.m ?? 0;
  let next = maxSort + 1;

  for (const cat of SEED_CATEGORIES) {
    const have = existing.get(cat.id);
    if (have === undefined) {
      db.runSync(
        'INSERT INTO categories (id,key,name,icon,color,kind,keywords,sort,archived) VALUES (?,?,?,?,?,?,?,?,0)',
        [uuid(), cat.id, cat.name, cat.icon, cat.color, cat.kind, cat.keywords.join('|'), next++]
      );
      continue;
    }
    const merged = new Set([...have.split('|').filter(Boolean), ...cat.keywords]);
    if (merged.size !== have.split('|').filter(Boolean).length) {
      db.runSync('UPDATE categories SET keywords=? WHERE key=?', [[...merged].join('|'), cat.id]);
    }
  }
}

/**
 * Categories seeded before the icon set existed store an emoji in `icon`.
 * Rewrite those rows once so the UI never has to render emoji.
 */
function migrateIcons() {
  const rows = db.getAllSync<{ id: string; icon: string }>('SELECT id, icon FROM categories');
  for (const r of rows) {
    if (ICON_MAP[r.icon]) continue;
    db.runSync('UPDATE categories SET icon=? WHERE id=?', [resolveIconName(r.icon), r.id]);
  }
  const accs = db.getAllSync<{ id: string; icon: string }>('SELECT id, icon FROM accounts');
  for (const a of accs) {
    if (ICON_MAP[a.icon]) continue;
    db.runSync('UPDATE accounts SET icon=? WHERE id=?', [resolveIconName(a.icon), a.id]);
  }
}

function seedIfEmpty() {
  const c = db.getFirstSync<{ n: number }>('SELECT COUNT(*) as n FROM categories');
  if ((c?.n ?? 0) === 0) {
    SEED_CATEGORIES.forEach((cat, i) => {
      db.runSync(
        'INSERT INTO categories (id,key,name,icon,color,kind,keywords,sort,archived) VALUES (?,?,?,?,?,?,?,?,0)',
        [uuid(), cat.id, cat.name, cat.icon, cat.color, cat.kind, cat.keywords.join('|'), i]
      );
    });
  }
  const a = db.getFirstSync<{ n: number }>('SELECT COUNT(*) as n FROM accounts');
  if ((a?.n ?? 0) === 0) {
    SEED_ACCOUNTS.forEach((acc, i) => {
      db.runSync('INSERT INTO accounts (id,key,name,kind,icon,sort,archived) VALUES (?,?,?,?,?,?,0)', [
        uuid(),
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
      c.icon ?? 'package',
      c.color ?? '#90A4AE',
      c.kind ?? 'expense',
      c.keywords ?? '',
      c.id,
    ]);
    return c.id;
  }
  const id = uid();
  const max = db.getFirstSync<{ m: number }>('SELECT IFNULL(MAX(sort),0) as m FROM categories');
  db.runSync('INSERT INTO categories (id,key,name,icon,color,kind,keywords,sort,archived) VALUES (?,?,?,?,?,?,?,?,0)', [
    id,
    'custom_' + id.slice(0, 8),
    c.name,
    c.icon ?? 'package',
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
    db.runSync('UPDATE accounts SET name=?, kind=?, icon=? WHERE id=?', [a.name, a.kind ?? 'cash', a.icon ?? 'wallet', a.id]);
    return a.id;
  }
  const id = uid();
  const max = db.getFirstSync<{ m: number }>('SELECT IFNULL(MAX(sort),0) as m FROM accounts');
  db.runSync('INSERT INTO accounts (id,key,name,kind,icon,sort,archived) VALUES (?,?,?,?,?,?,0)', [
    id,
    'custom_' + id.slice(0, 8),
    a.name,
    a.kind ?? 'cash',
    a.icon ?? 'wallet',
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
  reimbursable?: boolean;
};

export function insertTxn(t: NewTxn): string {
  const id = uid();
  const ts = nowIso();
  db.runSync(
    `INSERT INTO transactions
     (id,amount_minor,type,category_id,account_id,method,occurred_at,local_date,note,raw_input,source,confidence,reimbursable,created_at,updated_at,deleted_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NULL)`,
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
      t.reimbursable ? 1 : 0,
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
    reimbursable: patch.reimbursable !== undefined ? (patch.reimbursable ? 1 : 0) : cur.reimbursable,
  };
  db.runSync(
    `UPDATE transactions SET amount_minor=?, type=?, category_id=?, account_id=?, method=?, local_date=?, occurred_at=?, note=?, reimbursable=?, updated_at=? WHERE id=?`,
    [
      Math.round(next.amount_minor),
      next.type,
      next.category_id,
      next.account_id,
      next.method,
      next.local_date,
      new Date(`${next.local_date}T12:00:00`).toISOString(),
      next.note,
      next.reimbursable,
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

/* ------------------------------------------------------------------ */
/* reimbursements                                                      */
/* ------------------------------------------------------------------ */

/** Expenses flagged as coming back, that have not been settled yet. */
export const pendingReimbursements = (): TxnWithCategory[] =>
  db.getAllSync<TxnWithCategory>(
    `${TXN_SELECT} AND t.reimbursable = 1 AND t.reimbursed_at IS NULL ORDER BY t.local_date DESC`
  );

export const pendingReimbursementTotal = (): number =>
  db.getFirstSync<{ s: number }>(
    'SELECT IFNULL(SUM(amount_minor),0) as s FROM transactions WHERE deleted_at IS NULL AND reimbursable = 1 AND reimbursed_at IS NULL'
  )?.s ?? 0;

/** Mark it settled — the expense stays, it just stops being owed to you. */
export const settleReimbursement = (id: string) =>
  db.runSync('UPDATE transactions SET reimbursed_at=?, updated_at=? WHERE id=?', [nowIso(), nowIso(), id]);

export const unsettleReimbursement = (id: string) =>
  db.runSync('UPDATE transactions SET reimbursed_at=NULL, updated_at=? WHERE id=?', [nowIso(), id]);

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
/* commitments                                                         */
/* ------------------------------------------------------------------ */

const COMMIT_SELECT = `
  SELECT c.*, IFNULL(k.name,'Uncategorised') as cat_name, IFNULL(k.icon,'package') as cat_icon,
         IFNULL(k.color,'#90A4AE') as cat_color
  FROM commitments c LEFT JOIN categories k ON k.id = c.category_id
  WHERE c.deleted_at IS NULL`;

export const listCommitments = (includeArchived = false): CommitmentView[] =>
  db.getAllSync<CommitmentView>(
    `${COMMIT_SELECT} ${includeArchived ? '' : 'AND c.archived = 0'} ORDER BY c.due_date ASC`
  );

export const getCommitment = (id: string): Commitment | null =>
  db.getFirstSync<Commitment>('SELECT * FROM commitments WHERE id = ?', [id]);

/** Everything owed between now and `to`, ignoring what is already archived. */
export const commitmentsDueBy = (to: string): CommitmentView[] =>
  db.getAllSync<CommitmentView>(`${COMMIT_SELECT} AND c.archived = 0 AND c.due_date <= ? ORDER BY c.due_date ASC`, [to]);

export function saveCommitment(c: Partial<Commitment> & { name: string; amount_minor: number; due_date: string }) {
  const ts = nowIso();
  if (c.id) {
    db.runSync(
      `UPDATE commitments SET name=?, amount_minor=?, category_id=?, due_date=?, recurrence=?, method=?, note=?, updated_at=? WHERE id=?`,
      [c.name, Math.round(c.amount_minor), c.category_id ?? null, c.due_date, c.recurrence ?? 'once',
       c.method ?? null, c.note ?? null, ts, c.id]
    );
    return c.id;
  }
  const id = uuid();
  db.runSync(
    `INSERT INTO commitments (id,name,amount_minor,category_id,due_date,recurrence,method,note,archived,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,0,?,?)`,
    [id, c.name, Math.round(c.amount_minor), c.category_id ?? null, c.due_date, c.recurrence ?? 'once',
     c.method ?? null, c.note ?? null, ts, ts]
  );
  return id;
}

export const deleteCommitment = (id: string) =>
  db.runSync('UPDATE commitments SET deleted_at=?, updated_at=? WHERE id=?', [nowIso(), nowIso(), id]);

export const archiveCommitment = (id: string, archived = true) =>
  db.runSync('UPDATE commitments SET archived=?, updated_at=? WHERE id=?', [archived ? 1 : 0, nowIso(), id]);

/** The next occurrence after `from` for a recurring commitment. */
export function nextDue(from: string, recurrence: Recurrence): string | null {
  if (recurrence === 'once') return null;
  const d = fromLocalDate(from);
  if (recurrence === 'weekly') d.setDate(d.getDate() + 7);
  else if (recurrence === 'monthly') d.setMonth(d.getMonth() + 1);
  else d.setFullYear(d.getFullYear() + 1);
  return toLocalDate(d);
}

/**
 * Turn a commitment into a real expense.
 *
 * A one-off is archived afterwards; a recurring one rolls forward to its next
 * date, so the same row keeps serving the obligation rather than piling up
 * duplicates.
 */
export function settleCommitment(id: string, onDate?: string): string | null {
  const c = getCommitment(id);
  if (!c) return null;

  const txnId = insertTxn({
    amount_minor: c.amount_minor,
    type: 'expense',
    category_id: c.category_id ?? (listCategories().find((k) => k.key === 'other')?.id ?? ''),
    local_date: onDate ?? c.due_date,
    method: c.method,
    note: c.note?.trim() || c.name,
    source: 'manual',
    confidence: 1,
  });

  const next = nextDue(c.due_date, c.recurrence);
  if (next) db.runSync('UPDATE commitments SET due_date=?, updated_at=? WHERE id=?', [next, nowIso(), id]);
  else archiveCommitment(id, true);

  return txnId;
}

/** Move past a due date without spending — the month you skip the pass. */
export function skipCommitment(id: string) {
  const c = getCommitment(id);
  if (!c) return;
  const next = nextDue(c.due_date, c.recurrence);
  if (next) db.runSync('UPDATE commitments SET due_date=?, updated_at=? WHERE id=?', [next, nowIso(), id]);
  else archiveCommitment(id, true);
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
