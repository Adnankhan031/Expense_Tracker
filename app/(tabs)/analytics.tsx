import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { Bars, Donut, GroupedBars, HBar, TrendLine } from '../../src/charts';
import { RangeStats, rangeStats } from '../../src/analytics';
import { firstTxnDate } from '../../src/db';
import { useData, useSettings } from '../../src/store';
import { cycleEndFor, cycleLabel, currentCycle } from '../../src/cycle';
import { radius, space, useTheme } from '../../src/theme';
import { Card, Chip, EmptyState, Money, Screen, SectionTitle, Segmented, tap } from '../../src/ui';
import { DatePickerSheet } from '../../src/pickers';
import {
  addDays,
  currentMonth,
  dayLabel,
  monthEnd,
  monthLabel,
  monthStart,
  shiftMonth,
  todayLocal,
} from '../../src/format';
import { CategoryIcon } from '../../src/icons';

type Period = 'month' | '3m' | '6m' | '12m' | 'all' | 'custom';

const OPTIONS: { value: Period; label: string }[] = [
  { value: 'month', label: 'Cycle' },
  { value: '3m', label: '3M' },
  { value: '6m', label: '6M' },
  { value: '12m', label: '1Y' },
  { value: 'all', label: 'All' },
  { value: 'custom', label: 'Range' },
];

