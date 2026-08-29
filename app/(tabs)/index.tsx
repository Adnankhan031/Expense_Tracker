import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  ScrollView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ArrowUp, Camera, Images, LayoutGrid, MessageSquareText, Plus, Trash2, TriangleAlert, X } from 'lucide-react-native';
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
  txnsForDay,
  searchTxns,
} from '../../src/db';
import { parseInput } from '../../src/parser';
import { runQuery, type Answer } from '../../src/analytics';
import { useData, useSettings } from '../../src/store';
import { radius, space, useTheme } from '../../src/theme';
import { Button, Chip, EmptyState, IconBadge, Money, Screen, Sheet, tap, tapSuccess } from '../../src/ui';
import { DatePickerSheet } from '../../src/pickers';
import { TxnEditor } from '../../src/TxnEditor';
import { ItemsEditor, type ReceiptDraft } from '../../src/ItemsEditor';
import { captureReceipt, pickReceipt, readReceipt, type ScannedItem } from '../../src/receipt';
import { dayLabel, formatMoney, shortDayLabel, todayLocal } from '../../src/format';
import { CategoryIcon, IconTile } from '../../src/icons';
import { useKeyboardHeight } from '../../src/useKeyboard';



export default function ChatScreen() {
  const t = useTheme();
  const { currency } = useSettings();
  const { categories, aliases, pinnedDate, setPinnedDate, reload, version, defaultAccountId } = useData();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [txnMap, setTxnMap] = useState<Map<string, TxnWithCategory>>(new Map());
  const [input, setInput] = useState('');
  const [showDate, setShowDate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [todayTotal, setTodayTotal] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const inputRef = useRef<TextInput>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [draft, setDraft] = useState<ReceiptDraft | null>(null);
  const [scanning, setScanning] = useState(false);
  const [askSource, setAskSource] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const kb = useKeyboardHeight();

  /** Drop the category's own keyword in, so all that is left to type is the amount. */
  const pickCategory = (c: (typeof categories)[number]) => {
    tap();
    const word = (c.keywords.split('|')[0] || c.name.split(' ')[0]).toLowerCase();
    setInput((prev) => (prev.trim() ? `${prev.trim()} ` : '') + `${word} `);
    inputRef.current?.focus();
  };

  const fmt = useCallback(
    (m: number) => formatMoney(m, { symbol: currency.symbol, style: currency.grouping, digits: currency.digits }),
    [currency]
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
    setTodayCount(txnsForDay(today).length);

  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh, version])
  );

  /**
   * Pin the thread to the newest message.
   *
   * Two frames, because a row's height is not known until after it lays out and
   * scrolling before that lands short of the bottom.
   */
  const scrollToEnd = useCallback((animated = true) => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated });
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated }));
    });
  }, []);

  useEffect(() => {
    scrollToEnd(false);
  }, [messages.length, scrollToEnd]);

  // The keyboard shrinks the viewport without changing content height, so
  // nothing else fires — without this the latest messages slide out of view.
  useEffect(() => {
    if (kb > 0) scrollToEnd(true);
  }, [kb, scrollToEnd]);

  /**
   * Photograph a receipt straight from the composer.
   *
   * The camera used to live inside the item editor, three taps down and only
   * reachable once a transaction already existed — which is no use when the
   * receipt in your hand is the thing you are trying to record.
   */
  /**
   * Ask where the photo comes from.
   *
   * This was tap-for-camera, hold-for-gallery — which nobody would ever
   * discover. A receipt is just as often already in the camera roll as it is
   * in your hand, so both deserve to be visible.
   */
  const chooseSource = () => {
    tap();
    setAskSource(true);
  };

  const scanReceipt = async (source: 'camera' | 'library') => {
    setScanning(true);
    try {
      const dataUrl = source === 'camera' ? await captureReceipt() : await pickReceipt();
      if (!dataUrl) return;

      const receipt = await readReceipt(dataUrl);
      if (!receipt.items.length) {
        setScanError('No line items found. Try a straighter, brighter photo, with the whole receipt in frame.');
        return;
      }
      setDraft({
        merchant: receipt.merchant,
        date: receipt.purchased_on || pinnedDate,
        total: receipt.total ?? receipt.items.reduce((a: number, i: ScannedItem) => a + i.amount_minor, 0),
        lines: receipt.items.map((i: ScannedItem) => ({ name: i.name, amount_minor: i.amount_minor })),
      });
    } catch (e) {
      setScanError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setScanning(false);
    }
  };

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
    scrollToEnd(true);
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
          <View style={{ backgroundColor: t.brand, borderRadius: 18, borderBottomRightRadius: 5, paddingHorizontal: 14, paddingVertical: 9 }}>
            <Text style={{ color: t.onBrand, fontSize: 15, fontWeight: '600' }}>{item.text}</Text>
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
              backgroundColor: t.surface,
              borderRadius: 16,
              borderBottomLeftRadius: 5,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: t.line,
              borderLeftWidth: 3,
              borderLeftColor: tx.cat_color ?? t.brand,
              padding: 12,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <IconTile name={tx.cat_icon} color={tx.cat_color} size={32} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.ink, fontSize: 14.5, fontWeight: '700' }}>{tx.cat_name}</Text>
                {!!tx.note && <Text style={{ color: t.dim, fontSize: 12, marginTop: 1 }} numberOfLines={1}>{tx.note}</Text>}
              </View>
              <Money
                minor={tx.amount_minor}
                size={17}
                color={tx.type === 'income' ? t.up : t.ink}
                prefix={tx.type === 'income' ? '+' : ''}
              />
              <Pressable onPress={() => removeTxn(item)} hitSlop={10} style={{ paddingLeft: 4 }}>
                <X size={15} color={t.faint} />
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
            backgroundColor: t.surface,
            borderRadius: 16,
            borderBottomLeftRadius: 5,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: t.line,
            padding: 14,
          }}
        >
          <Text style={{ color: t.dim, fontSize: 11.5, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' }}>
            {a.headline}
          </Text>
          <Text style={{ color: t.ink, fontSize: 30, fontWeight: '800', letterSpacing: -1, marginTop: 4, fontVariant: ['tabular-nums'] }}>
            {a.value}
          </Text>
          <Text style={{ color: t.dim, fontSize: 13, marginTop: 3, lineHeight: 18 }}>{a.detail}</Text>
          {a.bars.length > 1 && (
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 38, marginTop: 12 }}>
              {a.bars.map((b, i) => (
                <View
                  key={i}
                  style={{
                    flex: 1,
                    height: Math.max(2, (b.value / max) * 38),
                    backgroundColor: t.brand,
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
                  <Text style={{ color: t.dim, fontSize: 12.5, flex: 1 }}>{b.name}</Text>
                  <Money minor={b.total} size={12.5} weight="600" color={t.dim} compact />
                </View>
              ))}
            </View>
          )}
        </View>
      );
    }

    return (
      <View style={{ alignSelf: 'flex-start', maxWidth: '88%', marginBottom: 8 }}>
        <View style={{ backgroundColor: t.sunken, borderRadius: 16, borderBottomLeftRadius: 5, paddingHorizontal: 14, paddingVertical: 10 }}>
          <Text style={{ color: t.dim, fontSize: 13.5, lineHeight: 19 }}>{item.text}</Text>
        </View>
      </View>
    );
  };

  const MiniChip = ({ label, active, warn }: { label: string; active?: boolean; warn?: boolean }) => (
    <View
      style={{
        backgroundColor: warn ? t.downSoft : active ? t.brandSoft : t.sunken,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: radius.pill,
      }}
    >
      <Text style={{ color: warn ? t.down : active ? t.brand : t.dim, fontSize: 10.5, fontWeight: '700' }}>
        {label}
      </Text>
    </View>
  );

  const header = useMemo(
    () => (
      <View style={{ paddingHorizontal: space.lg, paddingTop: 4, paddingBottom: 8 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: t.surface,
            borderRadius: radius.lg,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: t.line,
            overflow: 'hidden',
          }}
        >
          {/* the highlight is a rail and the number, not a slab of colour */}
          <View style={{ width: 3, alignSelf: 'stretch', backgroundColor: t.brand }} />

          <View style={{ flex: 1, paddingVertical: 12, paddingLeft: 14, paddingRight: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ color: t.dim, fontSize: 11.5, fontWeight: '600' }}>Spent today</Text>
              {todayCount > 0 && (
                <Text style={{ color: t.faint, fontSize: 11.5 }}>
                  · {todayCount} {todayCount === 1 ? 'entry' : 'entries'}
                </Text>
              )}
            </View>
            <Money minor={todayTotal} size={28} style={{ marginTop: 1 }} />
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingRight: 10 }}>
            {messages.length > 0 && (
              <Pressable
                onPress={() => { tap(); clearMessages(); refresh(); }}
                hitSlop={10}
                style={({ pressed }) => ({ padding: 8, opacity: pressed ? 0.5 : 1 })}
              >
                <Trash2 size={16} color={t.faint} />
              </Pressable>
            )}
            <Pressable
              onPress={() => { tap(); setCreating(true); }}
              style={({ pressed }) => ({
                width: 34,
                height: 34,
                borderRadius: radius.md,
                backgroundColor: t.brandSoft,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Plus size={18} color={t.brand} />
            </Pressable>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <Pressable
            onPress={() => { tap(); setShowDate(true); }}
            style={({ pressed }) => ({
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: radius.pill,
              backgroundColor: pinnedIsToday ? 'transparent' : t.brandSoft,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Text style={{ color: pinnedIsToday ? t.faint : t.brand, fontSize: 12, fontWeight: '600' }}>
              Adding to · {dayLabel(pinnedDate)}
            </Text>
          </Pressable>
          {!pinnedIsToday && <Chip label="Reset" small onPress={() => setPinnedDate(todayLocal())} />}
        </View>
      </View>
    ),
    [t, todayTotal, todayCount, pinnedDate, pinnedIsToday, messages.length, refresh, setPinnedDate]
  );

  return (
    <Screen>
      {header}
      <View style={{ flex: 1, paddingBottom: kb }}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: space.lg, paddingBottom: 12, flexGrow: messages.length ? 0 : 1 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          onContentSizeChange={() => scrollToEnd(true)}
          onLayout={() => scrollToEnd(false)}
          ListEmptyComponent={
            <View style={{ flex: 1, justifyContent: 'center', paddingBottom: 90 }}>
              <EmptyState
                icon={<MessageSquareText size={22} color={t.brand} />}
                title="What did you spend?"
                body="Write it the way you would say it. The amount and what it was for is enough — add a day only if it was not today."
              />
            </View>
          }
        />

        {/* tap a category, then just type the amount */}
        {showPicker && (
          <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.line, backgroundColor: t.surface }}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingHorizontal: space.md, paddingVertical: 10, gap: 8 }}
            >
              {categories
                .filter((c) => c.kind === 'expense')
                .map((c) => (
                  <Pressable
                    key={c.id}
                    onPress={() => pickCategory(c)}
                    style={({ pressed }) => ({
                      alignItems: 'center',
                      gap: 5,
                      width: 66,
                      paddingVertical: 8,
                      borderRadius: radius.md,
                      backgroundColor: t.sunken,
                      borderWidth: StyleSheet.hairlineWidth,
                      borderColor: t.line,
                      opacity: pressed ? 0.65 : 1,
                    })}
                  >
                    <CategoryIcon name={c.icon} size={19} color={c.color} />
                    <Text numberOfLines={1} style={{ color: t.dim, fontSize: 9.5, fontWeight: '600', maxWidth: 58 }}>
                      {c.name}
                    </Text>
                  </Pressable>
                ))}
            </ScrollView>
          </View>
        )}

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: 8,
            paddingHorizontal: space.md,
            paddingTop: 8,
            paddingBottom: kb > 0 ? 10 : 12,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: t.line,
            backgroundColor: t.raised,
          }}
        >
          <Pressable
            onPress={() => { tap(); setShowPicker((v) => !v); }}
            style={{
              width: 42,
              height: 42,
              borderRadius: radius.md,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: showPicker ? t.brandSoft : t.sunken,
            }}
          >
            <LayoutGrid size={18} color={showPicker ? t.brand : t.dim} />
          </Pressable>

          <Pressable
            disabled={scanning}
            onPress={chooseSource}
            style={{
              width: 42,
              height: 42,
              borderRadius: radius.md,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: scanning ? t.brandSoft : t.sunken,
              opacity: scanning ? 0.7 : 1,
            }}
          >
            {scanning ? (
              <ActivityIndicator size="small" color={t.brand} />
            ) : (
              <Camera size={18} color={t.dim} />
            )}
          </Pressable>

          <TextInput
            ref={inputRef}
            value={input}
            onChangeText={setInput}
            placeholder={pinnedIsToday ? 'lunch 1200' : `Adding to ${dayLabel(pinnedDate)}…`}
            placeholderTextColor={t.faint}
            onSubmitEditing={send}
            returnKeyType="send"
            blurOnSubmit={false}
            multiline
            style={{
              flex: 1,
              minHeight: 42,
              maxHeight: 110,
              backgroundColor: t.sunken,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: t.line,
              borderRadius: 21,
              paddingHorizontal: 16,
              paddingTop: 11,
              paddingBottom: 11,
              color: t.ink,
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
              backgroundColor: input.trim() ? t.brand : t.sunken,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ArrowUp size={19} color={input.trim() ? t.onBrand : t.faint} />
          </Pressable>
        </View>
      </View>

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

      <Sheet visible={askSource} onClose={() => setAskSource(false)} title="Scan a receipt">
        <Text style={{ color: t.dim, fontSize: 13.5, lineHeight: 19, marginBottom: space.sm }}>
          Photograph the bill, or pick one you have already taken.
        </Text>
        {(
          [
            { key: 'camera', label: 'Take a photo', Icon: Camera },
            { key: 'library', label: 'Choose from gallery', Icon: Images },
          ] as const
        ).map(({ key, label, Icon }) => (
          <Pressable
            key={key}
            onPress={() => {
              tap();
              setAskSource(false);
              void scanReceipt(key);
            }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              backgroundColor: t.sunken,
              borderRadius: radius.md,
              padding: 14,
              marginBottom: 8,
            }}
          >
            <IconBadge icon={<Icon size={18} color={t.brand} />} color={t.brand} size={38} />
            <Text style={{ color: t.ink, fontSize: 15, fontWeight: '600' }}>{label}</Text>
          </Pressable>
        ))}
      </Sheet>

      <Sheet visible={!!scanError} onClose={() => setScanError(null)} title="Could not read it">
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
          <TriangleAlert size={19} color={t.down} style={{ marginTop: 2 }} />
          <Text style={{ color: t.dim, fontSize: 14, lineHeight: 20, flex: 1 }}>{scanError}</Text>
        </View>
        <Text style={{ color: t.faint, fontSize: 12.5, lineHeight: 18, marginTop: space.sm }}>
          You can still type the entry, or add the lines by hand from the entry editor.
        </Text>
        <Button title="OK" onPress={() => setScanError(null)} />
      </Sheet>

      <ItemsEditor
        open={!!draft}
        txnId={null}
        txnTotal={draft?.total ?? 0}
        draft={draft}
        onClose={() => setDraft(null)}
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
