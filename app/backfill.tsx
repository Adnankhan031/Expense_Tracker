import React, { useCallback, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';

import { insertTxn, totalsByCategory } from '../src/db';
import { parseInput, type ParsedEntry } from '../src/parser';
import { useData, useSettings } from '../src/store';
import { radius, space, useTheme } from '../src/theme';
import { Button, Card, Chip, IconBadge, Money, Screen, SectionTitle, Segmented, tap, tapSuccess } from '../src/ui';
import { DatePickerSheet, MonthPickerSheet } from '../src/pickers';
import {
  currentMonth,
  dayLabel,
  monthEnd,
  monthLabel,
  monthStart,
  shiftMonth,
  todayLocal,
  toMinor,
} from '../src/format';

type Mode = 'totals' | 'paste' | 'daily';

export default function BackfillScreen() {
  const t = useTheme();
  const { currency } = useSettings();
  const { categories, aliases, reload, setPinnedDate } = useData();
  const [mode, setMode] = useState<Mode>('totals');
  // default to last month — that is what people are usually catching up on
  const [ym, setYm] = useState(() => shiftMonth(currentMonth(), -1));
  const [showMonth, setShowMonth] = useState(false);

  const targetDate = useMemo(() => {
    const end = monthEnd(ym);
    const today = todayLocal();
    return end > today ? today : end;
  }, [ym]);

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          <Text style={{ color: t.textDim, fontSize: 13.5, lineHeight: 20, marginBottom: space.lg }}>
            Already spent months before installing this? Fill them in here. Anything you add shows up in the dashboard and
            analytics exactly like a normal entry.
          </Text>

          <Pressable
            onPress={() => { tap(); setShowMonth(true); }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              backgroundColor: t.card,
              borderRadius: radius.md,
              padding: 14,
              marginBottom: space.lg,
            }}
          >
            <Ionicons name="calendar" size={19} color={t.accent} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.textFaint, fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' }}>
                Filling in
              </Text>
              <Text style={{ color: t.text, fontSize: 17, fontWeight: '700', marginTop: 1 }}>{monthLabel(ym)}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={t.textFaint} />
          </Pressable>

          <Segmented
            options={[
              { value: 'totals', label: 'Monthly totals' },
              { value: 'paste', label: 'Paste a list' },
              { value: 'daily', label: 'Day by day' },
            ]}
            value={mode}
            onChange={setMode}
          />

          {mode === 'totals' && <TotalsMode ym={ym} targetDate={targetDate} />}
          {mode === 'paste' && <PasteMode ym={ym} targetDate={targetDate} />}
          {mode === 'daily' && <DailyMode ym={ym} />}
        </ScrollView>
      </KeyboardAvoidingView>

      <MonthPickerSheet visible={showMonth} value={ym} onClose={() => setShowMonth(false)} onPick={(m) => { setYm(m); setShowMonth(false); }} />
    </Screen>
  );
}

/* ------------------------------------------------------------------ */
/* mode 1 — one lump sum per category                                  */
/* ------------------------------------------------------------------ */

function TotalsMode({ ym, targetDate }: { ym: string; targetDate: string }) {
  const t = useTheme();
  const { currency } = useSettings();
  const { categories, reload, version } = useData();
  const [values, setValues] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(0);

  const existing = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of totalsByCategory(monthStart(ym), monthEnd(ym), 'expense')) map.set(c.category_id, c.total);
    return map;
  }, [ym, version, saved]);

  const expenseCats = categories.filter((c) => c.kind === 'expense');
  const incomeCats = categories.filter((c) => c.kind === 'income');

  const pendingTotal = Object.values(values).reduce((a, v) => a + (Number(v) || 0), 0);

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

  const renderRow = (c: (typeof categories)[number]) => (
    <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 }}>
      <IconBadge icon={c.icon} color={c.color} size={34} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.text, fontSize: 14.5, fontWeight: '600' }}>{c.name}</Text>
        {existing.has(c.id) && (
          <Text style={{ color: t.textFaint, fontSize: 11, marginTop: 1 }}>
            already recorded: {currency}
            {((existing.get(c.id) ?? 0) / 100).toLocaleString()}
          </Text>
        )}
      </View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: t.cardAlt,
          borderRadius: radius.sm,
          paddingHorizontal: 10,
          minWidth: 108,
        }}
      >
        <Text style={{ color: t.textFaint, fontSize: 14 }}>{currency}</Text>
        <TextInput
          value={values[c.id] ?? ''}
          onChangeText={(v) => setValues((s) => ({ ...s, [c.id]: v.replace(/[^0-9.]/g, '') }))}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={t.textFaint}
          style={{ flex: 1, color: t.text, fontSize: 15, fontWeight: '700', paddingVertical: 9, paddingLeft: 5, textAlign: 'right', fontVariant: ['tabular-nums'] }}
        />
      </View>
    </View>
  );

  return (
    <View>
      <Text style={{ color: t.textDim, fontSize: 12.5, lineHeight: 18, marginTop: space.lg }}>
        Remember roughly what you spent per category? Put the whole month's total against each one. Each becomes a single
        entry dated {dayLabel(targetDate)}.
      </Text>

      <SectionTitle>Expenses</SectionTitle>
      <Card>{expenseCats.map(renderRow)}</Card>

      <SectionTitle>Income</SectionTitle>
      <Card>{incomeCats.map(renderRow)}</Card>

      <View style={{ marginTop: space.lg, gap: space.md }}>
        {pendingTotal > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ color: t.textDim, fontSize: 13, flex: 1 }}>About to add</Text>
            <Money minor={toMinor(pendingTotal)} size={17} />
          </View>
        )}
        <Button title={`Save ${monthLabel(ym, true)}`} onPress={save} disabled={pendingTotal <= 0} />
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* mode 2 — paste many lines at once                                   */
/* ------------------------------------------------------------------ */

