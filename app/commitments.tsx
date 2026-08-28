import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { CalendarClock, Check, ChevronRight, Plus, SkipForward, Trash2 } from 'lucide-react-native';

import {
  CommitmentView,
  Recurrence,
  deleteCommitment,
  listCommitments,
  saveCommitment,
  settleCommitment,
  skipCommitment,
} from '../src/db';
import { useData, useSettings } from '../src/store';
import { radius, space, useTheme } from '../src/theme';
import { Button, Card, Chip, EmptyState, Money, Screen, SectionTitle, Sheet, tap, tapSuccess } from '../src/ui';
import { CategoryPickerSheet, DatePickerSheet } from '../src/pickers';
import { IconTile } from '../src/icons';
import { addDays, dayLabel, toMinor, todayLocal } from '../src/format';

const RECURRENCE: { value: Recurrence; label: string }[] = [
  { value: 'once', label: 'One-off' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

export default function CommitmentsScreen() {
  const t = useTheme();
  const { fmt } = useCurrencyFmt();
  const { reload, version } = useData();
  const [rows, setRows] = useState<CommitmentView[]>([]);
  const [editing, setEditing] = useState<CommitmentView | null>(null);
  const [creating, setCreating] = useState(false);
  const [tick, setTick] = useState(0);

  const load = useCallback(() => setRows(listCommitments()), []);
  React.useEffect(() => {
    load();
  }, [load, version, tick]);
  useFocusEffect(useCallback(() => load(), [load]));

  const today = todayLocal();
  const soon = addDays(today, 30);

  const groups = useMemo(() => {
    const overdue = rows.filter((r) => r.due_date < today);
    const dueToday = rows.filter((r) => r.due_date === today);
    const upcoming = rows.filter((r) => r.due_date > today && r.due_date <= soon);
    const later = rows.filter((r) => r.due_date > soon);
    return { overdue, dueToday, upcoming, later };
  }, [rows, today, soon]);

  const committed = rows.filter((r) => r.due_date <= soon).reduce((a, b) => a + b.amount_minor, 0);

  const refresh = () => {
    reload();
    setTick((n) => n + 1);
  };

  const row = (c: CommitmentView, tone?: 'overdue' | 'today') => (
    <View
      key={c.id}
      style={{
        backgroundColor: t.surface,
        borderRadius: radius.lg,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: tone === 'overdue' ? t.down : tone === 'today' ? t.brand : t.line,
        padding: 14,
        marginBottom: 8,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <IconTile name={c.cat_icon} color={c.cat_color} size={38} />
        <Pressable style={{ flex: 1 }} onPress={() => { tap(); setEditing(c); }}>
          <Text style={{ color: t.ink, fontSize: 15, fontWeight: '700' }} numberOfLines={1}>
            {c.name}
          </Text>
          <Text style={{ color: tone === 'overdue' ? t.down : t.dim, fontSize: 12, marginTop: 2 }}>
            {tone === 'overdue' ? 'Overdue · ' : ''}
            {dayLabel(c.due_date)}
            {c.recurrence !== 'once' ? ` · ${c.recurrence}` : ''}
          </Text>
        </Pressable>
        <Money minor={c.amount_minor} size={16} />
      </View>

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
        <Pressable
          onPress={() => { tapSuccess(); settleCommitment(c.id); refresh(); }}
          style={({ pressed }) => ({
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            backgroundColor: t.brand,
            borderRadius: radius.md,
            paddingVertical: 9,
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <Check size={15} color={t.onBrand} />
          <Text style={{ color: t.onBrand, fontSize: 13, fontWeight: '700' }}>Paid it</Text>
        </Pressable>
        <Pressable
          onPress={() => { tap(); skipCommitment(c.id); refresh(); }}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            backgroundColor: t.sunken,
            borderRadius: radius.md,
            paddingVertical: 9,
            paddingHorizontal: 14,
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <SkipForward size={14} color={t.dim} />
          <Text style={{ color: t.dim, fontSize: 13, fontWeight: '700' }}>Skip</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 60 }}>
        <Text style={{ color: t.dim, fontSize: 13.5, lineHeight: 20 }}>
          Things you know are coming. Nothing counts as spent until you confirm it — then it becomes a normal entry and
          a repeating one rolls forward on its own.
        </Text>

        {committed > 0 && (
          <Card style={{ marginTop: space.lg, backgroundColor: t.brandSoft, borderColor: 'transparent' }}>
            <Text style={{ color: t.brand, fontSize: 10.5, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' }}>
              Committed in the next 30 days
            </Text>
            <Money minor={committed} size={28} color={t.brand} style={{ marginTop: 3 }} />
          </Card>
        )}

        <View style={{ marginTop: space.lg }}>
          <Chip label="＋ New commitment" active onPress={() => setCreating(true)} />
        </View>

        {rows.length === 0 && (
          <Card style={{ marginTop: space.lg }}>
            <EmptyState
              icon={<CalendarClock size={22} color={t.brand} />}
              title="Nothing scheduled"
              body="Add the rent, a travel pass, a yearly renewal — anything you already know is due."
            />
          </Card>
        )}

        {groups.overdue.length > 0 && (
          <>
            <SectionTitle>Overdue</SectionTitle>
            {groups.overdue.map((c) => row(c, 'overdue'))}
          </>
        )}
        {groups.dueToday.length > 0 && (
          <>
            <SectionTitle>Due today</SectionTitle>
            {groups.dueToday.map((c) => row(c, 'today'))}
          </>
        )}
        {groups.upcoming.length > 0 && (
          <>
            <SectionTitle>Next 30 days</SectionTitle>
            {groups.upcoming.map((c) => row(c))}
          </>
        )}
        {groups.later.length > 0 && (
          <>
            <SectionTitle>Later</SectionTitle>
            {groups.later.map((c) => row(c))}
          </>
        )}
      </ScrollView>

      <CommitmentEditor
        visible={!!editing || creating}
        commitment={editing}
        onClose={() => {
          setEditing(null);
          setCreating(false);
        }}
        onSaved={() => {
          setEditing(null);
          setCreating(false);
          refresh();
        }}
      />
    </Screen>
  );
}

function useCurrencyFmt() {
  const { currency } = useSettings();
  return { fmt: (m: number) => `${currency.symbol}${(m / 100).toFixed(currency.digits === 0 ? 0 : 2)}` };
}

function CommitmentEditor({
  visible,
  commitment,
  onClose,
  onSaved,
}: {
  visible: boolean;
  commitment: CommitmentView | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTheme();
  const { currency } = useSettings();
  const { categories } = useData();
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [due, setDue] = useState(todayLocal());
  const [recurrence, setRecurrence] = useState<Recurrence>('monthly');
  const [showCat, setShowCat] = useState(false);
  const [showDate, setShowDate] = useState(false);

  React.useEffect(() => {
    if (!visible) return;
    setName(commitment?.name ?? '');
    setAmount(commitment ? String(commitment.amount_minor / 100) : '');
    setCategoryId(commitment?.category_id ?? null);
    setDue(commitment?.due_date ?? addDays(todayLocal(), 1));
    setRecurrence((commitment?.recurrence as Recurrence) ?? 'monthly');
  }, [visible, commitment]);

  const category = categories.find((c) => c.id === categoryId);

  const input = {
    backgroundColor: t.sunken,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.line,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: t.ink,
    fontSize: 15,
  } as const;

  return (
    <>
      <Sheet visible={visible} onClose={onClose} title={commitment ? 'Edit commitment' : 'New commitment'}>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="What is it? e.g. Metro pass"
          placeholderTextColor={t.faint}
          style={input}
        />

        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: t.sunken, borderRadius: radius.md, paddingHorizontal: 14 }}>
          <Text style={{ color: t.dim, fontSize: 22, fontWeight: '700' }}>{currency.symbol}</Text>
          <TextInput
            value={amount}
            onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, ''))}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={t.faint}
            style={{ flex: 1, color: t.ink, fontSize: 28, fontWeight: '800', paddingVertical: 12, paddingHorizontal: 8, fontVariant: ['tabular-nums'] }}
          />
        </View>

        <Pressable
          onPress={() => { tap(); setShowCat(true); }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: t.sunken, borderRadius: radius.md, padding: 12 }}
        >
          <IconTile name={category?.icon} color={category?.color ?? t.dim} size={34} />
          <Text style={{ color: t.ink, fontSize: 15, fontWeight: '600', flex: 1 }}>
            {category?.name ?? 'Choose category'}
          </Text>
          <ChevronRight size={17} color={t.faint} />
        </Pressable>

        <Pressable
          onPress={() => { tap(); setShowDate(true); }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: t.sunken, borderRadius: radius.md, padding: 14 }}
        >
          <CalendarClock size={19} color={t.dim} />
          <Text style={{ color: t.ink, fontSize: 15, fontWeight: '600', flex: 1 }}>{dayLabel(due)}</Text>
          <ChevronRight size={17} color={t.faint} />
        </Pressable>

        <Text style={{ color: t.dim, fontSize: 12, fontWeight: '600' }}>Repeats</Text>
        <View style={{ flexDirection: 'row', gap: 7, flexWrap: 'wrap' }}>
          {RECURRENCE.map((r) => (
            <Chip key={r.value} label={r.label} small active={recurrence === r.value} onPress={() => setRecurrence(r.value)} />
          ))}
        </View>

        <Button
          title={commitment ? 'Save' : 'Add commitment'}
          onPress={() => {
            const minor = toMinor(Number(amount || '0'));
            if (!name.trim() || minor <= 0) return;
            saveCommitment({
              id: commitment?.id,
              name: name.trim(),
              amount_minor: minor,
              category_id: categoryId,
              due_date: due,
              recurrence,
            });
            tapSuccess();
            onSaved();
          }}
          disabled={!name.trim() || Number(amount) <= 0}
        />
        {commitment && (
          <Button
            title="Delete"
            variant="danger"
            icon={<Trash2 size={16} color={t.down} />}
            onPress={() => {
              deleteCommitment(commitment.id);
              tap();
              onSaved();
            }}
          />
        )}
      </Sheet>

      <CategoryPickerSheet
        visible={showCat}
        categories={categories}
        value={categoryId}
        kind="expense"
        onClose={() => setShowCat(false)}
        onPick={(id) => {
          setCategoryId(id);
          setShowCat(false);
        }}
      />
      <DatePickerSheet
        visible={showDate}
        value={due}
        title="Due on"
        allowFuture
        onClose={() => setShowDate(false)}
        onPick={(d) => {
          setDue(d);
          setShowDate(false);
        }}
      />
    </>
  );
}
