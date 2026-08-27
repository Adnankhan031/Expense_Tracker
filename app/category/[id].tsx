import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { Bars, HBar, Ring } from '../../src/charts';
import { TxnWithCategory, getCategory, listBudgets, searchTxns, sumInRange } from '../../src/db';
import { useData } from '../../src/store';
import { radius, space, useTheme } from '../../src/theme';
import { Card, EmptyState, IconBadge, Money, Screen, SectionTitle, Segmented, tap } from '../../src/ui';
import { TxnEditor } from '../../src/TxnEditor';
import {
  MONTHS_SHORT,
  currentMonth,
  dayLabel,
  monthEnd,
  monthLabel,
  monthStart,
  shiftMonth,
} from '../../src/format';
import { IconTile } from '../../src/icons';

type Span = '1m' | '6m' | '12m';

export default function CategoryDetail() {
  const t = useTheme();
  const params = useLocalSearchParams<{ id: string; ym?: string }>();
  const id = params.id;
  const { version, reload } = useData();
  const [span, setSpan] = useState<Span>('6m');
  const [rows, setRows] = useState<TxnWithCategory[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const category = useMemo(() => (id ? getCategory(id) : null), [id, version]);

  const range = useMemo(() => {
    const base = params.ym || currentMonth();
    if (span === '1m') return { from: monthStart(base), to: monthEnd(base), months: 1, label: monthLabel(base) };
    const back = span === '6m' ? 5 : 11;
    return {
      from: monthStart(shiftMonth(currentMonth(), -back)),
      to: monthEnd(currentMonth()),
      months: back + 1,
      label: `Last ${back + 1} months`,
    };
  }, [span, params.ym]);

  const load = useCallback(() => {
    if (!id) return;
    setRows(searchTxns({ categoryId: id, from: range.from, to: range.to, limit: 500 }));
  }, [id, range]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load, version, tick])
  );

  React.useEffect(() => {
    load();
  }, [load]);

  if (!category) {
    return (
      <Screen>
        <EmptyState icon="🤔" title="Category not found" />
      </Screen>
    );
  }

  const total = rows.filter((r) => r.type === 'expense').reduce((a, b) => a + b.amount_minor, 0);
  const budget = listBudgets().find((b) => b.category_id === id)?.amount_minor ?? 0;
  const thisMonth = sumInRange(monthStart(currentMonth()), monthEnd(currentMonth()), 'expense');
  void thisMonth;

  const monthBuckets = Array.from({ length: range.months }, (_, i) => {
    const ym = shiftMonth(currentMonth(), -(range.months - 1 - i));
    const from = monthStart(ym);
    const to = monthEnd(ym);
    const sum = rows
      .filter((r) => r.type === 'expense' && r.local_date >= from && r.local_date <= to)
      .reduce((a, b) => a + b.amount_minor, 0);
    return { label: MONTHS_SHORT[+ym.slice(5, 7) - 1], value: sum, highlight: ym === currentMonth() };
  });

  const currentMonthSpend = monthBuckets[monthBuckets.length - 1]?.value ?? 0;
  const avg = range.months > 0 ? Math.round(total / range.months) : 0;

  return (
    <Screen>
      <Stack.Screen options={{ title: category.name }} />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.lg }}>
          <IconTile name={category.icon} color={category.color} size={52} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.ink, fontSize: 22, fontWeight: '800', letterSpacing: -0.5 }}>{category.name}</Text>
            <Text style={{ color: t.dim, fontSize: 12.5 }}>
              {rows.length} entries · {range.label}
            </Text>
          </View>
          {budget > 0 && (
            <Ring progress={currentMonthSpend / budget} size={62} thickness={7}>
              <Text style={{ color: t.ink, fontWeight: '800', fontSize: 12 }}>
                {Math.round((currentMonthSpend / budget) * 100)}%
              </Text>
            </Ring>
          )}
        </View>

        <Segmented
          options={[
            { value: '1m', label: 'Month' },
            { value: '6m', label: '6 months' },
            { value: '12m', label: '1 year' },
          ]}
          value={span}
          onChange={setSpan}
        />

        <View style={{ flexDirection: 'row', gap: space.md, marginTop: space.lg }}>
          <Stat label="Total" value={<Money minor={total} size={20} />} />
          <Stat label="Per month" value={<Money minor={avg} size={20} />} />
          <Stat
            label="Per entry"
            value={<Money minor={rows.length ? Math.round(total / rows.length) : 0} size={20} />}
          />
        </View>

        {range.months > 1 && (
          <>
            <SectionTitle>Month by month</SectionTitle>
            <Card>
              <Bars data={monthBuckets} height={110} color={category.color} />
            </Card>
          </>
        )}

        {budget > 0 && (
          <>
            <SectionTitle>Budget</SectionTitle>
            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ color: t.dim, fontSize: 13, flex: 1 }}>
                  {monthLabel(currentMonth(), true)} so far
                </Text>
                <Money minor={currentMonthSpend} size={14} weight="700" />
                <Text style={{ color: t.faint, fontSize: 13 }}> / </Text>
                <Money minor={budget} size={14} weight="700" color={t.faint} />
              </View>
              <HBar
                fraction={currentMonthSpend / budget}
                color={currentMonthSpend >= budget ? t.down : currentMonthSpend >= budget * 0.8 ? t.warn : category.color}
                height={9}
              />
            </Card>
          </>
        )}

        <SectionTitle>Entries</SectionTitle>
        {rows.length === 0 ? (
          <Card>
            <EmptyState icon="🗒" title="No entries yet" body={`Nothing logged under ${category.name} in this window.`} />
          </Card>
        ) : (
          <Card>
            {rows.map((x, i) => (
              <Pressable
                key={x.id}
                onPress={() => { tap(); setEditingId(x.id); }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 11,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: t.line,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.ink, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>
                    {x.note || category.name}
                  </Text>
                  <Text style={{ color: t.faint, fontSize: 11.5, marginTop: 1 }}>
                    {dayLabel(x.local_date)}
                    {x.method ? ` · ${x.method}` : ''}
                  </Text>
                </View>
                <Money minor={x.amount_minor} size={14.5} />
              </Pressable>
            ))}
          </Card>
        )}
      </ScrollView>

      <TxnEditor
        visible={!!editingId}
        txnId={editingId}
        onClose={() => setEditingId(null)}
        onSaved={() => {
          reload();
          setTick((n) => n + 1);
        }}
      />
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
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
