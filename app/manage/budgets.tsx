import React, { useMemo, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';

import { listBudgets, setBudget, totalsByCategory } from '../../src/db';
import { useData, useSettings } from '../../src/store';
import { cycleEndFor, cycleLabel, currentCycle } from '../../src/cycle';
import { todayLocal } from '../../src/format';
import { radius, space, useTheme } from '../../src/theme';
import { Button, Card, IconBadge, Money, Screen, SectionTitle } from '../../src/ui';
import { HBar } from '../../src/charts';
import { currentMonth, monthEnd, monthLabel, monthStart, toMinor } from '../../src/format';
import { IconTile } from '../../src/icons';

export default function BudgetsScreen() {
  const t = useTheme();
  const { currency, cycleStartDay } = useSettings();
  const { categories, reload, version } = useData();
  const [values, setValues] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);

  const cycle = currentCycle(todayLocal(), cycleStartDay);
  const cycleEnd = cycleEndFor(cycle, cycleStartDay);
  const ym = currentMonth();
  const spent = useMemo(
    () => new Map(totalsByCategory(cycle, cycleEnd, 'expense').map((c) => [c.category_id, c.total])),
    [cycle, cycleEnd, version]
  );
  const totalSpent = useMemo(() => Array.from(spent.values()).reduce((a, b) => a + b, 0), [spent]);

  React.useEffect(() => {
    if (loaded) return;
    const next: Record<string, string> = {};
    for (const b of listBudgets()) {
      next[b.category_id ?? '__all__'] = String(b.amount_minor / 100);
    }
    setValues(next);
    setLoaded(true);
  }, [loaded]);

  const save = () => {
    setBudget(null, values['__all__'] ? toMinor(Number(values['__all__'])) : 0);
    for (const c of categories) {
      const v = values[c.id];
      setBudget(c.id, v ? toMinor(Number(v)) : 0);
    }
    reload();
  };

  const overall = Number(values['__all__'] || 0);
  const expenseCats = categories.filter((c) => c.kind === 'expense');

  const field = (key: string) => (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: t.sunken,
        borderRadius: radius.sm,
        paddingHorizontal: 10,
        minWidth: 112,
      }}
    >
      <Text style={{ color: t.faint, fontSize: 14 }}>{currency.symbol}</Text>
      <TextInput
        value={values[key] ?? ''}
        onChangeText={(v) => setValues((s) => ({ ...s, [key]: v.replace(/[^0-9.]/g, '') }))}
        keyboardType="decimal-pad"
        placeholder="—"
        placeholderTextColor={t.faint}
        style={{
          flex: 1,
          color: t.ink,
          fontSize: 15,
          fontWeight: '700',
          paddingVertical: 9,
          paddingLeft: 5,
          textAlign: 'right',
          fontVariant: ['tabular-nums'],
        }}
      />
    </View>
  );

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        <Text style={{ color: t.dim, fontSize: 13, lineHeight: 19 }}>
          Monthly caps. Leave a category blank for no limit. You'll see progress rings on the Overview tab and a nudge
          once you cross 80%.
        </Text>

        <SectionTitle>Overall budget</SectionTitle>
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.ink, fontSize: 15, fontWeight: '600' }}>Everything, {cycleLabel(cycle, cycleStartDay)}</Text>
              <Text style={{ color: t.faint, fontSize: 11.5, marginTop: 2 }}>
                Spent so far: {currency.symbol}
                {(totalSpent / 100).toLocaleString()}
              </Text>
            </View>
            {field('__all__')}
          </View>
          {overall > 0 && (
            <View style={{ marginTop: space.md }}>
              <HBar
                fraction={totalSpent / toMinor(overall)}
                color={totalSpent >= toMinor(overall) ? t.down : totalSpent >= toMinor(overall) * 0.8 ? t.warn : t.brand}
                height={9}
              />
            </View>
          )}
        </Card>

        <SectionTitle>Per category</SectionTitle>
        <Card>
          {expenseCats.map((c) => {
            const limit = Number(values[c.id] || 0);
            const used = spent.get(c.id) ?? 0;
            return (
              <View key={c.id} style={{ paddingVertical: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <IconTile name={c.icon} color={c.color} size={34} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: t.ink, fontSize: 14.5, fontWeight: '600' }}>{c.name}</Text>
                    {used > 0 && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 }}>
                        <Money minor={used} size={11} weight="600" color={t.faint} />
                        <Text style={{ color: t.faint, fontSize: 11 }}>used</Text>
                      </View>
                    )}
                  </View>
                  {field(c.id)}
                </View>
                {limit > 0 && (
                  <View style={{ marginTop: 8, marginLeft: 44 }}>
                    <HBar
                      fraction={used / toMinor(limit)}
                      color={used >= toMinor(limit) ? t.down : used >= toMinor(limit) * 0.8 ? t.warn : c.color}
                    />
                  </View>
                )}
              </View>
            );
          })}
        </Card>

        <Button title="Save budgets" onPress={save} style={{ marginTop: space.lg }} />
      </ScrollView>
    </Screen>
  );
}
