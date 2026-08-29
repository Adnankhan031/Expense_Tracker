import 'react-native-url-polyfill/auto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { getSetting, setSetting } from './db';

/**
 * Sessions are persisted in the SQLite database the app already opens.
 *
 * Every other storage option (AsyncStorage, SecureStore) is a native module,
 * which would change the build fingerprint and force a reinstall. expo-sqlite is
 * already in the binary, so this keeps sync shippable over the air.
 */
const sqliteStorage = {
  getItem: async (key: string) => getSetting(`auth.${key}`),
  setItem: async (key: string, value: string) => {
    setSetting(`auth.${key}`, value);
  },
  removeItem: async (key: string) => {
    setSetting(`auth.${key}`, '');
  },
};

function config() {
  const extra = (Constants.expoConfig?.extra ?? {}) as { supabaseUrl?: string; supabaseAnonKey?: string };
  return {
    url: process.env.EXPO_PUBLIC_SUPABASE_URL ?? extra.supabaseUrl ?? '',
    key: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? extra.supabaseAnonKey ?? '',
  };
}

/** The project URL and publishable key, for callers that use fetch directly. */
export const supabaseConfig = config;

export const isSupabaseConfigured = () => {
  const { url, key } = config();
  return Boolean(url && key);
};

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (client) return client;
  const { url, key } = config();
  if (!url || !key) throw new Error('Supabase is not configured for this build.');

  client = createClient(url, key, {
    auth: {
      storage: sqliteStorage,
      persistSession: true,
      autoRefreshToken: true,
      // There is no URL bar to read a session out of on a phone.
      detectSessionInUrl: false,
    },
  });
  return client;
}
