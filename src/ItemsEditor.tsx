import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Camera, ImagePlus, Plus, Sparkles, X } from 'lucide-react-native';

import { classifyItem } from './classify';
import { insertTxn, listItems, replaceItems, type Category, type TxnItem } from './db';
import { useData } from './store';
import { radius, space, useTheme } from './theme';
import { Button, Card, Money, Sheet, tap } from './ui';
import { CategoryIcon } from './icons';
import { captureReceipt, pickReceipt, readReceipt, readReceiptOnDevice, translateNames } from './receipt';

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
  /** As printed on the receipt, kept when `name` has been translated. */
  original?: string;
};

/** Digits, one dot, and a leading minus for discount lines. */
function cleanAmount(v: string): string {
  const negative = v.trim().startsWith('-');
  const digits = v.replace(/[^0-9.]/g, '');
  return negative ? `-${digits}` : digits;
}

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
/**
 * A receipt read from a photo, before it is anything in the database.
 *
 * Scanning from the composer has no transaction to attach to yet, so the whole
 * receipt — total, shop, date and lines — is held here until the user confirms.
 * Nothing is written until they press save.
 */
export type ReceiptDraft = {
  merchant: string | null;
  date: string;
  total: number;
  /** `name` is what the receipt printed; `en` is its translation, when we have one. */
  lines: { name: string; en?: string | null; amount_minor: number }[];
};

