'use client';

import { supabaseBrowser } from './supabase/client';
import { SEED_ACCOUNTS, SEED_CATEGORIES } from './seed';
import type { Account, Alias, Budget, Category, ChatMessage, NewTxn, Txn, TxnView } from './types';

const db = () => supabaseBrowser();

/* ------------------------------------------------------------------ */
/* first-run seeding                                                   */
/* ------------------------------------------------------------------ */

/**
 * A brand new account has no categories, so the parser would have nothing to
 * match against. Seed the same 24 categories and 4 accounts the native app uses.
 */
export async function ensureSeeded(userId: string) {
  const { count, error } = await db()
    .from('categories')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (error) throw error;
  if ((count ?? 0) > 0) return;

  const cats = SEED_CATEGORIES.map((c, i) => ({
    user_id: userId,
    key: c.id,
    name: c.name,
    icon: c.icon,
    color: c.color,
    kind: c.kind,
    keywords: c.keywords.join('|'),
    sort: i,
  }));
  const accs = SEED_ACCOUNTS.map((a, i) => ({
    user_id: userId,
    key: a.id,
    name: a.name,
    kind: a.kind,
    icon: a.icon,
    sort: i,
  }));

  const [catRes, accRes] = await Promise.all([
    db().from('categories').insert(cats),
    db().from('accounts').insert(accs),
  ]);
  if (catRes.error) throw catRes.error;
  if (accRes.error) throw accRes.error;
}

/* ------------------------------------------------------------------ */
/* reads                                                               */
/* ------------------------------------------------------------------ */

export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await db().from('categories').select('*').order('sort');
  if (error) throw error;
  return (data ?? []) as Category[];
}

export async function fetchAccounts(): Promise<Account[]> {
  const { data, error } = await db().from('accounts').select('*').eq('archived', false).order('sort');
  if (error) throw error;
  return (data ?? []) as Account[];
}

