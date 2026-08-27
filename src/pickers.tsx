import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Button, Chip, IconBadge, Sheet, tap } from './ui';
import { radius, space, useTheme } from './theme';
import {
  MONTHS_SHORT,
  WEEKDAYS_SHORT,
  addDays,
  currentMonth,
  daysInMonth,
  fromLocalDate,
  monthKey,
  monthLabel,
  pad2,
  shiftMonth,
  todayLocal,
} from './format';
import type { Category, TxnType } from './db';

/* ------------------------------------------------------------------ */
/* calendar day picker                                                 */
/* ------------------------------------------------------------------ */

export function DatePickerSheet({
  visible,
  value,
  onClose,
  onPick,
  title = 'Pick a date',
}: {
  visible: boolean;
  value: string;
  onClose: () => void;
  onPick: (date: string) => void;
  title?: string;
}) {
  const t = useTheme();
  const [ym, setYm] = useState(monthKey(value || todayLocal()));
  React.useEffect(() => {
    if (visible) setYm(monthKey(value || todayLocal()));
  }, [visible, value]);

  const cells = useMemo(() => {
    const total = daysInMonth(ym);
    const firstDow = fromLocalDate(`${ym}-01`).getDay();
    const out: { date: string | null; day: number }[] = [];
    for (let i = 0; i < firstDow; i++) out.push({ date: null, day: 0 });
    for (let d = 1; d <= total; d++) out.push({ date: `${ym}-${pad2(d)}`, day: d });
    return out;
  }, [ym]);

  const today = todayLocal();

  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Chip label="Today" onPress={() => onPick(today)} active={value === today} />
        <Chip label="Yesterday" onPress={() => onPick(addDays(today, -1))} active={value === addDays(today, -1)} />
        <Chip label="2 days ago" onPress={() => onPick(addDays(today, -2))} active={value === addDays(today, -2)} />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.sm }}>
        <Pressable onPress={() => { tap(); setYm(shiftMonth(ym, -1)); }} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color={t.dim} />
        </Pressable>
        <Text style={{ color: t.ink, fontWeight: '700', fontSize: 16 }}>{monthLabel(ym)}</Text>
        <Pressable onPress={() => { tap(); setYm(shiftMonth(ym, 1)); }} hitSlop={12}>
          <Ionicons name="chevron-forward" size={22} color={t.dim} />
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row' }}>
        {WEEKDAYS_SHORT.map((d) => (
          <Text key={d} style={{ flex: 1, textAlign: 'center', color: t.faint, fontSize: 10.5, fontWeight: '700' }}>
            {d[0]}
          </Text>
        ))}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {cells.map((c, i) => {
          const selected = c.date === value;
          const isToday = c.date === today;
          const future = !!c.date && c.date > today;
          return (
            <View key={i} style={{ width: `${100 / 7}%`, aspectRatio: 1, padding: 3 }}>
              {c.date ? (
                <Pressable
                  onPress={() => { tap(); onPick(c.date!); }}
                  style={{
                    flex: 1,
                    borderRadius: radius.md,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: selected ? t.brand : isToday ? t.brandSoft : 'transparent',
                    opacity: future ? 0.35 : 1,
                  }}
                >
                  <Text
                    style={{
                      color: selected ? t.onBrand : isToday ? t.brand : t.ink,
                      fontWeight: selected || isToday ? '800' : '500',
                      fontSize: 14,
                    }}
                  >
                    {c.day}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          );
        })}
      </View>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* month picker                                                        */
/* ------------------------------------------------------------------ */

export function MonthPickerSheet({
  visible,
  value,
  onClose,
  onPick,
}: {
  visible: boolean;
  value: string;
  onClose: () => void;
  onPick: (ym: string) => void;
}) {
  const t = useTheme();
  const [year, setYear] = useState(+value.slice(0, 4));
  React.useEffect(() => {
    if (visible) setYear(+value.slice(0, 4));
  }, [visible, value]);
  const cur = currentMonth();

  return (
    <Sheet visible={visible} onClose={onClose} title="Pick a month">
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable onPress={() => { tap(); setYear(year - 1); }} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color={t.dim} />
        </Pressable>
        <Text style={{ color: t.ink, fontWeight: '800', fontSize: 18 }}>{year}</Text>
        <Pressable onPress={() => { tap(); setYear(year + 1); }} hitSlop={12}>
          <Ionicons name="chevron-forward" size={22} color={t.dim} />
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {MONTHS_SHORT.map((m, i) => {
          const ym = `${year}-${pad2(i + 1)}`;
          const selected = ym === value;
          const future = ym > cur;
          return (
            <View key={m} style={{ width: '33.33%', padding: 4 }}>
              <Pressable
                onPress={() => { tap(); onPick(ym); }}
                style={{
                  paddingVertical: 14,
                  borderRadius: radius.md,
                  alignItems: 'center',
                  backgroundColor: selected ? t.brand : t.sunken,
                  opacity: future ? 0.4 : 1,
                }}
              >
                <Text style={{ color: selected ? t.onBrand : t.ink, fontWeight: '700' }}>{m}</Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* category picker                                                     */
/* ------------------------------------------------------------------ */

export function CategoryPickerSheet({
  visible,
  categories,
  value,
  kind,
  onClose,
  onPick,
  allowAll,
}: {
  visible: boolean;
  categories: Category[];
  value: string | null;
  kind?: TxnType | 'all';
  onClose: () => void;
  onPick: (id: string | null) => void;
  allowAll?: boolean;
}) {
  const t = useTheme();
  const [q, setQ] = useState('');
  const list = categories
    .filter((c) => (kind && kind !== 'all' ? c.kind === kind : true))
    .filter((c) => (q ? c.name.toLowerCase().includes(q.toLowerCase()) : true));

  return (
    <Sheet visible={visible} onClose={onClose} title="Category">
      <TextInput
        placeholder="Search categories"
        placeholderTextColor={t.faint}
        value={q}
        onChangeText={setQ}
        style={{
          backgroundColor: t.sunken,
          borderRadius: radius.md,
          paddingHorizontal: 14,
          paddingVertical: 11,
          color: t.ink,
          fontSize: 15,
        }}
      />
      {allowAll && (
        <Pressable
          onPress={() => { tap(); onPick(null); }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 10 }}
        >
          <IconBadge icon="🗂" color={t.dim} />
          <Text style={{ color: t.ink, fontSize: 15, fontWeight: '600', flex: 1 }}>All categories</Text>
          {value === null && <Ionicons name="checkmark" size={20} color={t.brand} />}
        </Pressable>
      )}
      {list.map((c) => (
        <Pressable
          key={c.id}
          onPress={() => { tap(); onPick(c.id); }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 8 }}
        >
          <IconBadge icon={c.icon} color={c.color} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.ink, fontSize: 15, fontWeight: '600' }}>{c.name}</Text>
            <Text style={{ color: t.faint, fontSize: 11 }}>{c.kind === 'income' ? 'Income' : 'Expense'}</Text>
          </View>
          {value === c.id && <Ionicons name="checkmark" size={20} color={t.brand} />}
        </Pressable>
      ))}
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* amount keypad                                                       */
/* ------------------------------------------------------------------ */

export function AmountPad({
  value,
  onChange,
  onSubmit,
  submitLabel = 'Add',
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit?: () => void;
  submitLabel?: string;
}) {
  const t = useTheme();
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'];

  const press = (k: string) => {
    tap();
    if (k === 'del') return onChange(value.slice(0, -1));
    if (k === '.' && value.includes('.')) return;
    if (value.includes('.') && value.split('.')[1]?.length >= 2) return;
    if (value === '0' && k !== '.') return onChange(k);
    onChange(value + k);
  };

  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {keys.map((k) => (
          <View key={k} style={{ width: '33.33%', padding: 4 }}>
            <Pressable
              onPress={() => press(k)}
              style={({ pressed }) => ({
                paddingVertical: 16,
                borderRadius: radius.md,
                backgroundColor: pressed ? t.surface : t.sunken,
                alignItems: 'center',
              })}
            >
              {k === 'del' ? (
                <Ionicons name="backspace-outline" size={20} color={t.ink} />
              ) : (
                <Text style={{ color: t.ink, fontSize: 20, fontWeight: '600' }}>{k}</Text>
              )}
            </Pressable>
          </View>
        ))}
      </View>
      {!!onSubmit && <Button title={submitLabel} onPress={onSubmit} disabled={!value || Number(value) <= 0} />}
    </View>
  );
}

export function ScrollRow({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 16 }}>
      {children}
    </ScrollView>
  );
}