function PasteMode({ ym, targetDate }: { ym: string; targetDate: string }) {
  const t = useTheme();
  const { categories, aliases, reload } = useData();
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<ParsedEntry[]>([]);

  const parse = useCallback(() => {
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const out: ParsedEntry[] = [];
    for (const line of lines) {
      const res = parseInput(line, { categories, aliases, defaultDate: targetDate, today: todayLocal() });
      if (res.kind === 'entries') out.push(...res.entries);
    }
    setPreview(out);
    tap();
  }, [text, categories, aliases, targetDate]);

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
    Alert.alert('Added', `${n} ${n === 1 ? 'entry' : 'entries'} saved to ${monthLabel(ym)}.`);
  };

  const total = preview.filter((p) => p.type === 'expense').reduce((a, b) => a + b.amountMinor, 0);

  return (
    <View>
      <Text style={{ color: t.textDim, fontSize: 12.5, lineHeight: 18, marginTop: space.lg }}>
        One entry per line, written the same way you would in chat. Add a day if you remember it — otherwise everything
        lands on {dayLabel(targetDate)}.
      </Text>

      <TextInput
        value={text}
        onChangeText={setText}
        multiline
        placeholder={'rent 12000 on 1\ngroceries 6400\npetrol 3200 on 12\nswiggy 480 on 14\nsalary 45000 received on 1'}
        placeholderTextColor={t.textFaint}
        style={{
          backgroundColor: t.card,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: t.line,
          color: t.text,
          fontSize: 14.5,
          lineHeight: 21,
          padding: 14,
          minHeight: 170,
          textAlignVertical: 'top',
          marginTop: space.md,
        }}
      />

      <Button title="Preview" onPress={parse} variant="ghost" style={{ marginTop: space.md }} />

      {preview.length > 0 && (
        <>
          <SectionTitle right={<Money minor={total} size={13} weight="700" color={t.textDim} />}>
            {preview.length} entries ready
          </SectionTitle>
          <Card>
            {preview.map((p, i) => {
              const cat = categories.find((c) => c.id === p.categoryId);
              return (
                <View
                  key={i}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    paddingVertical: 9,
                    borderTopWidth: i === 0 ? 0 : 1,
                    borderTopColor: t.line,
                  }}
                >
                  <IconBadge icon={cat?.icon ?? '📦'} color={cat?.color ?? t.textDim} size={30} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: t.text, fontSize: 13.5, fontWeight: '600' }}>{p.categoryName}</Text>
                    <Text style={{ color: t.textFaint, fontSize: 11, marginTop: 1 }}>
                      {dayLabel(p.date)}
                      {p.note ? ` · ${p.note}` : ''}
                      {p.confidence < 0.6 ? ' · low confidence' : ''}
                    </Text>
                  </View>
                  <Money
                    minor={p.amountMinor}
                    size={14}
                    color={p.type === 'income' ? t.income : t.text}
                    prefix={p.type === 'income' ? '+' : ''}
                  />
                </View>
              );
            })}
          </Card>
          <Button title={`Add all ${preview.length}`} onPress={commit} style={{ marginTop: space.md }} />
          <Text style={{ color: t.textFaint, fontSize: 11.5, textAlign: 'center', marginTop: 8 }}>
            Anything mis-categorised can be fixed by tapping it in History.
          </Text>
        </>
      )}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* mode 3 — pin the chat to an older day                               */
/* ------------------------------------------------------------------ */

function DailyMode({ ym }: { ym: string }) {
  const t = useTheme();
  const { setPinnedDate } = useData();
  const [date, setDate] = useState(monthStart(ym));
  const [showDate, setShowDate] = useState(false);

  React.useEffect(() => {
    setDate(monthStart(ym));
  }, [ym]);

  return (
    <View>
      <Text style={{ color: t.textDim, fontSize: 12.5, lineHeight: 18, marginTop: space.lg }}>
        Pin the chat to an older day and type normally. Everything you send goes to that day until you reset it.
      </Text>

      <Pressable
        onPress={() => { tap(); setShowDate(true); }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: t.card, borderRadius: radius.md, padding: 14, marginTop: space.md }}
      >
        <Ionicons name="calendar-outline" size={19} color={t.textDim} />
        <Text style={{ color: t.text, fontSize: 15, fontWeight: '600', flex: 1 }}>{dayLabel(date)}</Text>
        <Ionicons name="chevron-forward" size={18} color={t.textFaint} />
      </Pressable>

      <Button
        title="Pin chat to this day"
        onPress={() => {
          setPinnedDate(date);
          tapSuccess();
          router.back();
          router.push('/');
        }}
        style={{ marginTop: space.md }}
      />

      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: space.md }}>
        <Chip label="1st" onPress={() => setDate(monthStart(ym))} />
        <Chip label="15th" onPress={() => setDate(`${ym}-15`)} />
        <Chip label="Last day" onPress={() => setDate(monthEnd(ym))} />
      </View>

      <DatePickerSheet visible={showDate} value={date} onClose={() => setShowDate(false)} onPick={(d) => { setDate(d); setShowDate(false); }} />
    </View>
  );
}
