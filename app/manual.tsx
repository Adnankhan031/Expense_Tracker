import React, { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ChevronLeft, ChevronRight, Plus, Search, Trash2 } from 'lucide-react-native';
import { useFocusEffect } from 'expo-router';

import {
  TxnWithCategory,
  insertTxn,
  softDeleteTxn,
  totalsByCategory,
  txnsForDay,
  txnsInRange,
} from '../src/db';
import { parseInput, type ParsedEntry } from '../src/parser';
import { useData, useSettings } from '../src/store';
import { radius, space, useTheme } from '../src/theme';
import { Button, Card, Chip, Money, Screen, SectionTitle, Segmented, tap, tapSuccess } from '../src/ui';
import { CategoryIcon, IconTile } from '../src/icons';
import { DatePickerSheet, MonthPickerSheet } from '../src/pickers';
import { TxnEditor } from '../src/TxnEditor';
import {
  WEEKDAYS_SHORT,
  addDays,
  currentMonth,
  dayLabel,
  fromLocalDate,
  monthEnd,
  monthLabel,
  monthStart,
  shortDayLabel,
  toMinor,
  todayLocal,
} from '../src/format';

type Mode = 'day' | 'week' | 'month' | 'paste';

export default function ManualScreen() {
  const t = useTheme();
  const [mode, setMode] = useState<Mode>('day');

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <ScrollView
          contentContainerStyle={{ padding: space.lg, paddingBottom: 70 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={{ color: t.dim, fontSize: 13.5, lineHeight: 20, marginBottom: space.lg }}>
            For any day, week or month — past or present. The chat is the shortcut; this is the full control.
          </Text>

          <Segmented
            options={[
              { value: 'day', label: 'Day' },
              { value: 'week', label: 'Week' },
              { value: 'month', label: 'Month' },
              { value: 'paste', label: 'Paste' },
            ]}
            value={mode}
            onChange={setMode}
          />

          {mode === 'day' && <DayMode />}
          {mode === 'week' && <WeekMode />}
          {mode === 'month' && <MonthMode />}
          {mode === 'paste' && <PasteMode />}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

/* ------------------------------------------------------------------ */
/* quick add — the fast path for one date                              */
/* ------------------------------------------------------------------ */

function QuickAdd({ date, onAdded }: { date: string; onAdded: () => void }) {
  const t = useTheme();
  const { currency } = useSettings();
  const { categories, reload, defaultAccountId } = useData();
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [method, setMethod] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const list = useMemo(
    () =>
      categories
        .filter((c) => c.kind === type)
        .filter((c) => (search ? c.name.toLowerCase().includes(search.toLowerCase()) : true)),
    [categories, type, search]
  );

  const selected = categories.find((c) => c.id === categoryId);
  const canAdd = !!categoryId && Number(amount) > 0;

  const add = () => {
    if (!canAdd) return;
    insertTxn({
      amount_minor: toMinor(Number(amount)),
      type,
      category_id: categoryId!,
      local_date: date,
      method,
      account_id: defaultAccountId,
      note: note.trim() || null,
      source: 'manual',
      confidence: 1,
    });
    tapSuccess();
    setAmount('');
    setNote('');
    reload();
    onAdded();
  };

  return (
    <View style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(['expense', 'income'] as const).map((k) => (
          <Pressable
            key={k}
            onPress={() => {
              tap();
              setType(k);
              setCategoryId(null);
            }}
            style={{
              flex: 1,
              paddingVertical: 9,
              borderRadius: radius.sm,
              alignItems: 'center',
              backgroundColor: type === k ? (k === 'income' ? t.up : t.brand) : t.sunken,
            }}
          >
            <Text
              style={{
                color: type === k ? (k === 'income' ? '#04231C' : t.onBrand) : t.dim,
                fontSize: 13,
                fontWeight: '700',
                textTransform: 'capitalize',
              }}
            >
              {k}
            </Text>
          </Pressable>
        ))}
      </View>

      {categories.length > 12 && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            backgroundColor: t.sunken,
            borderRadius: radius.md,
            paddingHorizontal: 12,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: t.line,
          }}
        >
          <Search size={15} color={t.faint} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Find a category"
            placeholderTextColor={t.faint}
            style={{ flex: 1, color: t.ink, fontSize: 14, paddingVertical: 9 }}
          />
        </View>
      )}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {list.map((c) => {
          const on = c.id === categoryId;
          return (
            <View key={c.id} style={{ width: '25%', padding: 4 }}>
              <Pressable
                onPress={() => {
                  tap();
                  setCategoryId(on ? null : c.id);
                }}
                style={{
                  alignItems: 'center',
                  gap: 5,
                  paddingVertical: 9,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: on ? c.color : t.line,
                  backgroundColor: on ? c.color + '24' : t.sunken,
                }}
              >
                <CategoryIcon name={c.icon} size={19} color={c.color} />
                <Text
                  numberOfLines={1}
                  style={{ color: on ? t.ink : t.dim, fontSize: 9.5, fontWeight: '600', maxWidth: '92%' }}
                >
                  {c.name}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: t.sunken,
          borderRadius: radius.md,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: t.line,
          paddingHorizontal: 14,
          opacity: selected ? 1 : 0.55,
        }}
      >
        <Text style={{ color: t.dim, fontSize: 20, fontWeight: '700' }}>{currency.symbol}</Text>
        <TextInput
          value={amount}
          editable={!!selected}
          onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, ''))}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={t.faint}
          style={{
            flex: 1,
            color: t.ink,
            fontSize: 26,
            fontWeight: '800',
            paddingVertical: 10,
            paddingHorizontal: 8,
            fontVariant: ['tabular-nums'],
          }}
        />
      </View>

      <TextInput
        value={note}
        editable={!!selected}
        onChangeText={setNote}
        placeholder="Note (optional)"
        placeholderTextColor={t.faint}
        style={{
          backgroundColor: t.sunken,
          borderRadius: radius.md,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: t.line,
          paddingHorizontal: 14,
          paddingVertical: 11,
          color: t.ink,
          fontSize: 14,
        }}
      />

      <View style={{ flexDirection: 'row', gap: 7, flexWrap: 'wrap' }}>
        {['Cash', 'Card', 'UPI', 'Bank', 'Wallet'].map((m) => (
          <Chip key={m} label={m} small active={method === m} onPress={() => setMethod(method === m ? null : m)} />
        ))}
      </View>

      <Button title="Add entry" onPress={add} disabled={!canAdd} icon={<Plus size={16} color={t.onBrand} />} />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* day                                                                 */