export default function AnalyticsScreen() {
  const t = useTheme();
  const dataVersion = useData((s) => s.version);
  const { cycleStartDay } = useSettings();
  const [period, setPeriod] = useState<Period>('6m');
  // custom window, defaulting to the last 30 days so the pickers open somewhere useful
  const [from, setFrom] = useState(() => addDays(todayLocal(), -29));
  const [to, setTo] = useState(() => todayLocal());
  const [picking, setPicking] = useState<'from' | 'to' | null>(null);
  const [stats, setStats] = useState<RangeStats | null>(null);
  const [prev, setPrev] = useState<RangeStats | null>(null);

  const bounds = useMemo(() => {
    const cur = currentMonth();
    const today = todayLocal();
    if (period === 'month') {
      const c = currentCycle(todayLocal(), cycleStartDay);
      return { from: c, to: cycleEndFor(c, cycleStartDay), label: cycleLabel(c, cycleStartDay) };
    }
    if (period === 'all') {
      const first = firstTxnDate() ?? monthStart(cur);
      return { from: first, to: today, label: 'All time' };
    }
    if (period === 'custom') {
      const lo = from <= to ? from : to;
      const hi = from <= to ? to : from;
      return { from: lo, to: hi, label: `${dayLabel(lo)} – ${dayLabel(hi)}` };
    }
    const back = period === '3m' ? 2 : period === '6m' ? 5 : 11;
    return { from: monthStart(shiftMonth(cur, -back)), to: monthEnd(cur), label: `Last ${back + 1} months` };
  }, [period, from, to, cycleStartDay]);

  const load = useCallback(() => {
    setStats(rangeStats(bounds.from, bounds.to, bounds.label));
    if (period !== 'all' && period !== 'custom') {
      const cur = currentMonth();
      const back = period === 'month' ? 1 : period === '3m' ? 3 : period === '6m' ? 6 : 12;
      const prevFrom = monthStart(shiftMonth(cur, -(back * 2 - 1)));
      const prevTo = monthEnd(shiftMonth(cur, -back));
      setPrev(rangeStats(prevFrom, prevTo, 'previous'));
    } else {
      setPrev(null);
    }
  }, [bounds, period]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load, dataVersion])
  );

  React.useEffect(() => {
    load();
  }, [load]);

  if (!stats) return <Screen />;

  const monthBars = stats.months.map((m) => ({
    label: m.label,
    value: m.expense,
    highlight: m.ym === currentMonth(),
  }));

  const prevCatMap = new Map((prev?.byCategory ?? []).map((c) => [c.category_id, c.total]));
  const maxWeekday = Math.max(1, ...stats.weekday.map((w) => w.value));
  const busiestDay = stats.weekday.reduce((a, b) => (b.value > a.value ? b : a), stats.weekday[0]);

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Text style={{ color: t.ink, fontSize: 28, fontWeight: '800', letterSpacing: -0.8, marginBottom: 4 }}>
          Analytics
        </Text>
        <Text style={{ color: t.dim, fontSize: 13, marginBottom: space.lg }}>{stats.label}</Text>

        <Segmented options={OPTIONS} value={period} onChange={setPeriod} />

        {period === 'custom' && (
          <Card style={{ marginTop: space.md }}>
            <Text
              style={{
                color: t.faint,
                fontSize: 11,
                fontWeight: '700',
                letterSpacing: 1,
                textTransform: 'uppercase',
                marginBottom: 10,
              }}
            >
              Pick a window
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(['from', 'to'] as const).map((which) => (
                <Pressable
                  key={which}
                  onPress={() => { tap(); setPicking(which); }}
                  style={{
                    flex: 1,
                    backgroundColor: t.sunken,
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: t.line,
                    borderRadius: radius.md,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                  }}
                >
                  <Text style={{ color: t.dim, fontSize: 10.5, fontWeight: '700', textTransform: 'capitalize' }}>
                    {which}
                  </Text>
                  <Text style={{ color: t.ink, fontSize: 14, fontWeight: '700', marginTop: 2 }}>
                    {dayLabel(which === 'from' ? from : to)}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
              {([['7 days', 6], ['30 days', 29], ['90 days', 89], ['1 year', 364]] as const).map(([label, back]) => (
                <Chip
                  key={label}
                  label={label}
                  small
                  onPress={() => {
                    setFrom(addDays(todayLocal(), -back));
                    setTo(todayLocal());
                  }}
                />
              ))}
            </View>
            <Text style={{ color: t.faint, fontSize: 11, marginTop: 8 }}>
              {stats.days} day{stats.days === 1 ? '' : 's'} selected
            </Text>
          </Card>
        )}

        {stats.count === 0 ? (
          <Card style={{ marginTop: space.lg }}>
            <EmptyState icon="📊" title="No data in this window" body="Log a few expenses and the charts fill in automatically." />
          </Card>
        ) : (
          <>
            {/* headline numbers */}
            <View style={{ flexDirection: 'row', gap: space.md, marginTop: space.lg }}>
              <BigStat label="Spent" value={<Money minor={stats.expense} size={22} />} />
              <BigStat label="Earned" value={<Money minor={stats.income} size={22} color={t.up} />} />
            </View>
            <View style={{ flexDirection: 'row', gap: space.md, marginTop: space.md }}>
              <BigStat label="Per day" value={<Money minor={Math.round(stats.avgPerDay)} size={19} />} />
              <BigStat label="Per month" value={<Money minor={Math.round(stats.avgPerMonth)} size={19} />} />
              <BigStat
                label="Entries"
                value={<Text style={{ color: t.ink, fontSize: 19, fontWeight: '700' }}>{stats.count}</Text>}
              />
            </View>

            {/* monthly trend */}
            <SectionTitle>Monthly trend</SectionTitle>
            <Card>
              {stats.months.length > 2 ? (
                <TrendLine
                  values={stats.months.map((m) => m.expense)}
                  labels={stats.months.map((m) => m.label)}
                  height={140}
                />
              ) : (
                <Bars data={monthBars} height={120} />
              )}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: space.md }}>
                <Text style={{ color: t.faint, fontSize: 11.5 }}>
                  Highest: {monthLabel(stats.months.reduce((a, b) => (b.expense > a.expense ? b : a), stats.months[0]).ym, true)}
                </Text>
                <Money
                  minor={Math.max(0, ...stats.months.map((m) => m.expense))}
                  size={11.5}
                  weight="700"
                  color={t.faint}
                  compact
                />
              </View>
            </Card>

            {/* income vs expense */}
            <SectionTitle>Income vs spending</SectionTitle>
            <Card>
              <GroupedBars data={stats.months.map((m) => ({ label: m.label, expense: m.expense, income: m.income }))} height={130} />
              <View style={{ flexDirection: 'row', gap: space.lg, marginTop: space.md }}>
                <Legend color={t.down} label="Spent" />
                <Legend color={t.up} label="Earned" />
                <View style={{ flex: 1 }} />
                <Text style={{ color: stats.income - stats.expense >= 0 ? t.up : t.down, fontSize: 12, fontWeight: '700' }}>
                  {stats.income - stats.expense >= 0 ? 'Saved ' : 'Short by '}
                </Text>
                <Money
                  minor={Math.abs(stats.income - stats.expense)}
                  size={12}
                  color={stats.income - stats.expense >= 0 ? t.up : t.down}
                  compact
                />
              </View>
            </Card>

            {/* categories with change */}
            <SectionTitle>Category breakdown</SectionTitle>
            <Card>
              <View style={{ alignItems: 'center', marginBottom: space.lg }}>
                <Donut
                  data={stats.byCategory.slice(0, 8).map((c) => ({ value: c.total, color: c.color, label: c.name }))}
                  size={158}
                  thickness={19}
                >
                  <Money minor={stats.expense} size={18} compact />
                  <Text style={{ color: t.faint, fontSize: 10 }}>total</Text>
                </Donut>
              </View>
              <View style={{ gap: 14 }}>
                {stats.byCategory.map((c) => {
                  const before = prevCatMap.get(c.category_id) ?? 0;
                  const delta = before > 0 ? ((c.total - before) / before) * 100 : null;
                  return (
                    <Pressable
                      key={c.category_id}
                      onPress={() => { tap(); router.push({ pathname: '/category/[id]', params: { id: c.category_id } }); }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 5 }}>
                        <CategoryIcon name={c.icon} size={14} color={c.color} />
                        <Text style={{ color: t.ink, fontSize: 13.5, fontWeight: '600', flex: 1 }} numberOfLines={1}>
                          {c.name}
                        </Text>
                        {delta !== null && Math.abs(delta) >= 5 && (
                          <Text style={{ color: delta > 0 ? t.down : t.brand, fontSize: 11, fontWeight: '700' }}>
                            {delta > 0 ? '+' : ''}
                            {Math.round(delta)}%
                          </Text>
                        )}
                        <Money minor={c.total} size={13.5} weight="700" />
                      </View>
                      <HBar fraction={c.total / (stats.byCategory[0]?.total || 1)} color={c.color} />
                      <Text style={{ color: t.faint, fontSize: 10.5, marginTop: 4 }}>
                        {c.count} entries · {Math.round((c.total / stats.expense) * 100)}% of spending
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Card>

            {/* weekday */}
            <SectionTitle>Spending by weekday</SectionTitle>
            <Card>
              <Bars
                data={stats.weekday.map((w) => ({
                  label: w.label,
                  value: w.value,
                  highlight: w.value === maxWeekday,
                }))}
                height={96}
              />
              <Text style={{ color: t.dim, fontSize: 12.5, marginTop: space.md }}>
                {busiestDay ? `${busiestDay.label === 'S' ? 'Weekends' : 'Your heaviest day'} aside, ` : ''}you spend most on
                the highlighted day.
              </Text>
            </Card>

            {/* methods */}
            {stats.methods.length > 0 && (
              <>
                <SectionTitle>How you paid</SectionTitle>
                <Card>
                  <View style={{ gap: 12 }}>
                    {stats.methods.map((m) => (
                      <View key={m.method}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
                          <Text style={{ color: t.ink, fontSize: 13.5, fontWeight: '600', flex: 1 }}>{m.method}</Text>
                          <Text style={{ color: t.faint, fontSize: 11, marginRight: 8 }}>{m.count}×</Text>
                          <Money minor={m.total} size={13} weight="700" />
                        </View>
                        <HBar fraction={m.total / (stats.methods[0]?.total || 1)} color={t.info} />
                      </View>
                    ))}
                  </View>
                </Card>
              </>
            )}

            {/* records */}
            <SectionTitle>Records</SectionTitle>
            <Card>
              <View style={{ gap: 14 }}>
                {stats.biggestDay && (
                  <RecordRow
                    icon="🔥"
                    title="Heaviest day"
                    sub={dayLabel(stats.biggestDay.date)}
                    value={<Money minor={stats.biggestDay.total} size={15} />}
                  />
                )}
                {stats.biggestTxn && (
                  <RecordRow
                    icon="💸"
                    title="Biggest single expense"
                    sub={`${stats.biggestTxn.note} · ${dayLabel(stats.biggestTxn.date)}`}
                    value={<Money minor={stats.biggestTxn.amount} size={15} />}
                  />
                )}
                <RecordRow
                  icon="🧾"
                  title="Average entry"
                  sub={`${stats.count} entries logged`}
                  value={<Money minor={stats.count ? Math.round(stats.expense / stats.count) : 0} size={15} />}
                />
              </View>
            </Card>

            {/* frequent */}
            {stats.merchants.length > 0 && (
              <>
                <SectionTitle>Most frequent</SectionTitle>
                <Card>
                  <View style={{ gap: 11 }}>
                    {stats.merchants.map((m) => (
                      <View key={m.note} style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={{ color: t.ink, fontSize: 13.5, flex: 1, textTransform: 'capitalize' }} numberOfLines={1}>
                          {m.note}
                        </Text>
                        <View
                          style={{
                            backgroundColor: t.sunken,
                            paddingHorizontal: 7,
                            paddingVertical: 2,
                            borderRadius: radius.pill,
                            marginRight: 8,
                          }}
                        >
                          <Text style={{ color: t.dim, fontSize: 10.5, fontWeight: '700' }}>{m.count}×</Text>
                        </View>
                        <Money minor={m.total} size={13} weight="700" />
                      </View>
                    ))}
                  </View>
                </Card>
              </>
            )}
          </>
        )}
      </ScrollView>

      <DatePickerSheet
        visible={picking !== null}
        value={picking === 'to' ? to : from}
        title={picking === 'to' ? 'Range end' : 'Range start'}
        onClose={() => setPicking(null)}
        onPick={(d) => {
          if (picking === 'to') setTo(d);
          else setFrom(d);
          setPicking(null);
        }}
      />
    </Screen>
  );
}

function BigStat({ label, value }: { label: string; value: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: t.surface, borderRadius: radius.md, padding: 13 }}>
      <Text style={{ color: t.faint, fontSize: 10.5, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' }}>
        {label}
      </Text>
      <View style={{ marginTop: 4 }}>{value}</View>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <View style={{ width: 9, height: 9, borderRadius: 2.5, backgroundColor: color }} />
      <Text style={{ color: t.dim, fontSize: 11.5 }}>{label}</Text>
    </View>
  );
}

function RecordRow({ icon, title, sub, value }: { icon: string; title: string; sub: string; value: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
      
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.ink, fontSize: 13.5, fontWeight: '600' }}>{title}</Text>
        <Text style={{ color: t.faint, fontSize: 11.5, marginTop: 1 }} numberOfLines={1}>
          {sub}
        </Text>
      </View>
      {value}
    </View>
  );
}
