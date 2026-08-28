import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from './supabase';
import { lastSyncError, lastSyncedAt, resetSyncState, syncNow } from './sync';
import { useData } from './store';

type AuthState = {
  user: User | null;
  /** undefined until the stored session has been read */
  ready: boolean;
  syncing: boolean;
  lastSynced: string | null;
  syncError: string | null;

  init: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<{ needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
  sync: (opts?: { silent?: boolean }) => Promise<void>;
};

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  ready: false,
  syncing: false,
  lastSynced: null,
  syncError: null,

  init: async () => {
    if (!isSupabaseConfigured()) {
      set({ ready: true });
      return;
    }
    try {
      const { data } = await supabase().auth.getSession();
      set({ user: data.session?.user ?? null, ready: true, lastSynced: lastSyncedAt(), syncError: lastSyncError() });

      supabase().auth.onAuthStateChange((_event, session) => {
        set({ user: session?.user ?? null });
      });

      if (data.session?.user) void get().sync({ silent: true });
    } catch {
      set({ ready: true });
    }
  },

  signIn: async (email, password) => {
    const { data, error } = await supabase().auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw error;
    set({ user: data.user });
    // First sync after signing in is what carries local history up to the account.
    await get().sync();
  },

  signUp: async (email, password, name) => {
    const { data, error } = await supabase().auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: name.trim() } },
    });
    if (error) throw error;
    if (!data.session) return { needsConfirmation: true };
    set({ user: data.user });
    await get().sync();
    return { needsConfirmation: false };
  },

  signOut: async () => {
    await supabase().auth.signOut();
    // The local database stays exactly as it is — signing out is not a delete.
    resetSyncState();
    set({ user: null, lastSynced: null, syncError: null });
  },

  sync: async ({ silent } = {}) => {
    const user = get().user;
    if (!user) return;
    if (!silent) set({ syncing: true });

    const result = await syncNow(user.id);

    set({
      syncing: false,
      lastSynced: result.ok ? result.at : get().lastSynced,
      syncError: result.ok ? null : (result.error ?? 'Sync failed'),
    });

    // Anything pulled down needs to reach the screens.
    if (result.ok && (result.pulled > 0 || result.pushed > 0)) useData.getState().reload();
  },
}));
