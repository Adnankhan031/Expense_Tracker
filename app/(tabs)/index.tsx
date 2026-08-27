import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';

import {
  ChatMessage,
  TxnWithCategory,
  addMessage,
  clearMessages,
  deleteMessage,
  insertTxn,
  learnAlias,
  listMessages,
  softDeleteTxn,
  sumInRange,
  searchTxns,
} from '../../src/db';
import { parseInput } from '../../src/parser';
import { runQuery, type Answer } from '../../src/analytics';
import { useData, useSettings } from '../../src/store';
import { radius, space, useTheme } from '../../src/theme';
import { Chip, EmptyState, Money, Screen, tap, tapSuccess } from '../../src/ui';
import { DatePickerSheet } from '../../src/pickers';
import { TxnEditor } from '../../src/TxnEditor';
import { dayLabel, formatMoney, shortDayLabel, todayLocal } from '../../src/format';

const HINTS = ['food 300', 'groceries 2400 and auto 80', 'petrol 1500 on 5th', 'salary 45000 received'];

export default function ChatScreen() {
  const t = useTheme();
  const { currency, numberStyle } = useSettings();
  const { categories, aliases, pinnedDate, setPinnedDate, reload, version, defaultAccountId } = useData();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [txnMap, setTxnMap] = useState<Map<string, TxnWithCategory>>(new Map());
  const [input, setInput] = useState('');
  const [showDate, setShowDate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [todayTotal, setTodayTotal] = useState(0);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const fmt = useCallback(
    (m: number) => formatMoney(m, { symbol: currency, style: numberStyle }),
    [currency, numberStyle]
  );

  const refresh = useCallback(() => {
    const msgs = listMessages(200);
    setMessages(msgs);
    const ids = new Set(msgs.map((m) => m.txn_id).filter(Boolean) as string[]);
    if (ids.size) {
      const map = new Map<string, TxnWithCategory>();
      for (const r of searchTxns({ limit: 2000 })) if (ids.has(r.id)) map.set(r.id, r);
      setTxnMap(map);
    } else {
      setTxnMap(new Map());
    }
    const today = todayLocal();
    setTodayTotal(sumInRange(today, today, 'expense'));
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh, version])
  );

  useEffect(() => {
    const id = setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 120);
    return () => clearTimeout(id);
  }, [messages.length]);

  const send = () => {
    const text = input.trim();
    if (!text) return;
    setInput('');
    addMessage({ role: 'user', kind: 'text', text, txn_id: null, payload: null });

    const result = parseInput(text, {
      categories,
      aliases,
      defaultDate: pinnedDate,
      today: todayLocal(),
    });

    if (result.kind === 'entries') {
      for (const e of result.entries) {
        const id = insertTxn({
          amount_minor: e.amountMinor,
          type: e.type,
          category_id: e.categoryId,
          local_date: e.date,
          method: e.method,
          account_id: defaultAccountId,
          note: e.note,
          raw_input: e.raw,
          source: 'chat',
          confidence: e.confidence,
        });
        if (e.learnToken && e.confidence >= 0.9) learnAlias(e.learnToken, e.categoryId);
        addMessage({ role: 'app', kind: 'txn', text: '', txn_id: id, payload: null });
      }
      tapSuccess();
    } else if (result.kind === 'query') {
      const answer = runQuery(result.query, fmt);
      addMessage({ role: 'app', kind: 'answer', text: answer.headline, txn_id: null, payload: JSON.stringify(answer) });
      tap();
    } else {
      addMessage({
        role: 'app',
        kind: 'note',
        text: "I couldn't find an amount in that. Try something like \"food 300\".",
        txn_id: null,
        payload: null,
      });
    }

    reload();
    refresh();
  };

  const removeTxn = (msg: ChatMessage) => {
    if (msg.txn_id) softDeleteTxn(msg.txn_id);
    deleteMessage(msg.id);
    tap();
    reload();
    refresh();
  };

  const pinnedIsToday = pinnedDate === todayLocal();

  const renderItem = ({ item }: { item: ChatMessage }) => {
    if (item.role === 'user') {
      return (
        <View style={{ alignSelf: 'flex-end', maxWidth: '84%', marginBottom: 8 }}>
          <View style={{ backgroundColor: t.accent, borderRadius: 18, borderBottomRightRadius: 5, paddingHorizontal: 14, paddingVertical: 9 }}>
            <Text style={{ color: t.onAccent, fontSize: 15, fontWeight: '600' }}>{item.text}</Text>
          </View>
        </View>
      );
    }

    if (item.kind === 'txn') {
      const tx = item.txn_id ? txnMap.get(item.txn_id) : undefined;
      if (!tx) return null;
      const low = tx.confidence < 0.6;
      return (
        <Pressable
          onPress={() => { tap(); setEditingId(tx.id); }}
          style={({ pressed }) => ({
            alignSelf: 'flex-start',
            width: '90%',
            marginBottom: 8,
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <View
            style={{
              backgroundColor: t.card,
              borderRadius: 16,
              borderBottomLeftRadius: 5,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: t.line,
              borderLeftWidth: 3,
              borderLeftColor: tx.cat_color ?? t.accent,
              padding: 12,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 17 }}>{tx.cat_icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.text, fontSize: 14.5, fontWeight: '700' }}>{tx.cat_name}</Text>
                {!!tx.note && <Text style={{ color: t.textDim, fontSize: 12, marginTop: 1 }} numberOfLines={1}>{tx.note}</Text>}
              </View>
              <Money
                minor={tx.amount_minor}
                size={17}
                color={tx.type === 'income' ? t.income : t.text}
                prefix={tx.type === 'income' ? '+' : ''}
              />
              <Pressable onPress={() => removeTxn(item)} hitSlop={10} style={{ paddingLeft: 4 }}>
                <Ionicons name="close" size={16} color={t.textFaint} />
              </Pressable>
            </View>
            <View style={{ flexDirection: 'row', gap: 5, marginTop: 9, flexWrap: 'wrap' }}>
              <MiniChip label={shortDayLabel(tx.local_date)} active />
              {!!tx.method && <MiniChip label={tx.method} />}
              {low && <MiniChip label="tap to fix" warn />}
            </View>
          </View>
        </Pressable>
      );
    }

    if (item.kind === 'answer') {
      let a: Answer | null = null;
      try {
        a = item.payload ? (JSON.parse(item.payload) as Answer) : null;
      } catch {
        a = null;
      }
      if (!a) return null;
      const max = Math.max(1, ...a.bars.map((b) => b.value));
      return (
        <View
          style={{
            alignSelf: 'flex-start',
            width: '92%',
            marginBottom: 8,
            backgroundColor: t.card,
            borderRadius: 16,
            borderBottomLeftRadius: 5,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: t.line,
            padding: 14,
          }}
        >
          <Text style={{ color: t.textDim, fontSize: 11.5, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' }}>
            {a.headline}
          </Text>
          <Text style={{ color: t.text, fontSize: 30, fontWeight: '800', letterSpacing: -1, marginTop: 4, fontVariant: ['tabular-nums'] }}>
            {a.value}
          </Text>
          <Text style={{ color: t.textDim, fontSize: 13, marginTop: 3, lineHeight: 18 }}>{a.detail}</Text>
          {a.bars.length > 1 && (
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 38, marginTop: 12 }}>
              {a.bars.map((b, i) => (
                <View
                  key={i}
                  style={{
                    flex: 1,
                    height: Math.max(2, (b.value / max) * 38),
                    backgroundColor: t.accent,
                    opacity: b.value === 0 ? 0.15 : b.highlight ? 1 : 0.5,
                    borderRadius: 2,
                  }}
                />
              ))}
            </View>
          )}
          {a.breakdown.length > 0 && (
            <View style={{ gap: 7, marginTop: 12 }}>
              {a.breakdown.map((b, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: b.color }} />
                  <Text style={{ color: t.textDim, fontSize: 12.5, flex: 1 }}>{b.name}</Text>
                  <Money minor={b.total} size={12.5} weight="600" color={t.textDim} compact />
                </View>
              ))}
            </View>
          )}
        </View>
      );
    }

    return (
      <View style={{ alignSelf: 'flex-start', maxWidth: '88%', marginBottom: 8 }}>
        <View style={{ backgroundColor: t.cardAlt, borderRadius: 16, borderBottomLeftRadius: 5, paddingHorizontal: 14, paddingVertical: 10 }}>
          <Text style={{ color: t.textDim, fontSize: 13.5, lineHeight: 19 }}>{item.text}</Text>
        </View>
      </View>
    );
  };

  const MiniChip = ({ label, active, warn }: { label: string; active?: boolean; warn?: boolean }) => (
    <View
      style={{
        backgroundColor: warn ? t.dangerSoft : active ? t.accentSoft : t.cardAlt,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: radius.pill,
      }}
    >
      <Text style={{ color: warn ? t.danger : active ? t.accent : t.textDim, fontSize: 10.5, fontWeight: '700' }}>
        {label}
      </Text>
    </View>
  );

  const header = useMemo(
    () => (
      <View style={{ paddingHorizontal: space.lg, paddingTop: 6, paddingBottom: 10, gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.textDim, fontSize: 12, fontWeight: '600' }}>Spent today</Text>
            <Money minor={todayTotal} size={26} />
          </View>
          <Pressable
            onPress={() => { tap(); setCreating(true); }}
            style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: t.cardAlt, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="add" size={22} color={t.text} />
          </Pressable>
          <Pressable
            onPress={() => {
              tap();
              clearMessages();
              refresh();
            }}
            style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: t.cardAlt, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="trash-outline" size={18} color={t.textDim} />
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Pressable
            onPress={() => { tap(); setShowDate(true); }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              backgroundColor: pinnedIsToday ? t.cardAlt : t.accentSoft,
              paddingHorizontal: 11,
              paddingVertical: 6,
              borderRadius: radius.pill,
            }}
          >
            <Ionicons name="calendar-outline" size={13} color={pinnedIsToday ? t.textDim : t.accent} />
            <Text style={{ color: pinnedIsToday ? t.textDim : t.accent, fontSize: 12.5, fontWeight: '700' }}>
              Adding to · {dayLabel(pinnedDate)}
            </Text>
          </Pressable>
          {!pinnedIsToday && <Chip label="Reset" small onPress={() => setPinnedDate(todayLocal())} />}
        </View>
      </View>
    ),
    [t, todayTotal, pinnedDate, pinnedIsToday, refresh, setPinnedDate]
  );

  return (
    <Screen>
      {header}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: space.lg, paddingBottom: 12, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <View style={{ flex: 1, justifyContent: 'center' }}>
              <EmptyState
                icon="💬"
                title="Type what you spent"
                body="No forms. Write it the way you'd say it — the amount, what it was for, and a date if it wasn't today."
              />
              <View style={{ gap: 8, alignItems: 'center' }}>
                {HINTS.map((h) => (
                  <Pressable
                    key={h}
                    onPress={() => { tap(); setInput(h); }}
                    style={{ backgroundColor: t.cardAlt, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill }}
                  >
                    <Text style={{ color: t.textDim, fontSize: 13 }}>{h}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          }
        />

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: 8,
            paddingHorizontal: space.md,
            paddingTop: 8,
            paddingBottom: 10,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: t.line,
            backgroundColor: t.bgElev,
          }}
        >
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={pinnedIsToday ? 'food 300' : `Adding to ${dayLabel(pinnedDate)}…`}
            placeholderTextColor={t.textFaint}
            onSubmitEditing={send}
            returnKeyType="send"
            blurOnSubmit={false}
            multiline
            style={{
              flex: 1,
              maxHeight: 110,
              backgroundColor: t.cardAlt,
              borderRadius: 20,
              paddingHorizontal: 16,
              paddingTop: 11,
              paddingBottom: 11,
              color: t.text,
              fontSize: 15.5,
            }}
          />
          <Pressable
            onPress={send}
            disabled={!input.trim()}
            style={{
              width: 42,
              height: 42,
              borderRadius: 21,
              backgroundColor: input.trim() ? t.accent : t.cardAlt,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="arrow-up" size={20} color={input.trim() ? t.onAccent : t.textFaint} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <DatePickerSheet
        visible={showDate}
        value={pinnedDate}
        title="Add entries to…"
        onClose={() => setShowDate(false)}
        onPick={(d) => {
          setPinnedDate(d);
          setShowDate(false);
        }}
      />

      <TxnEditor
        visible={!!editingId}
        txnId={editingId}
        onClose={() => setEditingId(null)}
        onSaved={() => refresh()}
      />
      <TxnEditor
        visible={creating}
        seed={{ local_date: pinnedDate }}
        onClose={() => setCreating(false)}
        onSaved={() => refresh()}
      />
    </Screen>
  );
}
