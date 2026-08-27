import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, SectionList, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';

import { HeatGrid } from '../../src/charts';
import { TxnWithCategory, dailyTotals, searchTxns, softDeleteTxn, sumInRange } from '../../src/db';
import { useData, useSettings } from '../../src/store';
import { radius, space, useTheme } from '../../src/theme';
import { Card, Chip, EmptyState, IconBadge, Money, Screen, tap } from '../../src/ui';
import { CategoryPickerSheet, MonthPickerSheet } from '../../src/pickers';
import { TxnEditor } from '../../src/TxnEditor';
import {
  WEEKDAYS_SHORT,
  currentMonth,
  dayLabel,
  daysInMonth,
  fromLocalDate,
  monthEnd,
  monthLabel,
  monthStart,
  pad2,
  shiftMonth,
} from '../../src/format';
import { IconTile } from '../../src/icons';

export default function HistoryScreen() {
  const t = useTheme();
  const { categories, version, reload } = useData();
  const [ym, setYm] = useState(currentMonth());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [showCat, setShowCat] = useState(false);
  const [showMonth, setShowMonth] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [rows, setRows] = useState<TxnWithCategory[]>([]);
  const [heat, setHeat] = useState<Map<string, number>>(new Map());
  const [monthTotal, setMonthTotal] = useState(0);

  const from = monthStart(ym);
  const to = monthEnd(ym);

  const load = useCallback(() => {
    setRows(
      searchTxns({
        q: q.trim() || undefined,
        categoryId,
        from: selectedDay ?? from,
        to: selectedDay ?? to,
        limit: 800,
      })
    );
    setHeat(new Map(dailyTotals(from, to).map((d) => [d.local_date, d.total])));
    setMonthTotal(sumInRange(from, to, 'expense'));
  }, [q, categoryId, selectedDay, from, to]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load, version])
  );

  React.useEffect(() => {
    load();
  }, [load]);

  const cells = useMemo(() => {
    const total = daysInMonth(ym);
    const firstDow = fromLocalDate(`${ym}-01`).getDay();
    const out: { date: string; day: number; value: number; muted?: boolean }[] = [];
    for (let i = 0; i < firstDow; i++) out.push({ date: `pad-${i}`, day: 0, value: 0, muted: true });
    for (let d = 1; d <= total; d++) {
      const date = `${ym}-${pad2(d)}`;
      out.push({ date, day: d, value: heat.get(date) ?? 0 });
    }
    return out;
  }, [ym, heat]);

  const sections = useMemo(() => {
    const map = new Map<string, TxnWithCategory[]>();
    for (const r of rows) {
      if (!map.has(r.local_date)) map.set(r.local_date, []);
      map.get(r.local_date)!.push(r);
    }
    return Array.from(map.entries()).map(([date, data]) => ({
      title: date,
      total: data.filter((d) => d.type === 'expense').reduce((a, b) => a + b.amount_minor, 0),
      data,
    }));
  }, [rows]);

  const selectedCategory = categories.find((c) => c.id === categoryId);

  return (
    <Screen>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled
        contentContainerStyle={{ padding: space.lg, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={{ marginBottom: space.md }}>
            {/* month nav */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space.lg }}>
              <Pressable onPress={() => { tap(); setYm(shiftMonth(ym, -1)); setSelectedDay(null); }} hitSlop={14}>
                <Ionicons name="chevron-back" size={24} color={t.dim} />
              </Pressable>
              <Pressable onPress={() => { tap(); setShowMonth(true); }} style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ color: t.ink, fontSize: 20, fontWeight: '800', letterSpacing: -0.5 }}>{monthLabel(ym)}</Text>
                <Money minor={monthTotal} size={12} weight="600" color={t.faint} />
              </Pressable>
              <Pressable
                onPress={() => { tap(); if (ym < currentMonth()) { setYm(shiftMonth(ym, 1)); setSelectedDay(null); } }}
                hitSlop={14}
                style={{ opacity: ym < currentMonth() ? 1 : 0.25 }}
              >
                <Ionicons name="chevron-forward" size={24} color={t.dim} />
              </Pressable>
            </View>

            {/* heat calendar */}
            <Card>
              <View style={{ flexDirection: 'row', marginBottom: 6 }}>
                {WEEKDAYS_SHORT.map((d) => (
                  <Text key={d} style={{ flex: 1, textAlign: 'center', color: t.faint, fontSize: 10, fontWeight: '700' }}>
                    {d[0]}
                  </Text>
                ))}
              </View>
              <HeatGrid
                cells={cells}
                selected={selectedDay}
                onPress={(date) => setSelectedDay(selectedDay === date ? null : date)}
              />
              <Text style={{ color: t.faint, fontSize: 11, textAlign: 'center', marginTop: 8 }}>
                {selectedDay ? `Showing ${dayLabel(selectedDay)} — tap again to clear` : 'Tap a day to filter'}
              </Text>
            </Card>

            {/* filters */}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: space.md, alignItems: 'center' }}>
              <View
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 7,
                  backgroundColor: t.sunken,
                  borderRadius: radius.md,
                  paddingHorizontal: 12,
                }}
              >
                <Ionicons name="search" size={15} color={t.faint} />
                <TextInput
                  value={q}
                  onChangeText={setQ}
                  placeholder="Search notes"
                  placeholderTextColor={t.faint}
                  style={{ flex: 1, color: t.ink, fontSize: 14, paddingVertical: 10 }}
                />
                {!!q && (
                  <Pressable onPress={() => setQ('')} hitSlop={8}>
                    <Ionicons name="close-circle" size={16} color={t.faint} />
                  </Pressable>
                )}
              </View>
              <Chip
                label={selectedCategory ? selectedCategory.name : 'All'}
                icon={selectedCategory?.icon}
                active={!!selectedCategory}
                color={selectedCategory?.color}
                onPress={() => setShowCat(true)}
              />
            </View>

            {rows.length > 0 && (
              <Text style={{ color: t.faint, fontSize: 11.5, marginTop: space.md }}>
                {rows.length} {rows.length === 1 ? 'entry' : 'entries'}
              </Text>
            )}
          </View>
        }
        renderSectionHeader={({ section }) => (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: t.bg,
              paddingVertical: 7,
            }}
          >
            <Text style={{ color: t.dim, fontSize: 12, fontWeight: '700', flex: 1 }}>{dayLabel(section.title)}</Text>
            <Money minor={section.total} size={12} weight="700" color={t.faint} />
          </View>
        )}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => { tap(); setEditingId(item.id); }}
            onLongPress={() => {
              tap();
              softDeleteTxn(item.id);
              reload();
              load();
            }}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.md,
              backgroundColor: t.surface,
              borderRadius: radius.md,
              padding: 12,
              marginBottom: 7,
              opacity: pressed ? 0.75 : 1,
            })}
          >
            <IconTile name={item.cat_icon} color={item.cat_color} size={36} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.ink, fontSize: 14.5, fontWeight: '600' }} numberOfLines={1}>
                {item.note || item.cat_name}
              </Text>
              <Text style={{ color: t.faint, fontSize: 11.5, marginTop: 1 }}>
                {item.cat_name}
                {item.method ? ` · ${item.method}` : ''}
                {item.source === 'backfill' ? ' · backfilled' : ''}
              </Text>
            </View>
            <Money
              minor={item.amount_minor}
              size={15}
              color={item.type === 'income' ? t.up : t.ink}
              prefix={item.type === 'income' ? '+' : ''}
            />
          </Pressable>
        )}
        ListEmptyComponent={
          <EmptyState
            icon="🔍"
            title="Nothing here"
            body={
              q || categoryId || selectedDay
                ? 'No entries match those filters.'
                : `No entries in ${monthLabel(ym, true)} yet.`
            }
          />
        }
      />

      <CategoryPickerSheet
        visible={showCat}
        categories={categories}
        value={categoryId}
        kind="all"
        allowAll
        onClose={() => setShowCat(false)}
        onPick={(id) => {
          setCategoryId(id);
          setShowCat(false);
        }}
      />
      <MonthPickerSheet
        visible={showMonth}
        value={ym}
        onClose={() => setShowMonth(false)}
        onPick={(m) => {
          setYm(m);
          setSelectedDay(null);
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
