import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Plus, Sparkles, X } from 'lucide-react-native';

import { classifyItem } from './classify';
import { listItems, replaceItems, type Category, type TxnItem } from './db';
import { useData } from './store';
import { radius, space, useTheme } from './theme';
import { Button, Card, Money, Sheet, tap } from './ui';
import { CategoryIcon } from './icons';

type Row = {
  /** Local key only — rows are replaced wholesale on save. */
  uid: string;
  name: string;
  amount: string;
  categoryId: string | null;
  /** Set once the user picks a category by hand, so re-typing the name never
   *  silently overwrites their decision. */
  pinned: boolean;
  auto: boolean;
};

let seq = 0;
const newRow = (): Row => ({ uid: `r${seq++}`, name: '', amount: '', categoryId: null, pinned: false, auto: false });

/**
 * Break a receipt into its lines.
 *
 * The transaction keeps the total; these rows only describe what was inside it,
 * so budgets and cycle figures are untouched. The sum sits against the total at
 * all times and any difference is labelled rather than absorbed — Japanese
 * receipts print tax and 値引 discounts on their own lines, so the items
 * genuinely do not add up, and hiding that would make every figure suspect.
 */
export function ItemsEditor({
  open,
  txnId,
  txnTotal,
  onClose,
}: {
  open: boolean;
  txnId: string | null;
  txnTotal: number;
  onClose: () => void;
}) {
  const t = useTheme();
  const { categories, subCategories, reload } = useData();
  const [rows, setRows] = useState<Row[]>([]);
  const [picking, setPicking] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const byId = useMemo(
    () => new Map<string, Category>([...categories, ...subCategories].map((c) => [c.id, c])),
    [categories, subCategories]
  );
  const byKey = useMemo(
    () => new Map([...categories, ...subCategories].map((c) => [c.key, c])),
    [categories, subCategories]
  );
  const ctx = useMemo(
    () => ({ categories: categories.map((c) => ({ key: c.key, keywords: c.keywords })) }),
    [categories]
  );

  useEffect(() => {
    if (!open || !txnId) return;
    const existing: TxnItem[] = listItems(txnId);
    setRows(
      existing.length
        ? existing.map((it) => ({
            uid: it.id,
            name: it.name,
            amount: String(it.amount_minor / 100),
            categoryId: it.category_id,
            pinned: true,
            auto: false,
          }))
        : [newRow()]
    );
  }, [open, txnId]);

  const classify = (uid: string) =>
    setRows((rs) =>
      rs.map((r) => {
        if (r.uid !== uid || r.pinned || !r.name.trim()) return r;
        const hit = classifyItem(r.name, ctx);
        const key = hit.subKey ?? hit.categoryKey;
        const cat = key ? byKey.get(key) : undefined;
        return cat ? { ...r, categoryId: cat.id, auto: true } : r;
      })
    );

  const itemTotal = rows.reduce((a, r) => a + Math.round(Number(r.amount || '0') * 100), 0);
  const gap = txnTotal - itemTotal;
  const filled = rows.filter((r) => r.name.trim() && Number(r.amount) > 0);

  const save = () => {
    if (!txnId) return;
    setBusy(true);
    try {
      replaceItems(
        txnId,
        filled.map((r) => ({
          name: r.name.trim(),
          amount_minor: Math.round(Number(r.amount) * 100),
          category_id: r.categoryId,
          confidence: r.auto ? 0.9 : 1,
        }))
      );
      reload();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const input = {
    color: t.ink,
    fontSize: 14.5,
    fontWeight: '600' as const,
    paddingVertical: 6,
  };

  return (
    <>
      <Sheet visible={open} onClose={onClose} title="What was in it?">
        <View style={{ gap: 8 }}>
          {rows.map((r) => {
            const cat = r.categoryId ? byId.get(r.categoryId) : undefined;
            return (
              <View
                key={r.uid}
                style={{
                  backgroundColor: t.sunken,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: t.line,
                  padding: 10,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <TextInput
                    value={r.name}
                    onChangeText={(v) => setRows((rs) => rs.map((x) => (x.uid === r.uid ? { ...x, name: v } : x)))}
                    onBlur={() => classify(r.uid)}
                    placeholder="Item"
                    placeholderTextColor={t.faint}
                    autoCorrect={false}
                    style={[input, { flex: 1 }]}
                  />
                  <TextInput
                    value={r.amount}
                    onChangeText={(v) =>
                      setRows((rs) =>
                        rs.map((x) => (x.uid === r.uid ? { ...x, amount: v.replace(/[^0-9.]/g, '') } : x))
                      )
                    }
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={t.faint}
                    style={[input, { width: 84, textAlign: 'right', fontWeight: '800' }]}
                  />
                  <Pressable
                    hitSlop={8}
                    onPress={() => {
                      tap();
                      setRows((rs) => (rs.length > 1 ? rs.filter((x) => x.uid !== r.uid) : [newRow()]));
                    }}
                  >
                    <X size={16} color={t.faint} />
                  </Pressable>
                </View>

                <Pressable
                  onPress={() => {
                    tap();
                    setPicking(r.uid);
                  }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}
                >
                  <CategoryIcon name={cat?.icon} size={13} color={cat?.color ?? t.faint} />
                  <Text style={{ color: cat?.color ?? t.faint, fontSize: 11.5, fontWeight: '600' }}>
                    {cat?.name ?? 'Uncategorised'}
                  </Text>
                  {r.auto && !r.pinned && <Sparkles size={11} color={cat?.color ?? t.faint} />}
                </Pressable>
              </View>
            );
          })}
        </View>

        <Pressable
          onPress={() => {
            tap();
            setRows((rs) => [...rs, newRow()]);
          }}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: t.line,
            borderRadius: radius.md,
            paddingVertical: 11,
          }}
        >
          <Plus size={15} color={t.dim} />
          <Text style={{ color: t.dim, fontSize: 13, fontWeight: '600' }}>Add line</Text>
        </Pressable>

        {/* the arithmetic, always visible, never silently adjusted */}
        <Card>
          <Row label={`${filled.length} ${filled.length === 1 ? 'line' : 'lines'}`} value={itemTotal} t={t} />
          <Row label="Receipt total" value={txnTotal} t={t} />
          <View style={{ height: 1, backgroundColor: t.line, marginVertical: 8 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text
              style={{
                flex: 1,
                color: gap === 0 ? t.up : Math.abs(gap) > txnTotal * 0.35 ? t.down : t.dim,
                fontSize: 13,
                fontWeight: '700',
              }}
            >
              {gap === 0 ? 'Balanced' : gap > 0 ? 'Not accounted for' : 'Over the total'}
            </Text>
            {gap === 0 ? (
              <Text style={{ color: t.up, fontSize: 13, fontWeight: '700' }}>—</Text>
            ) : (
              <Money minor={Math.abs(gap)} size={13} color={Math.abs(gap) > txnTotal * 0.35 ? t.down : t.dim} />
            )}
          </View>
          {gap !== 0 && (
            <Text style={{ color: t.faint, fontSize: 11.5, lineHeight: 16, marginTop: 6 }}>
              {gap > 0
                ? 'Usually tax or a discount on its own line. Leave it — the total stays correct either way.'
                : 'The lines add up to more than the receipt. Check for a doubled entry.'}
            </Text>
          )}
        </Card>

        <Button
          title={`Save ${filled.length} ${filled.length === 1 ? 'line' : 'lines'}`}
          onPress={save}
          loading={busy}
        />
      </Sheet>

      <ItemCategoryPicker
        open={!!picking}
        categories={categories}
        subCategories={subCategories}
        onClose={() => setPicking(null)}
        onPick={(id) => {
          setRows((rs) => rs.map((x) => (x.uid === picking ? { ...x, categoryId: id, pinned: true, auto: false } : x)));
          setPicking(null);
        }}
      />
    </>
  );
}

function Row({ label, value, t }: { label: string; value: number; t: ReturnType<typeof useTheme> }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
      <Text style={{ flex: 1, color: t.dim, fontSize: 13 }}>{label}</Text>
      <Money minor={value} size={13} color={t.ink} />
    </View>
  );
}

/**
 * Both axes in one list.
 *
 * A receipt line is usually a grocery subcategory, but shampoo on a Gyomu bill
 * belongs to Toiletries, so the real categories have to be reachable too.
 */
function ItemCategoryPicker({
  open,
  categories,
  subCategories,
  onClose,
  onPick,
}: {
  open: boolean;
  categories: Category[];
  subCategories: Category[];
  onClose: () => void;
  onPick: (id: string) => void;
}) {
  const t = useTheme();
  const tops = categories.filter((c) => c.kind === 'expense' && !c.archived);

  const group = (title: string, list: Category[]) =>
    list.length > 0 && (
      <>
        <Text
          style={{
            color: t.faint,
            fontSize: 10.5,
            fontWeight: '800',
            letterSpacing: 0.9,
            textTransform: 'uppercase',
            marginTop: space.sm,
            marginBottom: 6,
          }}
        >
          {title}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {list.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => {
                tap();
                onPick(c.id);
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                backgroundColor: t.sunken,
                borderRadius: radius.pill,
                paddingHorizontal: 11,
                paddingVertical: 7,
              }}
            >
              <CategoryIcon name={c.icon} size={13} color={c.color} />
              <Text style={{ color: t.ink, fontSize: 12.5, fontWeight: '600' }}>{c.name}</Text>
            </Pressable>
          ))}
        </View>
      </>
    );

  return (
    <Sheet visible={open} onClose={onClose} title="Categorise this line">
      <ScrollView style={{ maxHeight: 420 }} keyboardShouldPersistTaps="handled">
        {group('Inside groceries', subCategories)}
        {group('Other categories', tops)}
      </ScrollView>
    </Sheet>
  );
}