export async function fetchTxns(): Promise<Txn[]> {
  const { data, error } = await db()
    .from('transactions')
    .select('*')
    .is('deleted_at', null)
    .order('local_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(10000);
  if (error) throw error;
  return (data ?? []) as Txn[];
}

export async function fetchAliases(): Promise<Alias[]> {
  const { data, error } = await db().from('aliases').select('*').order('hits', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Alias[];
}

export async function fetchBudgets(): Promise<Budget[]> {
  const { data, error } = await db().from('budgets').select('*');
  if (error) throw error;
  return (data ?? []) as Budget[];
}

export async function fetchMessages(): Promise<ChatMessage[]> {
  const { data, error } = await db()
    .from('messages')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return ((data ?? []) as ChatMessage[]).reverse();
}

export async function fetchSettings(): Promise<Record<string, string>> {
  const { data, error } = await db().from('settings').select('key,value');
  if (error) throw error;
  const out: Record<string, string> = {};
  for (const row of data ?? []) out[(row as { key: string }).key] = (row as { value: string }).value;
  return out;
}

/* ------------------------------------------------------------------ */
/* writes                                                              */
/* ------------------------------------------------------------------ */

export async function insertTxn(userId: string, t: NewTxn): Promise<Txn> {
  const { data, error } = await db()
    .from('transactions')
    .insert({
      user_id: userId,
      amount_minor: Math.round(t.amount_minor),
      type: t.type,
      category_id: t.category_id || null,
      account_id: t.account_id ?? null,
      method: t.method ?? null,
      local_date: t.local_date,
      occurred_at: new Date(`${t.local_date}T12:00:00`).toISOString(),
      note: t.note ?? null,
      raw_input: t.raw_input ?? null,
      source: t.source ?? 'chat',
      confidence: t.confidence ?? 1,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Txn;
}

export async function insertTxns(userId: string, rows: NewTxn[]): Promise<Txn[]> {
  if (!rows.length) return [];
  const { data, error } = await db()
    .from('transactions')
    .insert(
      rows.map((t) => ({
        user_id: userId,
        amount_minor: Math.round(t.amount_minor),
        type: t.type,
        category_id: t.category_id || null,
        account_id: t.account_id ?? null,
        method: t.method ?? null,
        local_date: t.local_date,
        occurred_at: new Date(`${t.local_date}T12:00:00`).toISOString(),
        note: t.note ?? null,
        raw_input: t.raw_input ?? null,
        source: t.source ?? 'chat',
        confidence: t.confidence ?? 1,
      }))
    )
    .select();
  if (error) throw error;
  return (data ?? []) as Txn[];
}

export async function updateTxn(id: string, patch: Partial<NewTxn>) {
  const body: Record<string, unknown> = {};
  if (patch.amount_minor !== undefined) body.amount_minor = Math.round(patch.amount_minor);
  if (patch.type !== undefined) body.type = patch.type;
  if (patch.category_id !== undefined) body.category_id = patch.category_id || null;
  if (patch.account_id !== undefined) body.account_id = patch.account_id;
  if (patch.method !== undefined) body.method = patch.method;
  if (patch.note !== undefined) body.note = patch.note;
  if (patch.local_date !== undefined) {
    body.local_date = patch.local_date;
    body.occurred_at = new Date(`${patch.local_date}T12:00:00`).toISOString();
  }
  const { error } = await db().from('transactions').update(body).eq('id', id);
  if (error) throw error;
}

export async function softDeleteTxn(id: string) {
  const { error } = await db().from('transactions').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

export async function learnAlias(userId: string, keyword: string, categoryId: string) {
  const k = keyword.trim().toLowerCase();
  if (!k || k.length < 2 || /^\d+$/.test(k)) return;
  const { data: existing } = await db()
    .from('aliases')
    .select('id,hits')
    .eq('user_id', userId)
    .eq('keyword', k)
    .maybeSingle();

  if (existing) {
    await db()
      .from('aliases')
      .update({
        category_id: categoryId,
        hits: (existing as { hits: number }).hits + 1,
        last_used_at: new Date().toISOString(),
      })
      .eq('id', (existing as { id: string }).id);
  } else {
    await db().from('aliases').insert({ user_id: userId, keyword: k, category_id: categoryId });
  }
}

export async function deleteAlias(id: string) {
  const { error } = await db().from('aliases').delete().eq('id', id);
  if (error) throw error;
}

export async function saveCategory(
  userId: string,
  c: { id?: string; key?: string; name: string; icon: string; color: string; kind: 'expense' | 'income'; keywords: string }
) {
  if (c.id) {
    const { error } = await db()
      .from('categories')
      .update({ name: c.name, icon: c.icon, color: c.color, kind: c.kind, keywords: c.keywords })
      .eq('id', c.id);
    if (error) throw error;
    return c.id;
  }
  const key = (c.key ?? c.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')) + '_' + Math.random().toString(36).slice(2, 6);
  const { data, error } = await db()
    .from('categories')
    .insert({ user_id: userId, key, name: c.name, icon: c.icon, color: c.color, kind: c.kind, keywords: c.keywords, sort: 999 })
    .select()
    .single();
  if (error) throw error;
  return (data as Category).id;
}

export async function setCategoryArchived(id: string, archived: boolean) {
  const { error } = await db().from('categories').update({ archived }).eq('id', id);
  if (error) throw error;
}

export async function saveAccount(userId: string, a: { id?: string; name: string; kind: string; icon: string }) {
  if (a.id) {
    const { error } = await db().from('accounts').update({ name: a.name, kind: a.kind, icon: a.icon }).eq('id', a.id);
    if (error) throw error;
    return a.id;
  }
  const key = a.name.toLowerCase().replace(/[^a-z0-9]+/g, '_') + '_' + Math.random().toString(36).slice(2, 6);
  const { data, error } = await db()
    .from('accounts')
    .insert({ user_id: userId, key, name: a.name, kind: a.kind, icon: a.icon, sort: 999 })
    .select()
    .single();
  if (error) throw error;
  return (data as Account).id;
}

export async function archiveAccount(id: string) {
  const { error } = await db().from('accounts').update({ archived: true }).eq('id', id);
  if (error) throw error;
}

export async function setBudget(userId: string, categoryId: string | null, amountMinor: number) {
  const query = db().from('budgets').select('id').eq('user_id', userId);
  const { data: existing } = categoryId
    ? await query.eq('category_id', categoryId).maybeSingle()
    : await query.is('category_id', null).maybeSingle();

  const id = (existing as { id: string } | null)?.id;

  if (amountMinor <= 0) {
    if (id) await db().from('budgets').delete().eq('id', id);
    return;
  }
  if (id) {
    await db().from('budgets').update({ amount_minor: Math.round(amountMinor) }).eq('id', id);
  } else {
    await db()
      .from('budgets')
      .insert({ user_id: userId, category_id: categoryId, amount_minor: Math.round(amountMinor) });
  }
}

export async function addMessage(
  userId: string,
  m: { role: 'user' | 'app'; kind: ChatMessage['kind']; text: string; txn_id?: string | null; payload?: unknown }
): Promise<ChatMessage> {
  const { data, error } = await db()
    .from('messages')
    .insert({
      user_id: userId,
      role: m.role,
      kind: m.kind,
      text: m.text,
      txn_id: m.txn_id ?? null,
      payload: m.payload ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as ChatMessage;
}

export async function deleteMessage(id: string) {
  await db().from('messages').delete().eq('id', id);
}

export async function clearMessages(userId: string) {
  await db().from('messages').delete().eq('user_id', userId);
}

export async function setSetting(userId: string, key: string, value: string) {
  await db().from('settings').upsert({ user_id: userId, key, value }, { onConflict: 'user_id,key' });
}

export async function wipeAllData(userId: string) {
  await db().from('messages').delete().eq('user_id', userId);
  await db().from('transactions').delete().eq('user_id', userId);
  await db().from('aliases').delete().eq('user_id', userId);
  await db().from('budgets').delete().eq('user_id', userId);
}

/* ------------------------------------------------------------------ */
/* joining                                                             */
/* ------------------------------------------------------------------ */

export function withCategory(txns: Txn[], categories: Category[]): TxnView[] {
  const map = new Map(categories.map((c) => [c.id, c]));
  return txns.map((t) => {
    const c = t.category_id ? map.get(t.category_id) : undefined;
    return {
      ...t,
      cat_name: c?.name ?? 'Uncategorised',
      cat_icon: c?.icon ?? '📦',
      cat_color: c?.color ?? '#90A4AE',
      cat_key: c?.key ?? 'other',
    };
  });
}
