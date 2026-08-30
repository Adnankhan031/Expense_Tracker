import React, { useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { CalendarClock, Check, ChevronLeft, ChevronRight, CloudUpload, Search, X } from 'lucide-react-native';
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
import { CURRENCIES } from '../../src/currency';
import { useAuth } from '../../src/auth';
import { laptopConfig, laptopReachable, preferCloud, saveLaptopConfig, setPreferCloud } from '../../src/laptop';
import { cycleEndFor, cycleLabel, currentCycle } from '../../src/cycle';
import { todayLocal } from '../../src/format';

export default function SettingsScreen() {
  const t = useTheme();
  const { themeMode, setThemeMode, currency, setCurrencyCode, cycleStartDay, setCycleStartDay } = useSettings();
  const { reload, version, accounts, defaultAccountId, setDefaultAccount } = useData();
  const [busy, setBusy] = useState(false);
  const { user, syncing, lastSynced, syncError, sync, signOut } = useAuth();
  const [updateMsg, setUpdateMsg] = useState<string | null>(null);

  const savedLaptop = laptopConfig();
  const [laptopUrl, setLaptopUrl] = useState(savedLaptop?.url ?? '');
  const [laptopKey, setLaptopKey] = useState(savedLaptop?.key ?? '');
  const [laptopState, setLaptopState] = useState<'idle' | 'saved' | 'testing' | 'up' | 'down'>('idle');
  const [cloudFirst, setCloudFirst] = useState(preferCloud());

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
        <Text style={{ color: t.ink, fontSize: 28, fontWeight: '800', letterSpacing: -0.8 }}>Settings</Text>
        <Text style={{ color: t.dim, fontSize: 13, marginTop: 3 }}>
          {count} entries{since ? ` since ${dayLabel(since)}` : ''} · {aliasCount} learned words
        </Text>

        {/* backfill */}
        <SectionTitle>Catching up</SectionTitle>
        <Card onPress={() => router.push('/manual')}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: t.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
              <ChevronRight size={22} color={t.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.ink, fontSize: 15.5, fontWeight: '700' }}>Add by day, week or month</Text>
              <Text style={{ color: t.dim, fontSize: 12.5, marginTop: 2, lineHeight: 17 }}>
                Full manual control for any date - including months from before you started.
              </Text>
            </View>
            <ChevronRight size={18} color={t.faint} />
          </View>
        </Card>

        {/* appearance */}
        <SectionTitle>Account & sync</SectionTitle>
        {user ? (
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: radius.md,
                  backgroundColor: t.brandSoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: t.brand, fontSize: 16, fontWeight: '800' }}>
                  {(user.email ?? '?').slice(0, 1).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.ink, fontSize: 14.5, fontWeight: '700' }} numberOfLines={1}>
                  {(user.user_metadata as { full_name?: string })?.full_name || user.email}
                </Text>
                <Text style={{ color: t.faint, fontSize: 11.5, marginTop: 1 }}>
                  {syncing
                    ? 'Syncing…'
                    : syncError
                      ? 'Last sync failed — will retry'
                      : lastSynced
                        ? `Synced ${new Date(lastSynced).toLocaleString()}`
                        : 'Not synced yet'}
                </Text>
              </View>
            </View>

            {!!syncError && (
              <Text style={{ color: t.down, fontSize: 11.5, marginTop: 10, lineHeight: 16 }}>{syncError}</Text>
            )}

            <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.lg }}>
              <Button title="Sync now" onPress={() => void sync()} loading={syncing} style={{ flex: 1 }} />
              <Button title="Sign out" variant="ghost" onPress={() => void signOut()} style={{ flex: 1 }} />
            </View>
          </Card>
        ) : (
          <Card onPress={() => router.push('/auth')}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: radius.md,
                  backgroundColor: t.brandSoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <CloudUpload size={20} color={t.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.ink, fontSize: 15.5, fontWeight: '700' }}>Sign in to sync</Text>
                <Text style={{ color: t.dim, fontSize: 12.5, marginTop: 2, lineHeight: 17 }}>
                  Back up this phone and share one set of expenses with the web app. Everything you have logged so far
                  comes with you.
                </Text>
              </View>
              <ChevronRight size={17} color={t.faint} />
            </View>
          </Card>
        )}

        <SectionTitle>Your month</SectionTitle>
        <Card>
          <Text style={{ color: t.dim, fontSize: 12.5, lineHeight: 18 }}>
            If your salary lands on a set day, your month probably runs from that day rather than the 1st. Overview,
            budgets and insights all follow this.
          </Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.lg }}>
            <Pressable
              onPress={() => { tap(); setCycleStartDay(cycleStartDay - 1); }}
              disabled={cycleStartDay <= 1}
              style={{
                width: 38,
                height: 38,
                borderRadius: radius.md,
                backgroundColor: t.sunken,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: cycleStartDay <= 1 ? 0.35 : 1,
              }}
            >
              <Text style={{ color: t.ink, fontSize: 19, fontWeight: '700' }}>–</Text>
            </Pressable>

            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ color: t.brand, fontSize: 26, fontWeight: '800' }}>
                {cycleStartDay === 1 ? '1st' : ordinal(cycleStartDay)}
              </Text>
              <Text style={{ color: t.faint, fontSize: 11, marginTop: 1 }}>starts on the</Text>
            </View>

            <Pressable
              onPress={() => { tap(); setCycleStartDay(cycleStartDay + 1); }}
              disabled={cycleStartDay >= 31}
              style={{
                width: 38,
                height: 38,
                borderRadius: radius.md,
                backgroundColor: t.sunken,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: cycleStartDay >= 31 ? 0.35 : 1,
              }}
            >
              <Text style={{ color: t.ink, fontSize: 19, fontWeight: '700' }}>+</Text>
            </Pressable>
          </View>

          <View
            style={{
              marginTop: space.md,
              backgroundColor: t.brandSoft,
              borderRadius: radius.md,
              paddingHorizontal: 12,
              paddingVertical: 10,
            }}
          >
            <Text style={{ color: t.brand, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' }}>
              Right now that means
            </Text>
            <Text style={{ color: t.ink, fontSize: 14.5, fontWeight: '700', marginTop: 3 }}>
              {cycleLabel(currentCycle(todayLocal(), cycleStartDay), cycleStartDay)}
            </Text>
          </View>

          {cycleStartDay > 28 && (
            <Text style={{ color: t.warn, fontSize: 11.5, marginTop: 8, lineHeight: 16 }}>
              Months shorter than this start on their last day instead — February included.
            </Text>
          )}
        </Card>

        <SectionTitle>Planned</SectionTitle>
        <Card onPress={() => router.push('/commitments')}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: radius.md,
                backgroundColor: t.brandSoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CalendarClock size={20} color={t.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.ink, fontSize: 15.5, fontWeight: '700' }}>Upcoming commitments</Text>
              <Text style={{ color: t.dim, fontSize: 12.5, marginTop: 2, lineHeight: 17 }}>
                Rent, passes, renewals — anything you already know is coming. Confirm it on the day and it becomes a
                normal entry.
              </Text>
            </View>
            <ChevronRight size={17} color={t.faint} />
          </View>
        </Card>

        <SectionTitle>Appearance</SectionTitle>
        <Card>
          <Text style={{ color: t.dim, fontSize: 12, fontWeight: '600', marginBottom: 8 }}>Theme</Text>
          <Segmented
            options={[
              { value: 'system', label: 'System' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
            value={themeMode}
            onChange={setThemeMode}
          />

          <Text style={{ color: t.dim, fontSize: 12, fontWeight: '600', marginTop: space.lg, marginBottom: 8 }}>
            Currency
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {CURRENCIES.map((c) => {
              const on = currency.code === c.code;
              return (
                <Pressable
                  key={c.code}
                  onPress={() => { tap(); setCurrencyCode(c.code); }}
                  style={({ pressed }) => ({
                    width: '31%',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    padding: 9,
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: on ? t.brand : t.line,
                    backgroundColor: on ? t.brandSoft : t.sunken,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <View
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: radius.sm,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: on ? t.brand : t.raised,
                    }}
                  >
                    <Text style={{ color: on ? t.onBrand : t.dim, fontSize: 14, fontWeight: '700' }}>
                      {c.symbol.trim()}
                    </Text>
                  </View>
                  <Text style={{ color: t.ink, fontSize: 12, fontWeight: '700' }}>{c.code}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={{ color: t.faint, fontSize: 11, lineHeight: 16, marginTop: 8 }}>
            {currency.digits === 0
              ? `${currency.name} has no decimal places, so amounts show as whole ${currency.code}.`
              : `Grouped ${currency.grouping === 'indian' ? 'the Indian way (1,00,000)' : 'as 100,000'}.`}
          </Text>
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
        <SectionTitle>Laptop service</SectionTitle>
        <Card>
          <Pressable
            onPress={() => {
              tap();
              const next = !cloudFirst;
              setCloudFirst(next);
              setPreferCloud(next);
            }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
          >
            <View
              style={{
                width: 46,
                height: 28,
                borderRadius: 14,
                backgroundColor: cloudFirst ? t.brand : t.line,
                justifyContent: 'center',
                paddingHorizontal: 3,
              }}
            >
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  backgroundColor: '#fff',
                  alignSelf: cloudFirst ? 'flex-end' : 'flex-start',
                }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.ink, fontSize: 14.5, fontWeight: '600' }}>
                {cloudFirst ? 'Use the cloud first' : 'Use this laptop first'}
              </Text>
              <Text style={{ color: t.dim, fontSize: 11.5, marginTop: 2, lineHeight: 16 }}>
                {cloudFirst
                  ? 'Faster and more accurate, but limited to about 50 reads a day.'
                  : 'Slower — roughly 25 seconds — but unlimited and free.'}
              </Text>
            </View>
          </Pressable>

          {!laptopUrl.trim() && (
            <View
              style={{
                flexDirection: 'row',
                gap: 10,
                backgroundColor: t.downSoft,
                borderRadius: radius.md,
                padding: 12,
                marginTop: space.sm,
              }}
            >
              <Text style={{ color: t.down, fontSize: 12.5, lineHeight: 18, flex: 1 }}>
                No address set, so this toggle does nothing yet and the cloud is used for both
                reading and translating. That still works — it just spends two of the fifty daily
                requests per receipt instead of one.
              </Text>
            </View>
          )}

          <Text style={{ color: t.faint, fontSize: 11.5, lineHeight: 16, marginTop: space.sm }}>
            This picks who reads the photo. Whichever you choose, the other is tried if the first
            cannot answer, and the phone reads it as a last resort.
          </Text>
          <Text style={{ color: t.faint, fontSize: 11.5, lineHeight: 16, marginTop: 8 }}>
            Translation prefers this laptop, because it is free and unlimited. Without one the
            cloud translates instead, which costs a second request per receipt — about
            twenty-five receipts a day, and every translation is cached for ever.
          </Text>

          <TextInput
            value={laptopUrl}
            onChangeText={setLaptopUrl}
            placeholder="https://something.trycloudflare.com"
            placeholderTextColor={t.faint}
            autoCapitalize="none"
            autoCorrect={false}
            style={{
              backgroundColor: t.sunken,
              borderRadius: radius.md,
              paddingHorizontal: 14,
              paddingVertical: 12,
              color: t.ink,
              fontSize: 14.5,
              marginTop: space.md,
            }}
          />
          <TextInput
            value={laptopKey}
            onChangeText={setLaptopKey}
            placeholder="Shared key (SPENDLY_KEY)"
            placeholderTextColor={t.faint}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            style={{
              backgroundColor: t.sunken,
              borderRadius: radius.md,
              paddingHorizontal: 14,
              paddingVertical: 12,
              color: t.ink,
              fontSize: 14.5,
              marginTop: 8,
            }}
          />

          <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md }}>
            <Button
              title="Save"
              onPress={() => {
                tap();
                saveLaptopConfig(laptopUrl, laptopKey);
                setLaptopState('saved');
              }}
              style={{ flex: 1 }}
            />
            <Button
              title="Test"
              variant="ghost"
              loading={laptopState === 'testing'}
              onPress={async () => {
                tap();
                saveLaptopConfig(laptopUrl, laptopKey);
                setLaptopState('testing');
                setLaptopState((await laptopReachable()) ? 'up' : 'down');
              }}
              style={{ flex: 1 }}
            />
          </View>

          {laptopState !== 'idle' && (
            <Text
              style={{
                color: laptopState === 'down' ? t.down : laptopState === 'up' ? t.up : t.dim,
                fontSize: 12.5,
                marginTop: 10,
              }}
            >
              {laptopState === 'saved' && 'Saved.'}
              {laptopState === 'testing' && 'Checking…'}
              {laptopState === 'up' && 'Reachable — it will take over when the cloud limit runs out.'}
              {laptopState === 'down' &&
                'No answer. Check the laptop is awake, the service is running, and the key matches.'}
            </Text>
          )}
        </Card>

        <SectionTitle>Manage</SectionTitle>
        <Card>
          <Row
            left={<ChevronRight size={20} color={t.dim} />}
            title="Categories"
            subtitle="Add, rename, recolour, or hide"
            right={<ChevronRight size={17} color={t.faint} />}
            onPress={() => router.push('/manage/categories')}
          />
          <Divider />
          <Row
            left={<ChevronRight size={20} color={t.dim} />}
            title="Budgets"
            subtitle="Monthly caps overall and per category"
            right={<ChevronRight size={17} color={t.faint} />}
            onPress={() => router.push('/manage/budgets')}
          />
          <Divider />
          <Row
            left={<ChevronRight size={20} color={t.dim} />}
            title="Accounts"
            subtitle="Cash, bank, card, wallet"
            right={<ChevronRight size={17} color={t.faint} />}
            onPress={() => router.push('/manage/accounts')}
          />
          <Divider />
          <Row
            left={<ChevronRight size={20} color={t.dim} />}
            title="Learned words"
            subtitle={`${aliasCount} words mapped to categories`}
            right={<ChevronRight size={17} color={t.faint} />}
            onPress={() => router.push('/manage/learned')}
          />
        </Card>

        {/* data */}
        <SectionTitle>Data</SectionTitle>
        <Card>
          <Row
            left={<ChevronRight size={20} color={t.dim} />}
            title="Export as CSV"
            subtitle="Share every entry as a spreadsheet"
            onPress={exportCsv}
          />
          <Divider />
          <Row
            left={<ChevronRight size={20} color={t.dim} />}
            title="Clear chat history"
            subtitle="Keeps all transactions, empties the thread"
            onPress={() => {
              clearMessages();
              reload();
            }}
          />
          <Divider />
          <Row
            left={<ChevronRight size={20} color={t.down} />}
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
            left={<ChevronRight size={20} color={t.dim} />}
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

        <Text style={{ color: t.faint, fontSize: 11.5, textAlign: 'center', marginTop: space.xl, lineHeight: 17 }}>
          {user
            ? 'Stored on this device, and backed up to your account.'
            : 'Everything is stored on this device. Sign in to back it up.'}
        </Text>
      </ScrollView>
    </Screen>
  );
}

function ordinal(n: number) {
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th';
  return `${n}${suffix}`;
}

function Meta({ label, value }: { label: string; value: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row' }}>
      <Text style={{ color: t.faint, fontSize: 12, flex: 1 }}>{label}</Text>
      <Text style={{ color: t.dim, fontSize: 12, fontWeight: '600' }}>{value}</Text>
    </View>
  );
}