/* ------------------------------------------------------------------ */

function DayMode() {
  const t = useTheme();
  const { reload, version } = useData();
  const [date, setDate] = useState(todayLocal());
  const [showDate, setShowDate] = useState(false);
  const [rows, setRows] = useState<TxnWithCategory[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const load = React.useCallback(() => setRows(txnsForDay(date)), [date]);
  React.useEffect(() => {
    load();
  }, [load, version, tick]);
  useFocusEffect(React.useCallback(() => load(), [load]));

  const spent = rows.filter((r) => r.type === 'expense').reduce((a, b) => a + b.amount_minor, 0);
  const earned = rows.filter((r) => r.type === 'income').reduce((a, b) => a + b.amount_minor, 0);
  const today = todayLocal();

  return (
    <View>
      <Card style={{ marginTop: space.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <NavBtn dir="prev" onPress={() => setDate(addDays(date, -1))} />
          <Pressable onPress={() => { tap(); setShowDate(true); }} style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ color: t.ink, fontSize: 17, fontWeight: '800', letterSpacing: -0.4 }}>{dayLabel(date)}</Text>
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 2 }}>
              <Money minor={spent} size={12} weight="600" color={t.dim} />
              {earned > 0 && <Money minor={earned} size={12} weight="600" color={t.up} prefix="+" />}
            </View>
          </Pressable>
          <NavBtn dir="next" onPress={() => date < today && setDate(addDays(date, 1))} disabled={date >= today} />
        </View>
      </Card>

      <SectionTitle>Add to {shortDayLabel(date)}</SectionTitle>
      <Card>
        <QuickAdd date={date} onAdded={() => setTick((n) => n + 1)} />
      </Card>

      {rows.length > 0 && (
        <>
          <SectionTitle right={<Money minor={spent} size={12} weight="700" color={t.dim} />}>
            {rows.length} on this day
          </SectionTitle>
          <Card padded={false}>
            {rows.map((x, i) => (
              <Pressable
                key={x.id}
                onPress={() => { tap(); setEditingId(x.id); }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space.md,
                  paddingHorizontal: space.lg,
                  paddingVertical: 12,
                  borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth,
                  borderTopColor: t.line,
                }}
              >
                <IconTile name={x.cat_icon} color={x.cat_color} size={34} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.ink, fontSize: 14.5, fontWeight: '600' }} numberOfLines={1}>
                    {x.note || x.cat_name}
                  </Text>
                  <Text style={{ color: t.faint, fontSize: 11.5, marginTop: 1 }}>
                    {x.cat_name}
                    {x.method ? ` · ${x.method}` : ''}
                  </Text>
                </View>
                <Money
                  minor={x.amount_minor}
                  size={15}
                  color={x.type === 'income' ? t.up : t.ink}
                  prefix={x.type === 'income' ? '+' : ''}
                />
                <Pressable
                  hitSlop={10}
                  onPress={() => {
                    softDeleteTxn(x.id);
                    tap();
                    reload();
                    setTick((n) => n + 1);
                  }}
                >
                  <Trash2 size={15} color={t.faint} />
                </Pressable>
              </Pressable>
            ))}
          </Card>
        </>
      )}

      <DatePickerSheet
        visible={showDate}
        value={date}
        onClose={() => setShowDate(false)}
        onPick={(d) => {
          setDate(d);
          setShowDate(false);
        }}
      />
      <TxnEditor
        visible={!!editingId}
        txnId={editingId}
        onClose={() => setEditingId(null)}
        onSaved={() => setTick((n) => n + 1)}
      />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* week                                                                */
