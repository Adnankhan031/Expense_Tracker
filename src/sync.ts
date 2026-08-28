import { db, getSetting, setSetting } from './db';
import { supabase } from './supabase';

/**
 * Local-first sync.
 *
 * SQLite stays the source of truth: every write lands there first and returns
 * immediately, so the app works identically with no signal. Sync is a separate,
 * failable step that reconciles with Supabase afterwards.
 *
 * Conflicts resolve last-write-wins on `updated_at`. For one person editing
 * their own expenses on two devices that is the honest rule — anything cleverer
 * would be pretending to solve a problem that does not arise.
 *
 * Catalogue tables (categories, accounts, budgets, aliases) are tiny, so they
 * are reconciled whole. Transactions can run to thousands, so those move as a
 * delta against a watermark.
 */

const LAST_PULL = 'sync.lastPull';
const EPOCH = '1970-01-01T00:00:00.000Z';

export type SyncResult = {
  ok: boolean;
  pushed: number;
  pulled: number;
  error?: string;
  at: string;
};

const nowIso = () => new Date().toISOString();

/* ------------------------------------------------------------------ */
/* catalogue: match on the stable slug, adopt the remote id            */
/* ------------------------------------------------------------------ */

/**
 * Both sides seed the same slugs, so the same category exists twice with
 * different ids. Adopt the remote id locally and rewrite every reference, so the
 * two databases converge instead of duplicating.
 */
async function reconcileCatalogue(userId: string) {
  const sb = supabase();

  for (const table of ['categories', 'accounts'] as const) {
    const { data: remote, error } = await sb.from(table).select('*').eq('user_id', userId);
    if (error) throw error;

    const remoteByKey = new Map((remote ?? []).map((r) => [(r as { key: string }).key, r as Record<string, unknown>]));
    const local = db.getAllSync<{ id: string; key: string }>(`SELECT id, key FROM ${table}`);
    const localKeys = new Set(local.map((l) => l.key));

    db.withTransactionSync(() => {
      for (const row of local) {
        const match = remoteByKey.get(row.key);
        if (!match) continue;
        const remoteId = match.id as string;
        if (remoteId === row.id) continue;

        if (table === 'categories') {
          db.runSync('UPDATE transactions SET category_id=? WHERE category_id=?', [remoteId, row.id]);
          db.runSync('UPDATE budgets      SET category_id=? WHERE category_id=?', [remoteId, row.id]);
          db.runSync('UPDATE aliases      SET category_id=? WHERE category_id=?', [remoteId, row.id]);
        } else {
          db.runSync('UPDATE transactions SET account_id=? WHERE account_id=?', [remoteId, row.id]);
        }
        db.runSync(`UPDATE ${table} SET id=? WHERE id=?`, [remoteId, row.id]);
      }
    });

    // Anything the phone has that the server does not.
    const toPush = db
      .getAllSync<Record<string, unknown>>(`SELECT * FROM ${table}`)
      .filter((r) => !remoteByKey.has(r.key as string));
    if (toPush.length) {
      const rows = toPush.map((r) => ({ ...stripLocal(r), user_id: userId, archived: !!r.archived }));
      const { error: upErr } = await sb.from(table).upsert(rows, { onConflict: 'id' });
      if (upErr) throw upErr;
    }

    // Anything the server has that the phone does not.
    const missing = (remote ?? []).filter((r) => !localKeys.has((r as { key: string }).key));
    db.withTransactionSync(() => {
      for (const r of missing as Record<string, unknown>[]) {
        if (table === 'categories') {
          db.runSync(
            'INSERT OR REPLACE INTO categories (id,key,name,icon,color,kind,keywords,sort,archived,user_id) VALUES (?,?,?,?,?,?,?,?,?,?)',
            [r.id as string, r.key as string, r.name as string, r.icon as string, r.color as string,
             r.kind as string, (r.keywords as string) ?? '', (r.sort as number) ?? 0, r.archived ? 1 : 0, userId]
          );
        } else {
          db.runSync(
            'INSERT OR REPLACE INTO accounts (id,key,name,kind,icon,sort,archived,user_id) VALUES (?,?,?,?,?,?,?,?)',
            [r.id as string, r.key as string, r.name as string, r.kind as string, r.icon as string,
             (r.sort as number) ?? 0, r.archived ? 1 : 0, userId]
          );
        }
      }
    });
  }
}

/** Columns that exist only on the device. */
function stripLocal(row: Record<string, unknown>) {
  const { user_id: _u, ...rest } = row;
  return rest;
}

/* ------------------------------------------------------------------ */
/* transactions                                                        */
/* ------------------------------------------------------------------ */

async function pushTransactions(userId: string): Promise<number> {
  const sb = supabase();
  // Everything not yet claimed by this account, plus anything edited since.
  const rows = db.getAllSync<Record<string, unknown>>(
    'SELECT * FROM transactions WHERE user_id IS NULL OR user_id != ? OR updated_at > IFNULL((SELECT value FROM settings WHERE key = ?), ?)',
    [userId, 'sync.lastPush', EPOCH]
  );
  if (!rows.length) return 0;

  const payload = rows.map((r) => ({
    id: r.id,
    user_id: userId,
    amount_minor: r.amount_minor,
    type: r.type,
    category_id: r.category_id,
    account_id: r.account_id,
    method: r.method,
    occurred_at: r.occurred_at,
    local_date: r.local_date,
    note: r.note,
    raw_input: r.raw_input,
    source: r.source,
    confidence: r.confidence,
    reimbursable: !!r.reimbursable,
    reimbursed_at: r.reimbursed_at,
    created_at: r.created_at,
    updated_at: r.updated_at,
    deleted_at: r.deleted_at,
  }));

  // Chunked so a long backlog does not become one enormous request.
  for (let i = 0; i < payload.length; i += 200) {
    const { error } = await sb.from('transactions').upsert(payload.slice(i, i + 200), { onConflict: 'id' });
    if (error) throw error;
  }

  db.runSync('UPDATE transactions SET user_id = ? WHERE user_id IS NULL OR user_id != ?', [userId, userId]);
  return payload.length;
}

