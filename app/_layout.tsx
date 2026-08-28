import React, { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Text, View } from 'react-native';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import * as Updates from 'expo-updates';
import * as SystemUI from 'expo-system-ui';

import { initDb } from '../src/db';
import { useData, useSettings } from '../src/store';
import { useAuth } from '../src/auth';
import { useTheme } from '../src/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hydrate = useSettings((s) => s.hydrate);
  const reload = useData((s) => s.reload);
  const initAuth = useAuth((s) => s.init);

  useEffect(() => {
    try {
      initDb();
      hydrate();
      reload();
      setReady(true);
      // Restores the stored session and kicks off a background sync.
      void initAuth();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [hydrate, reload, initAuth]);

  if (error) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#0B0F14' }}>
        <Text style={{ color: '#FF7A7A', fontWeight: '700', marginBottom: 8 }}>Could not open the database</Text>
        <Text style={{ color: '#93A2B4', textAlign: 'center' }}>{error}</Text>
      </View>
    );
  }

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0B0F14' }}>
        <ActivityIndicator color="#3DDC97" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Shell />
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

/**
 * Apply over-the-air updates on launch instead of one launch late.
 *
 * fallbackToCacheTimeout is 0, so the runtime shows the cached bundle
 * immediately and fetches the new one in the background - which means a fresh
 * update only appears the *next* time the app is opened. Checking here and
 * reloading as soon as the download finishes makes it land on this launch.
 */
function useAutoUpdate() {
  useEffect(() => {
    if (__DEV__) return;
    let cancelled = false;
    (async () => {
      try {
        const check = await Updates.checkForUpdateAsync();
        if (cancelled || !check.isAvailable) return;
        const fetched = await Updates.fetchUpdateAsync();
        if (cancelled || !fetched.isNew) return;
        await Updates.reloadAsync();
      } catch {
        // offline, or updates disabled in this build - keep running the current bundle
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
}

/**
 * Push local changes up shortly after they happen, and again whenever the app
 * comes back to the foreground. Writes never wait on this — SQLite has already
 * accepted them — so losing signal only delays the upload.
 */
function useAutoSync() {
  const version = useData((s) => s.version);
  const user = useAuth((s) => s.user);

  useEffect(() => {
    if (!user) return;
    const id = setTimeout(() => void useAuth.getState().sync({ silent: true }), 4000);
    return () => clearTimeout(id);
  }, [version, user]);

  useEffect(() => {
    if (!user) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void useAuth.getState().sync({ silent: true });
    });
    return () => sub.remove();
  }, [user]);
}

function Shell() {
  const t = useTheme();
  useAutoUpdate();
  useAutoSync();

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(t.bg).catch(() => {});
  }, [t.bg]);

  /**
   * Without this the navigator runs on react-navigation's DefaultTheme, whose
   * background is white - so every tab change flashed white through the gap
   * between screens.
   */
  const navTheme = {
    ...(t.dark ? DarkTheme : DefaultTheme),
    colors: {
      ...(t.dark ? DarkTheme : DefaultTheme).colors,
      primary: t.brand,
      background: t.bg,
      card: t.surface,
      text: t.ink,
      border: t.line,
      notification: t.down,
    },
  };

  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style={t.dark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: t.bg },
          headerTintColor: t.ink,
          headerTitleStyle: { fontWeight: '700' },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: t.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="category/[id]" options={{ title: 'Category' }} />
        <Stack.Screen name="manual" options={{ title: 'Add entries' }} />
        <Stack.Screen name="auth" options={{ title: 'Account', presentation: 'modal' }} />
        <Stack.Screen name="commitments" options={{ title: 'Upcoming' }} />
        <Stack.Screen name="manage/categories" options={{ title: 'Categories' }} />
        <Stack.Screen name="manage/budgets" options={{ title: 'Budgets' }} />
        <Stack.Screen name="manage/accounts" options={{ title: 'Accounts' }} />
        <Stack.Screen name="manage/learned" options={{ title: 'Learned words' }} />
      </Stack>
    </ThemeProvider>
  );
}