/* ------------------------------------------------------------------ */

function WeekMode() {
  const t = useTheme();
  const { version } = useData();
  const today = todayLocal();
  const [anchor, setAnchor] = useState(today);
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const weekStart = useMemo(() => addDays(anchor, -fromLocalDate(anchor).getDay()), [anchor]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const weekEnd = days[6];

  const totals = useMemo(() => {
    const map = new Map<string, number>();
    for (const x of txnsInRange(weekStart, weekEnd)) {
      if (x.type !== 'expense') continue;
      map.set(x.local_date, (map.get(x.local_date) ?? 0) + x.amount_minor);
    }
    return map;
  }, [weekStart, weekEnd, version, tick]);

  const weekTotal = [...totals.values()].reduce((a, b) => a + b, 0);
  const max = Math.max(1, ...totals.values());

  return (
    <View>
      <Card style={{ marginTop: space.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <NavBtn dir="prev" onPress={() => setAnchor(addDays(anchor, -7))} />
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ color: t.ink, fontSize: 15, fontWeight: '800' }}>
              {shortDayLabel(weekStart)} – {shortDayLabel(weekEnd)}
            </Text>
            <Money minor={weekTotal} size={12} weight="600" color={t.dim} style={{ marginTop: 2 }} />
          </View>
          <NavBtn dir="next" onPress={() => weekEnd < today && setAnchor(addDays(anchor, 7))} disabled={weekEnd >= today} />
        </View>
      </Card>

      <SectionTitle>Tap a day to add</SectionTitle>
      <Card padded={false}>
        {days.map((d, i) => {
          const total = totals.get(d) ?? 0;
          const future = d > today;
          return (
            <Pressable
              key={d}
              disabled={future}
              onPress={() => { tap(); setOpenDay(openDay === d ? null : d); }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: space.md,
                paddingHorizontal: space.lg,
                paddingVertical: 12,
                borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth,
                borderTopColor: t.line,
                opacity: future ? 0.35 : 1,
                backgroundColor: openDay === d ? t.sunken : 'transparent',
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: radius.md,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: d === today ? t.brand : t.sunken,
                }}
              >
                <Text style={{ color: d === today ? t.onBrand : t.dim, fontSize: 11, fontWeight: '700' }}>
                  {WEEKDAYS_SHORT[fromLocalDate(d).getDay()][0]}
                  {fromLocalDate(d).getDate()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.ink, fontSize: 14, fontWeight: '600' }}>{dayLabel(d)}</Text>
                <View style={{ height: 6, borderRadius: 3, backgroundColor: t.sunken, marginTop: 5, overflow: 'hidden' }}>
                  <View
                    style={{
                      width: `${total ? Math.max(4, (total / max) * 100) : 0}%`,
                      height: '100%',
                      backgroundColor: t.brand,
                      borderRadius: 3,
                    }}
                  />
                </View>
              </View>
              {total ? (
                <Money minor={total} size={14} />
              ) : (
                <Text style={{ color: t.faint, fontSize: 14 }}>—</Text>
              )}
            </Pressable>
          );
        })}
      </Card>

      {openDay && (
        <>
          <SectionTitle>Add to {dayLabel(openDay)}</SectionTitle>
          <Card>
            <QuickAdd date={openDay} onAdded={() => setTick((n) => n + 1)} />
          </Card>
        </>
      )}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* month — one lump sum per category                                   */
/* ------------------------------------------------------------------ */

function MonthMode() {
  const t = useTheme();
  const { currency } = useSettings();
  const { categories, reload, version } = useData();
  const [ym, setYm] = useState(currentMonth());
  const [showMonth, setShowMonth] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(0);

  const targetDate = useMemo(() => {
    const end = monthEnd(ym);
    return end > todayLocal() ? todayLocal() : end;
  }, [ym]);

  const existing = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of totalsByCategory(monthStart(ym), monthEnd(ym), 'expense')) map.set(c.category_id, c.total);
    return map;
  }, [ym, version, saved]);

  const pending = Object.values(values).reduce((a, v) => a + (Number(v) || 0), 0);

  const save = () => {
    const entries = Object.entries(values).filter(([, v]) => Number(v) > 0);
    if (!entries.length) return;
    for (const [catId, v] of entries) {
      const cat = categories.find((c) => c.id === catId);
      insertTxn({
        amount_minor: toMinor(Number(v)),
        type: cat?.kind === 'income' ? 'income' : 'expense',
        category_id: catId,
        local_date: targetDate,
        note: `${monthLabel(ym, true)} total`,
        source: 'backfill',
        confidence: 1,
      });
    }
    tapSuccess();
    setValues({});
    setSaved((s) => s + 1);
    reload();
    Alert.alert('Saved', `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'} added to ${monthLabel(ym)}.`);
  };

  const row = (c: (typeof categories)[number]) => (
    <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 }}>
      <IconTile name={c.icon} color={c.color} size={34} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.ink, fontSize: 14.5, fontWeight: '600' }}>{c.name}</Text>
        {existing.has(c.id) && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 }}>
            <Text style={{ color: t.faint, fontSize: 11 }}>already recorded:</Text>
            <Money minor={existing.get(c.id) ?? 0} size={11} weight="600" color={t.faint} />
          </View>
        )}
      </View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: t.sunken,
          borderRadius: radius.sm,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: t.line,
          paddingHorizontal: 10,
          minWidth: 112,
        }}
      >
        <Text style={{ color: t.faint, fontSize: 13 }}>{currency.symbol}</Text>
        <TextInput
          value={values[c.id] ?? ''}
          onChangeText={(v) => setValues((s) => ({ ...s, [c.id]: v.replace(/[^0-9.]/g, '') }))}
          keyboardType="decimal-pad"
          placeholder="0"
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
    </View>
  );

  return (
    <View>
      <Card style={{ marginTop: space.lg }} onPress={() => setShowMonth(true)}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.faint, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' }}>
              Filling in
            </Text>
            <Text style={{ color: t.ink, fontSize: 17, fontWeight: '800', marginTop: 2 }}>{monthLabel(ym)}</Text>
          </View>
          <ChevronRight size={17} color={t.faint} />
        </View>
      </Card>

      <Text style={{ color: t.dim, fontSize: 12.5, lineHeight: 18, marginTop: space.lg }}>
        Know roughly what a whole month cost per category? Put the totals in — each becomes one entry dated{' '}
        {dayLabel(targetDate)}. Good for months that predate the app.
      </Text>

      <SectionTitle>Expenses</SectionTitle>
      <Card>{categories.filter((c) => c.kind === 'expense').map(row)}</Card>

      <SectionTitle>Income</SectionTitle>
      <Card>{categories.filter((c) => c.kind === 'income').map(row)}</Card>

      <View style={{ marginTop: space.lg, gap: space.md }}>
        {pending > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ color: t.dim, fontSize: 13, flex: 1 }}>About to add</Text>
            <Money minor={toMinor(pending)} size={17} />
          </View>
        )}
        <Button title={`Save ${monthLabel(ym, true)}`} onPress={save} disabled={pending <= 0} />
      </View>

      <MonthPickerSheet
        visible={showMonth}
        value={ym}
        onClose={() => setShowMonth(false)}
        onPick={(m) => {
          setYm(m);
          setShowMonth(false);
        }}
      />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* paste                                                               */
