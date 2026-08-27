import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import * as Updates from 'expo-updates';
import * as SystemUI from 'expo-system-ui';

import { initDb } from '../src/db';
import { useData, useSettings } from '../src/store';
import { useTheme } from '../src/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hydrate = useSettings((s) => s.hydrate);
  const reload = useData((s) => s.reload);

  useEffect(() => {
    try {
      initDb();
      hydrate();
      reload();
      setReady(true);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [hydrate, reload]);

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

function Shell() {
  const t = useTheme();
  useAutoUpdate();

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(t.bg).catch(() => {});
  }, [t.bg]);

  return (
    <>
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
        <Stack.Screen name="manage/categories" options={{ title: 'Categories' }} />
        <Stack.Screen name="manage/budgets" options={{ title: 'Budgets' }} />
        <Stack.Screen name="manage/accounts" options={{ title: 'Accounts' }} />
        <Stack.Screen name="manage/learned" options={{ title: 'Learned words' }} />
      </Stack>
    </>
  );
}
