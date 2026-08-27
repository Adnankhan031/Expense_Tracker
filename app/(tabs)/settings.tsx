import React, { useState } from 'react';
import { Alert, Linking, Platform, ScrollView, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import * as Updates from 'expo-updates';
import * as Sharing from 'expo-sharing';
import Constants from 'expo-constants';

import { allTxns, clearMessages, listAliases, totalTxnCount, wipeAllData } from '../../src/db';
import { useData, useSettings } from '../../src/store';
import { radius, space, useTheme } from '../../src/theme';
import { Button, Card, Chip, Divider, Money, Row, Screen, SectionTitle, Segmented, tap } from '../../src/ui';
import { firstTxnDate } from '../../src/db';
import { dayLabel } from '../../src/format';

export default function SettingsScreen() {
  const t = useTheme();
  const { themeMode, setThemeMode, currency, setCurrency, numberStyle, setNumberStyle } = useSettings();
  const { reload, version, accounts, defaultAccountId, setDefaultAccount } = useData();
  const [busy, setBusy] = useState(false);
  const [updateMsg, setUpdateMsg] = useState<string | null>(null);

  const count = totalTxnCount();
  const since = firstTxnDate();
  const aliasCount = listAliases().length;

  const exportCsv = async () => {
    try {
      setBusy(true);
      const rows = allTxns();
      if (!rows.length) {
        Alert.alert('Nothing to export', 'Add a few entries first.');
        return;
      }
      const header = 'date,type,category,amount,method,note,source\n';
      const body = rows
        .map((r) =>
          [
            r.local_date,
            r.type,
            `"${(r.cat_name ?? '').replace(/"/g, '""')}"`,
            (r.amount_minor / 100).toFixed(2),
            r.method ?? '',
            `"${(r.note ?? '').replace(/"/g, '""')}"`,
            r.source,
          ].join(',')
        )
        .join('\n');

      const FS = await import('expo-file-system');
      const file = new FS.File(FS.Paths.cache, `spendly-${new Date().toISOString().slice(0, 10)}.csv`);
      try {
        file.delete();
      } catch {}
      file.create();
      file.write(header + body);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Export expenses' });
      } else {
        Alert.alert('Saved', file.uri);
      }
    } catch (e: any) {
      Alert.alert('Export failed', String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const checkUpdate = async () => {
    if (__DEV__) {
      setUpdateMsg('Updates are disabled in development. This works in a build.');
      return;
    }
    try {
      setBusy(true);
      setUpdateMsg('Checking…');
      const res = await Updates.checkForUpdateAsync();
      if (res.isAvailable) {
        setUpdateMsg('Downloading update…');
        await Updates.fetchUpdateAsync();
        await Updates.reloadAsync();
      } else {
        setUpdateMsg('You are on the latest version.');
      }
    } catch (e: any) {
      setUpdateMsg(`Could not check: ${String(e?.message ?? e)}`);
    } finally {
      setBusy(false);
    }
  };

  const confirmWipe = () => {
    Alert.alert('Delete everything?', 'All transactions, chat history, budgets and learned words will be erased. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete all',
        style: 'destructive',
        onPress: () => {
          wipeAllData();
          reload();
        },
      },
    ]);
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        <Text style={{ color: t.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.8 }}>Settings</Text>
        <Text style={{ color: t.textDim, fontSize: 13, marginTop: 3 }}>
          {count} entries{since ? ` since ${dayLabel(since)}` : ''} · {aliasCount} learned words
        </Text>

        {/* backfill */}
        <SectionTitle>Catching up</SectionTitle>
        <Card onPress={() => router.push('/backfill')}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: t.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="time-outline" size={22} color={t.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.text, fontSize: 15.5, fontWeight: '700' }}>Add past months</Text>
              <Text style={{ color: t.textDim, fontSize: 12.5, marginTop: 2, lineHeight: 17 }}>
                Starting mid-year? Enter earlier months as a lump sum per category, paste a whole list at once, or add
                day by day.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={t.textFaint} />
          </View>
        </Card>

        {/* appearance */}
        <SectionTitle>Appearance</SectionTitle>
        <Card>
          <Text style={{ color: t.textDim, fontSize: 12, fontWeight: '600', marginBottom: 8 }}>Theme</Text>
          <Segmented
            options={[
              { value: 'system', label: 'System' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
            value={themeMode}
            onChange={setThemeMode}
          />

          <Text style={{ color: t.textDim, fontSize: 12, fontWeight: '600', marginTop: space.lg, marginBottom: 8 }}>
            Currency
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {['₹', '$', '€', '£', '¥', 'AED', '₦'].map((c) => (
              <Chip key={c} label={c} active={currency === c} onPress={() => setCurrency(c)} />
            ))}
          </View>

          <Text style={{ color: t.textDim, fontSize: 12, fontWeight: '600', marginTop: space.lg, marginBottom: 8 }}>
            Number grouping
          </Text>
          <Segmented
            options={[
              { value: 'indian', label: '1,00,000' },
              { value: 'international', label: '100,000' },
            ]}
            value={numberStyle}
            onChange={setNumberStyle}
          />
        </Card>

        {/* default account */}
        {accounts.length > 0 && (
          <>
            <SectionTitle>Default account for chat entries</SectionTitle>
            <Card>
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                <Chip label="None" active={!defaultAccountId} onPress={() => setDefaultAccount(null)} />
                {accounts.map((a) => (
                  <Chip
                    key={a.id}
                    icon={a.icon}
                    label={a.name}
                    active={defaultAccountId === a.id}
                    onPress={() => setDefaultAccount(a.id)}
                  />
                ))}
              </View>
            </Card>
          </>
        )}

        {/* manage */}
        <SectionTitle>Manage</SectionTitle>
        <Card>
          <Row
            left={<Ionicons name="pricetags-outline" size={20} color={t.textDim} />}
            title="Categories"
            subtitle="Add, rename, recolour, or hide"
            right={<Ionicons name="chevron-forward" size={17} color={t.textFaint} />}
            onPress={() => router.push('/manage/categories')}
          />
          <Divider />
          <Row
            left={<Ionicons name="speedometer-outline" size={20} color={t.textDim} />}
            title="Budgets"
            subtitle="Monthly caps overall and per category"
            right={<Ionicons name="chevron-forward" size={17} color={t.textFaint} />}
            onPress={() => router.push('/manage/budgets')}
          />
          <Divider />
          <Row
            left={<Ionicons name="wallet-outline" size={20} color={t.textDim} />}
            title="Accounts"
            subtitle="Cash, bank, card, wallet"
            right={<Ionicons name="chevron-forward" size={17} color={t.textFaint} />}
            onPress={() => router.push('/manage/accounts')}
          />
          <Divider />
          <Row
            left={<Ionicons name="sparkles-outline" size={20} color={t.textDim} />}
            title="Learned words"
            subtitle={`${aliasCount} words mapped to categories`}
            right={<Ionicons name="chevron-forward" size={17} color={t.textFaint} />}
            onPress={() => router.push('/manage/learned')}
          />
        </Card>

        {/* data */}
        <SectionTitle>Data</SectionTitle>
        <Card>
          <Row
            left={<Ionicons name="download-outline" size={20} color={t.textDim} />}
            title="Export as CSV"
            subtitle="Share every entry as a spreadsheet"
            onPress={exportCsv}
          />
          <Divider />
          <Row
            left={<Ionicons name="chatbubbles-outline" size={20} color={t.textDim} />}
            title="Clear chat history"
            subtitle="Keeps all transactions, empties the thread"
            onPress={() => {
              clearMessages();
              reload();
            }}
          />
          <Divider />
          <Row
            left={<Ionicons name="trash-outline" size={20} color={t.danger} />}
            title="Delete all data"
            subtitle="Cannot be undone"
            danger
            onPress={confirmWipe}
          />
        </Card>

        {/* updates */}
        <SectionTitle>App</SectionTitle>
        <Card>
          <Row
            left={<Ionicons name="cloud-download-outline" size={20} color={t.textDim} />}
            title="Check for updates"
            subtitle={updateMsg ?? 'New versions install over the air — no reinstall needed'}
            onPress={checkUpdate}
          />
          <Divider />
          <View style={{ paddingTop: 12, gap: 4 }}>
            <Meta label="Version" value={Constants.expoConfig?.version ?? '1.0.0'} />
            <Meta label="Runtime" value={Updates.runtimeVersion ?? 'dev'} />
            <Meta label="Channel" value={Updates.channel ?? 'development'} />
            <Meta label="Update ID" value={Updates.updateId ? Updates.updateId.slice(0, 8) : 'embedded'} />
            <Meta label="Platform" value={Platform.OS} />
          </View>
        </Card>

        <Text style={{ color: t.textFaint, fontSize: 11.5, textAlign: 'center', marginTop: space.xl, lineHeight: 17 }}>
          Everything is stored on this device.{'\n'}Nothing leaves your phone.
        </Text>
      </ScrollView>
    </Screen>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row' }}>
      <Text style={{ color: t.textFaint, fontSize: 12, flex: 1 }}>{label}</Text>
      <Text style={{ color: t.textDim, fontSize: 12, fontWeight: '600' }}>{value}</Text>
    </View>
  );
}
