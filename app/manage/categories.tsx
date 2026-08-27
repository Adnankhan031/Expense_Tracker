import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Check, ChevronLeft, ChevronRight, Search, X } from 'lucide-react-native';

import { Category, archiveCategory, listCategories, saveCategory } from '../../src/db';
import { useData } from '../../src/store';
import { CATEGORY_COLORS, radius, space, useTheme } from '../../src/theme';
import { Button, Card, Chip, IconBadge, Screen, SectionTitle, Sheet, tap } from '../../src/ui';
import { IconTile } from '../../src/icons';

const ICON_CHOICES = [
  '🍜', '🛒', '🚕', '⛽', '💡', '🏠', '🛍️', '🩺', '🎬', '🔁', '✈️', '📚',
  '💇', '🎁', '⚡', '👨‍👩‍👧', '📈', '🏦', '📦', '💰', '💼', '🪙', '↩️', '✨',
  '☕', '🍺', '🐶', '🎮', '🚗', '📱', '💊', '🧾',
];

export default function CategoriesScreen() {
  const t = useTheme();
  const { reload, version } = useData();
  const [editing, setEditing] = useState<Category | null>(null);
  const [creating, setCreating] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const all = listCategories(true);
  const list = all.filter((c) => (showArchived ? true : !c.archived));
  const expense = list.filter((c) => c.kind === 'expense');
  const income = list.filter((c) => c.kind === 'income');
  void version;

  const row = (c: Category) => (
    <Pressable
      key={c.id}
      onPress={() => { tap(); setEditing(c); }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 9, opacity: c.archived ? 0.45 : 1 }}
    >
      <IconTile name={c.icon} color={c.color} size={36} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.ink, fontSize: 15, fontWeight: '600' }}>{c.name}</Text>
        <Text style={{ color: t.faint, fontSize: 11, marginTop: 1 }} numberOfLines={1}>
          {c.archived ? 'Hidden · ' : ''}
          {(c.keywords || '').split('|').filter(Boolean).slice(0, 4).join(', ') || 'no keywords'}
        </Text>
      </View>
      <ChevronRight size={17} color={t.faint} />
    </Pressable>
  );

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 48 }}>
        <Text style={{ color: t.dim, fontSize: 13, lineHeight: 19 }}>
          Keywords are what the chat parser looks for. Add the words you actually type — shop names, nicknames, anything.
        </Text>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: space.md }}>
          <Chip label="＋ New category" active onPress={() => setCreating(true)} />
          <Chip label={showArchived ? 'Hide hidden' : 'Show hidden'} onPress={() => setShowArchived(!showArchived)} />
        </View>

        <SectionTitle>Expense</SectionTitle>
        <Card>{expense.map(row)}</Card>

        <SectionTitle>Income</SectionTitle>
        <Card>{income.map(row)}</Card>
      </ScrollView>

      <CategoryEditor
        visible={!!editing || creating}
        category={editing}
        onClose={() => {
          setEditing(null);
          setCreating(false);
        }}
        onSaved={() => {
          reload();
          setEditing(null);
          setCreating(false);
        }}
      />
    </Screen>
  );
}

function CategoryEditor({
  visible,
  category,
  onClose,
  onSaved,
}: {
  visible: boolean;
  category: Category | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTheme();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('📦');
  const [color, setColor] = useState(CATEGORY_COLORS[0]);
  const [kind, setKind] = useState<'expense' | 'income'>('expense');
  const [keywords, setKeywords] = useState('');

  React.useEffect(() => {
    if (!visible) return;
    setName(category?.name ?? '');
    setIcon(category?.icon ?? '📦');
    setColor(category?.color ?? CATEGORY_COLORS[0]);
    setKind((category?.kind as 'expense' | 'income') ?? 'expense');
    setKeywords((category?.keywords ?? '').split('|').filter(Boolean).join(', '));
  }, [visible, category]);

  const save = () => {
    if (!name.trim()) return;
    saveCategory({
      id: category?.id,
      name: name.trim(),
      icon,
      color,
      kind,
      keywords: keywords
        .split(',')
        .map((k) => k.trim().toLowerCase())
        .filter(Boolean)
        .join('|'),
    });
    tap();
    onSaved();
  };

  const hide = () => {
    if (!category) return;
    Alert.alert('Hide category?', 'Existing entries keep it, but it stops appearing in pickers.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: category.archived ? 'Unhide' : 'Hide',
        onPress: () => {
          archiveCategory(category.id, !category.archived);
          onSaved();
        },
      },
    ]);
  };

  const input = {
    backgroundColor: t.sunken,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: t.ink,
    fontSize: 15,
  } as const;

  return (
    <Sheet visible={visible} onClose={onClose} title={category ? 'Edit category' : 'New category'}>
      <TextInput value={name} onChangeText={setName} placeholder="Name" placeholderTextColor={t.faint} style={input} />

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Chip label="Expense" active={kind === 'expense'} onPress={() => setKind('expense')} />
        <Chip label="Income" active={kind === 'income'} onPress={() => setKind('income')} />
      </View>

      <Text style={{ color: t.dim, fontSize: 12, fontWeight: '600' }}>Icon</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {ICON_CHOICES.map((ic) => (
          <Pressable
            key={ic}
            onPress={() => { tap(); setIcon(ic); }}
            style={{
              width: 40,
              height: 40,
              borderRadius: radius.md,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: icon === ic ? color + '33' : t.sunken,
              borderWidth: icon === ic ? 1.5 : 0,
              borderColor: color,
            }}
          >
            <Text style={{ fontSize: 19 }}>{ic}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={{ color: t.dim, fontSize: 12, fontWeight: '600' }}>Colour</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {CATEGORY_COLORS.map((c) => (
          <Pressable
            key={c}
            onPress={() => { tap(); setColor(c); }}
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              backgroundColor: c,
              borderWidth: color === c ? 3 : 0,
              borderColor: t.ink,
            }}
          />
        ))}
      </View>

      <Text style={{ color: t.dim, fontSize: 12, fontWeight: '600' }}>Keywords (comma separated)</Text>
      <TextInput
        value={keywords}
        onChangeText={setKeywords}
        placeholder="swiggy, zomato, lunch, dinner"
        placeholderTextColor={t.faint}
        multiline
        style={{ ...input, minHeight: 80, textAlignVertical: 'top' }}
      />

      <Button title="Save" onPress={save} />
      {!!category && <Button title={category.archived ? 'Unhide category' : 'Hide category'} variant="ghost" onPress={hide} />}
    </Sheet>
  );
}