async function pullTransactions(userId: string): Promise<number> {
  const sb = supabase();
  const since = getSetting(LAST_PULL) ?? EPOCH;

  const { data, error } = await sb
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .gt('updated_at', since)
    .order('updated_at', { ascending: true })
    .limit(5000);
  if (error) throw error;
  if (!data?.length) return 0;

  db.withTransactionSync(() => {
    for (const r of data as Record<string, unknown>[]) {
      const local = db.getFirstSync<{ updated_at: string }>('SELECT updated_at FROM transactions WHERE id = ?', [
        r.id as string,
      ]);
      // Last write wins. A local edit newer than the server copy is kept and
      // goes back up on the next push.
      if (local && local.updated_at >= (r.updated_at as string)) continue;

      db.runSync(
        `INSERT OR REPLACE INTO transactions
         (id,amount_minor,type,category_id,account_id,method,occurred_at,local_date,note,raw_input,source,confidence,reimbursable,reimbursed_at,created_at,updated_at,deleted_at,user_id)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          r.id as string, r.amount_minor as number, r.type as string, r.category_id as string,
          (r.account_id as string) ?? null, (r.method as string) ?? null, r.occurred_at as string,
          r.local_date as string, (r.note as string) ?? null, (r.raw_input as string) ?? null,
          (r.source as string) ?? 'chat', (r.confidence as number) ?? 1, r.reimbursable ? 1 : 0,
          (r.reimbursed_at as string) ?? null, r.created_at as string, r.updated_at as string,
          (r.deleted_at as string) ?? null, userId,
        ]
      );
    }
  });

  return data.length;
}

/* ------------------------------------------------------------------ */
/* budgets and aliases — small enough to reconcile whole               */
/* ------------------------------------------------------------------ */

async function syncSmallTables(userId: string) {
  const sb = supabase();

  const budgets = db.getAllSync<Record<string, unknown>>('SELECT * FROM budgets');
  if (budgets.length) {
    const { error } = await sb.from('budgets').upsert(
      budgets.map((b) => ({
        id: b.id,
        user_id: userId,
        category_id: b.category_id,
        amount_minor: b.amount_minor,
        created_at: b.created_at,
      })),
      { onConflict: 'id' }
    );
    if (error) throw error;
  }

  const aliases = db.getAllSync<Record<string, unknown>>('SELECT * FROM aliases');
  if (aliases.length) {
    const { error } = await sb.from('aliases').upsert(
      aliases.map((a) => ({
        user_id: userId,
        keyword: a.keyword,
        category_id: a.category_id,
        hits: a.hits,
        last_used_at: a.last_used_at,
      })),
      { onConflict: 'user_id,keyword' }
    );
    if (error) throw error;
  }

  const { data: remoteAliases } = await sb.from('aliases').select('*').eq('user_id', userId);
  db.withTransactionSync(() => {
    for (const r of (remoteAliases ?? []) as Record<string, unknown>[]) {
      db.runSync(
        'INSERT OR REPLACE INTO aliases (keyword,category_id,hits,last_used_at,user_id) VALUES (?,?,?,?,?)',
        [r.keyword as string, r.category_id as string, (r.hits as number) ?? 1, r.last_used_at as string, userId]
      );
    }
  });
}

/* ------------------------------------------------------------------ */
/* entry point                                                         */
/* ------------------------------------------------------------------ */

let running = false;

export async function syncNow(userId: string): Promise<SyncResult> {
  if (running) return { ok: true, pushed: 0, pulled: 0, at: nowIso() };
  running = true;

  const startedAt = nowIso();
  try {
    await reconcileCatalogue(userId);
    const pushed = await pushTransactions(userId);
    await syncSmallTables(userId);
    const pulled = await pullTransactions(userId);

    // Only advance the watermarks once everything succeeded, so a failure part
    // way through simply retries next time rather than losing rows.
    setSetting('sync.lastPush', startedAt);
    setSetting(LAST_PULL, startedAt);
    setSetting('sync.lastOk', startedAt);
    setSetting('sync.lastError', '');

    return { ok: true, pushed, pulled, at: startedAt };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    setSetting('sync.lastError', error);
    return { ok: false, pushed: 0, pulled: 0, error, at: startedAt };
  } finally {
    running = false;
  }
}

export const lastSyncedAt = () => getSetting('sync.lastOk');
export const lastSyncError = () => getSetting('sync.lastError') || null;

/** Forget the watermarks so the next sync re-reads everything. */
export function resetSyncState() {
  setSetting('sync.lastPush', '');
  setSetting(LAST_PULL, '');
  setSetting('sync.lastOk', '');
  setSetting('sync.lastError', '');
}
