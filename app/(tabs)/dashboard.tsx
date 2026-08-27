import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Check, ChevronLeft, ChevronRight, Search, X } from 'lucide-react-native';
import { router, useFocusEffect } from 'expo-router';

import { Bars, Donut, HBar, Ring } from '../../src/charts';
import { MonthStats, buildInsights, periodStats } from '../../src/analytics';
import { TxnWithCategory, pendingReimbursements, searchTxns, settleReimbursement } from '../../src/db';
import { useData, useSettings } from '../../src/store';
import { cycleEndFor, cycleLabel, cycleStartingIn, currentCycle, shiftCycle } from '../../src/cycle';
import { radius, space, useTheme } from '../../src/theme';
import { Card, EmptyState, IconBadge, Money, Screen, SectionTitle, tap } from '../../src/ui';
import { MonthPickerSheet } from '../../src/pickers';
import { currentMonth, formatMoney, monthLabel, shiftMonth, shortDayLabel, todayLocal } from '../../src/format';
import { TxnEditor } from '../../src/TxnEditor';
import { CategoryIcon, IconTile } from '../../src/icons';

export default function DashboardScreen() {
  const t = useTheme();
  const { currency } = useSettings();
  const { version, reload } = useData();
  const { cycleStartDay } = useSettings();
  const [cycle, setCycle] = useState(() => currentCycle(todayLocal(), cycleStartDay));
  const curCycle = currentCycle(todayLocal(), cycleStartDay);
  const from = cycle;
  const to = cycleEndFor(cycle, cycleStartDay);
  const prevCycle = shiftCycle(cycle, -1, cycleStartDay);
  const [stats, setStats] = useState<MonthStats | null>(null);
  const [recent, setRecent] = useState<TxnWithCategory[]>([]);
  const [owed, setOwed] = useState<TxnWithCategory[]>([]);
  const [showMonth, setShowMonth] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const fmt = useCallback(
    (m: number) => formatMoney(m, { symbol: currency.symbol, style: currency.grouping, digits: currency.digits }),
    [currency]
  );

  const load = useCallback(() => {
    const s = periodStats(from, to, prevCycle, cycleEndFor(prevCycle, cycleStartDay));
    setStats(s);
    setRecent(searchTxns({ from: s.from, to: s.to, limit: 6 }));
    setOwed(pendingReimbursements());
  }, [from, to, prevCycle, cycleStartDay]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load, version])
  );

  React.useEffect(() => {
    load();
  }, [load]);

  if (!stats) return <Screen />;

  const insights = buildInsights(stats, fmt);
  const slices = stats.byCategory.slice(0, 8).map((c) => ({ value: c.total, color: c.color, label: c.name }));
  const budgetPct = stats.budgetTotal > 0 ? stats.budgetUsed / stats.budgetTotal : 0;
  const isCurrent = cycle === curCycle;

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* month switcher */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space.lg }}>
          <Pressable onPress={() => { tap(); setCycle(shiftCycle(cycle, -1, cycleStartDay)); }} hitSlop={14}>
            <ChevronLeft size={24} color={t.dim} />
          </Pressable>
          <Pressable onPress={() => { tap(); setShowMonth(true); }} style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ color: t.ink, fontSize: 20, fontWeight: '800', letterSpacing: -0.5 }}>{cycleLabel(cycle, cycleStartDay)}</Text>
            <Text style={{ color: t.faint, fontSize: 11, marginTop: 1 }}>
              {stats.count} {stats.count === 1 ? 'entry' : 'entries'}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => { tap(); if (cycle < curCycle) setCycle(shiftCycle(cycle, 1, cycleStartDay)); }}
            hitSlop={14}
            style={{ opacity: cycle < curCycle ? 1 : 0.25 }}
          >
            <ChevronRight size={24} color={t.dim} />
          </Pressable>
        </View>

        {stats.count === 0 ? (
          <Card>
            <EmptyState
              icon="🗓"
              title={`Nothing logged in ${cycleLabel(cycle, cycleStartDay)}`}
              body={
                isCurrent
                  ? 'Head to the Add tab and type your first expense.'
                  : 'Add entries for this month by hand from the Add entries screen.'
              }
            />
            {!isCurrent && (
              <Pressable
                onPress={() => { tap(); router.push('/manual'); }}
                style={{ alignSelf: 'center', backgroundColor: t.brandSoft, paddingHorizontal: 16, paddingVertical: 9, borderRadius: radius.pill }}
              >
                <Text style={{ color: t.brand, fontWeight: '700' }}>Add entries manually</Text>
              </Pressable>
            )}
          </Card>
        ) : (
          <>
            {/* hero */}
            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.dim, fontSize: 12.5, fontWeight: '600' }}>Total spent</Text>
                  <Money minor={stats.expense} size={38} style={{ marginTop: 2 }} />
                  {stats.deltaPct !== null && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
                      <Text style={{ color: stats.deltaPct > 0 ? t.down : t.up, fontSize: 12 }}>{stats.deltaPct > 0 ? '▲' : '▼'}</Text>
                      <Text style={{ color: stats.deltaPct > 0 ? t.down : t.brand, fontSize: 12.5, fontWeight: '700' }}>
                        {Math.abs(Math.round(stats.deltaPct))}% vs last period
                      </Text>
                    </View>
                  )}
                </View>
                {stats.budgetTotal > 0 && (
                  <Ring progress={budgetPct} size={82} thickness={8}>
                    <Text style={{ color: t.ink, fontWeight: '800', fontSize: 15 }}>{Math.round(budgetPct * 100)}%</Text>
                    <Text style={{ color: t.faint, fontSize: 9.5 }}>of budget</Text>
                  </Ring>
                )}
              </View>

              <View style={{ flexDirection: 'row', marginTop: space.lg, gap: space.md }}>
                <Stat label="Income" value={<Money minor={stats.income} size={16} color={t.up} />} />
                <Stat
                  label="Net"
                  value={<Money minor={stats.net} size={16} color={stats.net >= 0 ? t.up : t.down} prefix={stats.net >= 0 ? '+' : ''} />}
                />
                <Stat label="Per day" value={<Money minor={Math.round(stats.avgPerDay)} size={16} />} />
                {isCurrent && <Stat label="Projected" value={<Money minor={stats.projected} size={16} compact />} />}
              </View>
            </Card>

            {/* daily bars */}
            <SectionTitle>Day by day</SectionTitle>
            <Card>
              <Bars data={stats.daily} height={104} labelEvery={5} />
            </Card>

            {/* donut */}
            <SectionTitle right={<Pressable onPress={() => { tap(); router.push('/analytics'); }}><Text style={{ color: t.brand, fontSize: 12, fontWeight: '700' }}>More</Text></Pressable>}>
              Where it went
            </SectionTitle>
            <Card>
              <View style={{ alignItems: 'center', marginBottom: space.lg }}>
                <Donut data={slices} size={168} thickness={20}>
                  <Money minor={stats.expense} size={20} compact />
                  <Text style={{ color: t.faint, fontSize: 10.5, marginTop: 1 }}>
                    {stats.byCategory.length} categories
                  </Text>
                </Donut>
              </View>
              <View style={{ gap: 13 }}>
                {stats.byCategory.slice(0, 8).map((c) => (
                  <Pressable
                    key={c.category_id}
                    onPress={() => { tap(); router.push({ pathname: '/category/[id]', params: { id: c.category_id, from, to } }); }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 5 }}>
                      <CategoryIcon name={c.icon} size={14} color={c.color} />
                      <Text style={{ color: t.ink, fontSize: 13.5, fontWeight: '600', flex: 1 }}>{c.name}</Text>
                      <Text style={{ color: t.faint, fontSize: 11, fontWeight: '600' }}>
                        {Math.round((c.total / stats.expense) * 100)}%
                      </Text>
                      <Money minor={c.total} size={13.5} weight="700" />
                    </View>
                    <HBar fraction={c.total / (stats.byCategory[0]?.total || 1)} color={c.color} />
                  </Pressable>
                ))}
              </View>
            </Card>

            {owed.length > 0 && (
              <>
                <SectionTitle>Coming back to you</SectionTitle>
                <Card>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space.md }}>
                    <Text style={{ color: t.dim, fontSize: 12.5, flex: 1 }}>
                      {owed.length} unsettled {owed.length === 1 ? 'expense' : 'expenses'}
                    </Text>
                    <Money minor={owed.reduce((a, b) => a + b.amount_minor, 0)} size={18} color={t.up} />
                  </View>
                  {owed.map((x, i) => (
                    <View
                      key={x.id}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 10,
                        paddingVertical: 9,
                        borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth,
                        borderTopColor: t.line,
                      }}
                    >
                      <IconTile name={x.cat_icon} color={x.cat_color} size={30} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: t.ink, fontSize: 13.5, fontWeight: '600' }} numberOfLines={1}>
                          {x.note || x.cat_name}
                        </Text>
                        <Text style={{ color: t.faint, fontSize: 11 }}>{shortDayLabel(x.local_date)}</Text>
                      </View>
                      <Money minor={x.amount_minor} size={13.5} />
                      <Pressable
                        onPress={() => { tap(); settleReimbursement(x.id); load(); }}
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 5,
                          borderRadius: radius.pill,
                          backgroundColor: t.upSoft,
                        }}
                      >
                        <Text style={{ color: t.up, fontSize: 11, fontWeight: '700' }}>Got it</Text>
                      </Pressable>
                    </View>
                  ))}
                </Card>
              </>
            )}

            {/* insights */}
            {insights.length > 0 && (
              <>
                <SectionTitle>What stands out</SectionTitle>
                <View style={{ gap: 8 }}>
                  {insights.map((ins, i) => (
                    <View
                      key={i}
                      style={{
                        flexDirection: 'row',
                        gap: 10,
                        backgroundColor: t.surface,
                        borderRadius: radius.md,
                        padding: 13,
                        borderLeftWidth: 3,
                        borderLeftColor:
                          ins.tone === 'bad' ? t.down : ins.tone === 'warn' ? t.warn : ins.tone === 'good' ? t.brand : t.lineStrong,
                      }}
                    >
                      
                      <Text style={{ color: t.dim, fontSize: 13.5, lineHeight: 19, flex: 1 }}>{ins.text}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            {/* recent */}
            <SectionTitle right={<Pressable onPress={() => { tap(); router.push('/history'); }}><Text style={{ color: t.brand, fontSize: 12, fontWeight: '700' }}>See all</Text></Pressable>}>
              Recent
            </SectionTitle>
            <Card>
              {recent.map((x, i) => (
                <Pressable
                  key={x.id}
                  onPress={() => { tap(); setEditingId(x.id); }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: space.md,
                    paddingVertical: 10,
                    borderTopWidth: i === 0 ? 0 : 1,
                    borderTopColor: t.line,
                  }}
                >
                  <IconTile name={x.cat_icon} color={x.cat_color} size={34} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: t.ink, fontSize: 14.5, fontWeight: '600' }}>{x.note || x.cat_name}</Text>
                    <Text style={{ color: t.faint, fontSize: 11.5, marginTop: 1 }}>
                      {shortDayLabel(x.local_date)}
                      {x.method ? ` · ${x.method}` : ''}
                    </Text>
                  </View>
                  <Money
                    minor={x.amount_minor}
                    size={15}
                    color={x.type === 'income' ? t.up : t.ink}
                    prefix={x.type === 'income' ? '+' : ''}
                  />
                </Pressable>
              ))}
            </Card>
          </>
        )}
      </ScrollView>

      <MonthPickerSheet
        visible={showMonth}
        value={cycle.slice(0, 7)}
        onClose={() => setShowMonth(false)}
        onPick={(m) => {
          setCycle(cycleStartingIn(m, cycleStartDay));
          setShowMonth(false);
        }}
      />
      <TxnEditor
        visible={!!editingId}
        txnId={editingId}
        onClose={() => setEditingId(null)}
        onSaved={() => {
          reload();
          load();
        }}
      />
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color: t.faint, fontSize: 10.5, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' }}>
        {label}
      </Text>
      <View style={{ marginTop: 3 }}>{value}</View>
    </View>
  );
}
