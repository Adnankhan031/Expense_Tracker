import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { deleteAlias, listAliases } from '../../src/db';
import { parseInput } from '../../src/parser';
import { PARSER_SAMPLES } from '../../src/parser';
import { useData } from '../../src/store';
import { radius, space, useTheme } from '../../src/theme';
import { Card, EmptyState, IconBadge, Money, Screen, SectionTitle, tap } from '../../src/ui';
import { dayLabel, todayLocal } from '../../src/format';

export default function LearnedScreen() {
  const t = useTheme();
  const { categories, aliases, reload, pinnedDate } = useData();
  const [probe, setProbe] = useState('');
  const [tick, setTick] = useState(0);

  const rows = useMemo(() => listAliases(), [tick, aliases]);

  const parsed = useMemo(() => {
    if (!probe.trim()) return null;
    return parseInput(probe, { categories, aliases, defaultDate: pinnedDate, today: todayLocal() });
  }, [probe, categories, aliases, pinnedDate]);

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        <Text style={{ color: t.textDim, fontSize: 13, lineHeight: 19 }}>
          Every time you correct a category, the word you typed gets bound to it. That's why the app gets faster the
          longer you use it.
        </Text>

        <SectionTitle>Try the parser</SectionTitle>
        <Card>
          <TextInput
            value={probe}
            onChangeText={setProbe}
            placeholder="zomato 480 yest upi"
            placeholderTextColor={t.textFaint}
            style={{
              backgroundColor: t.cardAlt,
              borderRadius: radius.md,
              paddingHorizontal: 14,
              paddingVertical: 12,
              color: t.text,
              fontSize: 15,
            }}
          />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
            {PARSER_SAMPLES.slice(0, 6).map((s) => (
              <Pressable
                key={s}
                onPress={() => { tap(); setProbe(s); }}
                style={{ backgroundColor: t.cardAlt, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill }}
              >
                <Text style={{ color: t.textDim, fontSize: 11.5 }}>{s}</Text>
              </Pressable>
            ))}
          </View>

          {parsed?.kind === 'entries' && (
            <View style={{ marginTop: space.md, gap: 8 }}>
              {parsed.entries.map((e, i) => {
                const cat = categories.find((c) => c.id === e.categoryId);
                return (
                  <View
                    key={i}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      backgroundColor: t.cardAlt,
                      borderRadius: radius.md,
                      padding: 10,
                    }}
                  >
                    <IconBadge icon={cat?.icon ?? '📦'} color={cat?.color ?? t.textDim} size={30} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: t.text, fontSize: 13.5, fontWeight: '600' }}>{e.categoryName}</Text>
                      <Text style={{ color: t.textFaint, fontSize: 11, marginTop: 1 }}>
                        {dayLabel(e.date)}
                        {e.method ? ` · ${e.method}` : ''} · confidence {Math.round(e.confidence * 100)}%
                      </Text>
                    </View>
                    <Money minor={e.amountMinor} size={14} color={e.type === 'income' ? t.income : t.text} />
                  </View>
                );
              })}
            </View>
          )}

          {parsed?.kind === 'query' && (
            <Text style={{ color: t.textDim, fontSize: 12.5, marginTop: space.md }}>
              Read as a question about {parsed.query.categoryName ?? 'everything'} for {parsed.query.period.label}.
            </Text>
          )}
        </Card>

        <SectionTitle>Learned words ({rows.length})</SectionTitle>
        {rows.length === 0 ? (
          <Card>
            <EmptyState
              icon="🌱"
              title="Nothing learned yet"
              body="Correct a category on any entry and the word you typed is remembered here."
            />
          </Card>
        ) : (
          <Card>
            {rows.map((a, i) => {
              const cat = categories.find((c) => c.id === a.category_id);
              return (
                <View
                  key={a.keyword}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    paddingVertical: 10,
                    borderTopWidth: i === 0 ? 0 : 1,
                    borderTopColor: t.line,
                  }}
                >
                  <IconBadge icon={cat?.icon ?? '📦'} color={cat?.color ?? t.textDim} size={30} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: t.text, fontSize: 14.5, fontWeight: '600' }}>{a.keyword}</Text>
                    <Text style={{ color: t.textFaint, fontSize: 11.5, marginTop: 1 }}>
                      → {cat?.name ?? a.category_id} · used {a.hits}×
                    </Text>
                  </View>
                  <Pressable
                    hitSlop={10}
                    onPress={() => {
                      tap();
                      deleteAlias(a.keyword);
                      setTick((n) => n + 1);
                      reload();
                    }}
                  >
                    <Ionicons name="close-circle" size={19} color={t.textFaint} />
                  </Pressable>
                </View>
              );
            })}
          </Card>
        )}
      </ScrollView>
    </Screen>
  );
}