export function ItemsEditor({
  open,
  txnId,
  txnTotal,
  draft,
  onClose,
  onCreated,
}: {
  open: boolean;
  txnId: string | null;
  txnTotal: number;
  draft?: ReceiptDraft | null;
  onClose: () => void;
  onCreated?: (id: string) => void;
}) {
  const t = useTheme();
  const { categories, subCategories, reload } = useData();
  const [rows, setRows] = useState<Row[]>([]);
  const [picking, setPicking] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanNote, setScanNote] = useState<string | null>(null);

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
    if (!open) return;

    if (!txnId && draft) {
      setRows(
        draft.lines.map((l) => {
          // Classify on the Japanese name; show the English one.
          const hit = classifyItem(l.name, ctx);
          const key = hit.subKey ?? hit.categoryKey;
          const cat = key ? byKey.get(key) : undefined;
          return {
            uid: `d${seq++}`,
            name: l.en || l.name,
            original: l.en ? l.name : undefined,
            amount: String(l.amount_minor / 100),
            categoryId: cat?.id ?? null,
            pinned: false,
            auto: !!cat,
          };
        })
      );
      return;
    }

    if (!txnId) return;
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
  }, [open, txnId, draft]);

  const classify = (uid: string) =>
    setRows((rs) =>
      rs.map((r) => {
        if (r.uid !== uid || r.pinned || !r.name.trim()) return r;
        // The dictionary and the learned aliases are Japanese, so match on
        // what the receipt said rather than on the English label.
        const hit = classifyItem(r.original ?? r.name, ctx);
        const key = hit.subKey ?? hit.categoryKey;
        const cat = key ? byKey.get(key) : undefined;
        return cat ? { ...r, categoryId: cat.id, auto: true } : r;
      })
    );

  /**
   * Photograph the bill and let the model split it.
   *
   * Every line still lands in the same editable rows, unsaved, so a misread
   * price is corrected here rather than discovered in next month's totals.
   */
  const scan = async (source: 'camera' | 'library') => {
    setScanning(true);
    setScanError(null);
    setScanNote(null);
    try {
      const shot = source === 'camera' ? await captureReceipt() : await pickReceipt();
      if (!shot) return; // backed out

      // On-device first; the cloud model only when that cannot make sense of it.
      let receipt = await readReceiptOnDevice(shot.uri);
      if (!receipt) receipt = await readReceipt(shot.dataUrl);
      if (!receipt.items.length) {
        setScanError('No line items found. Try a straighter, brighter photo.');
        return;
      }

      // Classify as the rows are built, so most arrive already sorted.
      const scanned: Row[] = receipt.items.map((it) => {
        const hit = classifyItem(it.name, ctx);
        const key = hit.subKey ?? hit.categoryKey;
        const cat = key ? byKey.get(key) : undefined;
        return {
          uid: `s${seq++}`,
          name: it.name,
          amount: String(it.amount_minor / 100),
          categoryId: cat?.id ?? null,
          pinned: false,
          auto: !!cat,
        };
      });

      // Replace empty starter rows; keep anything already typed.
      setRows((rs) => [...rs.filter((r) => r.name.trim() || Number(r.amount) > 0), ...scanned]);

      /**
       * Translate before showing, so the list is readable straight away.
       *
       * Classification uses the Japanese name — the dictionary is Japanese and
       * the learned aliases are keyed on it — so the original is kept on the
       * row and only the label changes.
       */
      const english = await translateNames(scanned.map((r) => r.name));
      for (const r of scanned) {
        const en = english.get(r.name);
        if (en) {
          r.original = r.name;
          r.name = en;
        }
      }

      const named = scanned.filter((r) => r.categoryId).length;
      setScanNote(
        `${scanned.length} lines read${receipt.merchant ? ` from ${receipt.merchant}` : ''} · ` +
          `${named} categorised automatically`
      );
    } catch (e) {
      setScanError(e instanceof Error ? e.message : 'Could not read that photo.');
    } finally {
      setScanning(false);
    }
  };

  const itemTotal = rows.reduce((a, r) => a + Math.round(Number(r.amount || '0') * 100), 0);
  const gap = txnTotal - itemTotal;
  // Non-zero, not positive: a 値引 discount is a real line with a negative
  // amount. Requiring > 0 displayed it and then dropped it on save, which is
  // the worst of both — the basket looked itemised and silently was not.
  const filled = rows.filter((r) => r.name.trim() && Number(r.amount) !== 0);

  const save = () => {
    setBusy(true);
    try {
      let target = txnId;

      if (!target && draft) {
        // File the receipt under whichever category the basket is mostly made
        // of, so it lands somewhere sensible before the user reviews it.
        const weight = new Map<string, number>();
        for (const r of filled) {
          const cat = r.categoryId ? byId.get(r.categoryId) : undefined;
          const parent = cat?.parent_key ?? cat?.key;
          if (parent) weight.set(parent, (weight.get(parent) ?? 0) + Math.abs(Number(r.amount) || 0));
        }
        const dominant = [...weight.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
        const catId =
          categories.find((c) => c.key === dominant)?.id ??
          categories.find((c) => c.key === 'groceries')?.id ??
          categories.find((c) => c.key === 'other')?.id ??
          categories[0]?.id ??
          '';

        target = insertTxn({
          amount_minor: draft.total > 0 ? draft.total : Math.round(itemTotal),
          type: 'expense',
          category_id: catId,
          local_date: draft.date,
          note: draft.merchant,
          source: 'manual',
          confidence: 0.9,
        });
        onCreated?.(target);
      }

      if (!target) return;

      replaceItems(
        target,
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
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button
            title={scanning ? 'Reading…' : 'Scan a receipt'}
            icon={<Camera size={16} color={t.onBrand} />}
            onPress={() => void scan('camera')}
            loading={scanning}
            style={{ flex: 1 }}
          />
          <Button
            title=""
            icon={<ImagePlus size={17} color={t.ink} />}
            variant="ghost"
            onPress={() => void scan('library')}
            disabled={scanning}
          />
        </View>

        {!!scanError && (
          <Text style={{ color: t.down, fontSize: 12.5, lineHeight: 17 }}>{scanError}</Text>
        )}
        {!!scanNote && !scanError && (
          <Text style={{ color: t.dim, fontSize: 12.5, lineHeight: 17 }}>
            {scanNote} — check the prices before saving.
          </Text>
        )}

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
                        rs.map((x) => (x.uid === r.uid ? { ...x, amount: cleanAmount(v) } : x))
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

                {!!r.original && (
                  <Text style={{ color: t.faint, fontSize: 11.5, marginTop: 3 }} numberOfLines={1}>
                    {r.original}
                  </Text>
                )}

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