/* ------------------------------------------------------------------ */

function PasteMode() {
  const t = useTheme();
  const { categories, aliases, reload } = useData();
  const [date, setDate] = useState(todayLocal());
  const [showDate, setShowDate] = useState(false);
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<ParsedEntry[]>([]);

  const parse = () => {
    const out: ParsedEntry[] = [];
    for (const line of text.split('\n').map((l) => l.trim()).filter(Boolean)) {
      const res = parseInput(line, { categories, aliases, defaultDate: date, today: todayLocal() });
      if (res.kind === 'entries') out.push(...res.entries);
    }
    setPreview(out);
    tap();
  };

  const commit = () => {
    for (const e of preview) {
      insertTxn({
        amount_minor: e.amountMinor,
        type: e.type,
        category_id: e.categoryId,
        local_date: e.date,
        method: e.method,
        note: e.note,
        raw_input: e.raw,
        source: 'backfill',
        confidence: e.confidence,
      });
    }
    tapSuccess();
    reload();
    const n = preview.length;
    setPreview([]);
    setText('');
    Alert.alert('Added', `${n} ${n === 1 ? 'entry' : 'entries'} saved.`);
  };

  const total = preview.filter((p) => p.type === 'expense').reduce((a, b) => a + b.amountMinor, 0);

  return (
    <View>
      <Card style={{ marginTop: space.lg }} onPress={() => setShowDate(true)}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.faint, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' }}>
              Lines without a date land on
            </Text>
            <Text style={{ color: t.ink, fontSize: 17, fontWeight: '800', marginTop: 2 }}>{dayLabel(date)}</Text>
          </View>
          <ChevronRight size={17} color={t.faint} />
        </View>
      </Card>

      <Text style={{ color: t.dim, fontSize: 12.5, lineHeight: 18, marginTop: space.lg }}>
        One entry per line, written the way you would in chat. Add a day where you remember it.
      </Text>

      <TextInput
        value={text}
        onChangeText={setText}
        multiline
        placeholder={'rent 12000 on 1\ngroceries 6400\npetrol 3200 on 12\nlunch 480 on 14\nsalary 45000 received on 1'}
        placeholderTextColor={t.faint}
        style={{
          backgroundColor: t.sunken,
          borderRadius: radius.md,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: t.line,
          color: t.ink,
          fontSize: 14.5,
          lineHeight: 21,
          padding: 14,
          minHeight: 170,
          textAlignVertical: 'top',
          marginTop: space.md,
        }}
      />

      <Button title="Preview" onPress={parse} variant="outline" style={{ marginTop: space.md }} disabled={!text.trim()} />

      {preview.length > 0 && (
        <>
          <SectionTitle right={<Money minor={total} size={13} weight="700" color={t.dim} />}>
            {preview.length} entries ready
          </SectionTitle>
          <Card padded={false}>
            {preview.map((p, i) => {
              const cat = categories.find((c) => c.id === p.categoryId);
              return (
                <View
                  key={i}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    paddingHorizontal: space.lg,
                    paddingVertical: 10,
                    borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth,
                    borderTopColor: t.line,
                  }}
                >
                  <IconTile name={cat?.icon} color={cat?.color ?? t.dim} size={30} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: t.ink, fontSize: 13.5, fontWeight: '600' }}>{p.categoryName}</Text>
                    <Text style={{ color: t.faint, fontSize: 11, marginTop: 1 }} numberOfLines={1}>
                      {dayLabel(p.date)}
                      {p.note ? ` · ${p.note}` : ''}
                      {p.confidence < 0.6 ? ' · low confidence' : ''}
                    </Text>
                  </View>
                  <Money
                    minor={p.amountMinor}
                    size={14}
                    color={p.type === 'income' ? t.up : t.ink}
                    prefix={p.type === 'income' ? '+' : ''}
                  />
                </View>
              );
            })}
          </Card>
          <Button title={`Add all ${preview.length}`} onPress={commit} style={{ marginTop: space.md }} />
          <Text style={{ color: t.faint, fontSize: 11.5, textAlign: 'center', marginTop: 8 }}>
            Anything mis-categorised can be fixed by tapping it in History.
          </Text>
        </>
      )}

      <DatePickerSheet
        visible={showDate}
        value={date}
        onClose={() => setShowDate(false)}
        onPick={(d) => {
          setDate(d);
          setShowDate(false);
        }}
      />
    </View>
  );
}

/* ------------------------------------------------------------------ */

function NavBtn({ dir, onPress, disabled }: { dir: 'prev' | 'next'; onPress: () => void; disabled?: boolean }) {
  const t = useTheme();
  const Icon = dir === 'prev' ? ChevronLeft : ChevronRight;
  return (
    <Pressable
      onPress={() => {
        if (disabled) return;
        tap();
        onPress();
      }}
      style={{
        width: 36,
        height: 36,
        borderRadius: radius.sm,
        backgroundColor: t.sunken,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.3 : 1,
      }}
    >
      <Icon size={18} color={t.dim} />
    </Pressable>
  );
}
