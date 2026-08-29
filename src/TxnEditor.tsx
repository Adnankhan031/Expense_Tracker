import React, { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { CalendarDays, Check, ChevronRight, ReceiptText } from 'lucide-react-native';
import {
  NewTxn,
  Txn,
  getTxn,
  insertTxn,
  learnAlias,
  listItems,
  softDeleteTxn,
  updateTxn,
} from './db';
import { useData, useSettings } from './store';
import { Button, Chip, IconBadge, Sheet, tap, tapSuccess } from './ui';
import { CategoryPickerSheet, DatePickerSheet } from './pickers';
import { radius, space, useTheme } from './theme';
import { dayLabel, toMinor } from './format';
import { IconTile } from './icons';
import { ItemsEditor } from './ItemsEditor';

const METHODS = ['Cash', 'UPI', 'Card', 'Bank', 'Wallet'];

export type EditorSeed = Partial<NewTxn> & { learnToken?: string | null };

export function TxnEditor({
  visible,
  txnId,
  seed,
  onClose,
  onSaved,
}: {
  visible: boolean;
  txnId?: string | null;
  seed?: EditorSeed;
  onClose: () => void;
  onSaved?: (id: string) => void;
}) {
  const t = useTheme();
  const { currency } = useSettings();
  const { categories, accounts, pinnedDate, reload } = useData();

  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [categoryId, setCategoryId] = useState<string>('other');
  const [date, setDate] = useState(pinnedDate);
  const [method, setMethod] = useState<string | null>(null);
  const [showItems, setShowItems] = useState(false);
  const [itemCount, setItemCount] = useState(0);

  // Re-read when the editor opens and whenever the items sheet closes, so the
  // summary row reflects an edit that just happened.
  useEffect(() => {
    setItemCount(visible && txnId ? listItems(txnId).length : 0);
  }, [visible, txnId, showItems]);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [reimbursable, setReimbursable] = useState(false);
  const [original, setOriginal] = useState<Txn | null>(null);
  const [showCat, setShowCat] = useState(false);
  const [showDate, setShowDate] = useState(false);

  useEffect(() => {
    if (!visible) return;
    if (txnId) {
      const tx = getTxn(txnId);
      if (tx) {
        setOriginal(tx);
        setAmount(String(tx.amount_minor / 100));
        setType(tx.type);
        setCategoryId(tx.category_id);
        setDate(tx.local_date);
        setMethod(tx.method);
        setAccountId(tx.account_id);
        setNote(tx.note ?? '');
        setReimbursable(!!tx.reimbursable);
      }
    } else {
      setOriginal(null);
      setAmount(seed?.amount_minor ? String(seed.amount_minor / 100) : '');
      setType(seed?.type ?? 'expense');
      setCategoryId(seed?.category_id ?? categories.find((c) => c.key === 'other')?.id ?? categories[0]?.id ?? 'other');
      setDate(seed?.local_date ?? pinnedDate);
      setMethod(seed?.method ?? null);
      setAccountId(seed?.account_id ?? null);
      setNote(seed?.note ?? '');
      setReimbursable(false);
    }
  }, [visible, txnId]);

  const category = categories.find((c) => c.id === categoryId);

  const save = () => {
    const minor = toMinor(Number(amount || '0'));
    if (!minor || minor <= 0) return;

    // a manual category change is the strongest training signal there is
    const learnSource = (note || original?.note || original?.raw_input || seed?.note || '').toLowerCase();
    const token = learnSource.split(/[^a-z0-9']+/).find((w) => w.length >= 3);
    if (token && (!original || original.category_id !== categoryId)) learnAlias(token, categoryId);

    if (txnId && original) {
      updateTxn(txnId, {
        amount_minor: minor,
        type,
        category_id: categoryId,
        local_date: date,
        method,
        account_id: accountId,
        note: note.trim() || null,
        reimbursable,
      });
      tapSuccess();
      reload();
      onSaved?.(txnId);
    } else {
      const id = insertTxn({
        amount_minor: minor,
        type,
        category_id: categoryId,
        local_date: date,
        method,
        account_id: accountId,
        note: note.trim() || null,
        reimbursable,
        raw_input: seed?.raw_input ?? null,
        source: seed?.source ?? 'manual',
        confidence: 1,
      });
      tapSuccess();
      reload();
      onSaved?.(id);
    }
    onClose();
  };

  const remove = () => {
    if (!txnId) return;
    softDeleteTxn(txnId);
    tap();
    reload();
    onClose();
  };

  return (
    <>
      <Sheet visible={visible} onClose={onClose} title={txnId ? 'Edit entry' : 'New entry'}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Chip label="Expense" active={type === 'expense'} onPress={() => setType('expense')} />
          <Chip label="Income" active={type === 'income'} color={t.up} onPress={() => setType('income')} />
        </View>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: t.sunken,
            borderRadius: radius.md,
            paddingHorizontal: 14,
          }}
        >
          <Text style={{ color: t.dim, fontSize: 24, fontWeight: '700' }}>{currency.symbol}</Text>
          <TextInput
            value={amount}
            onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, ''))}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={t.faint}
            autoFocus={!txnId}
            style={{
              flex: 1,
              color: t.ink,
              fontSize: 30,
              fontWeight: '800',
              paddingVertical: 12,
              paddingHorizontal: 8,
              fontVariant: ['tabular-nums'],
            }}
          />
        </View>

        <Pressable
          onPress={() => { tap(); setShowCat(true); }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: t.sunken, borderRadius: radius.md, padding: 12 }}
        >
          <IconTile name={category?.icon} color={category?.color ?? '#8a9099'} size={34} />
          <Text style={{ color: t.ink, fontSize: 15, fontWeight: '600', flex: 1 }}>{category?.name ?? 'Choose category'}</Text>
          <ChevronRight size={17} color={t.faint} />
        </Pressable>

        <Pressable
          onPress={() => { tap(); setShowDate(true); }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: t.sunken, borderRadius: radius.md, padding: 14 }}
        >
          <CalendarDays size={19} color={t.dim} />
          <Text style={{ color: t.ink, fontSize: 15, fontWeight: '600', flex: 1 }}>{dayLabel(date)}</Text>
          <ChevronRight size={17} color={t.faint} />
        </Pressable>

        <View style={{ flexDirection: 'row', gap: 7, flexWrap: 'wrap' }}>
          {METHODS.map((m) => (
            <Chip key={m} label={m} small active={method === m} onPress={() => setMethod(method === m ? null : m)} />
          ))}
        </View>

        {accounts.length > 0 && (
          <View style={{ flexDirection: 'row', gap: 7, flexWrap: 'wrap' }}>
            {accounts.map((a) => (
              <Chip
                key={a.id}
                icon={a.icon}
                label={a.name}
                small
                active={accountId === a.id}
                onPress={() => setAccountId(accountId === a.id ? null : a.id)}
              />
            ))}
          </View>
        )}

        {/* Itemising needs a saved transaction — there is no id to hang the
            lines off until it exists. */}
        {txnId && type === 'expense' && (
          <Pressable
            onPress={() => {
              tap();
              setShowItems(true);
            }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              backgroundColor: t.sunken,
              borderRadius: radius.md,
              padding: 14,
            }}
          >
            <ReceiptText size={19} color={t.dim} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.ink, fontSize: 15, fontWeight: '600' }}>
                {itemCount > 0 ? `${itemCount} ${itemCount === 1 ? 'line' : 'lines'}` : 'Itemise this receipt'}
              </Text>
              <Text style={{ color: t.dim, fontSize: 11.5, marginTop: 2 }}>
                {itemCount > 0 ? 'What was actually in the basket' : 'Break it into what you actually bought'}
              </Text>
            </View>
            <ChevronRight size={17} color={t.faint} />
          </Pressable>
        )}

        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Note (optional)"
          placeholderTextColor={t.faint}
          style={{
            backgroundColor: t.sunken,
            borderRadius: radius.md,
            paddingHorizontal: 14,
            paddingVertical: 13,
            color: t.ink,
            fontSize: 15,
          }}
        />

        <Pressable
          onPress={() => { tap(); setReimbursable((v) => !v); }}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            backgroundColor: reimbursable ? t.upSoft : t.sunken,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: reimbursable ? t.up : 'transparent',
            padding: 12,
          }}
        >
          <View
            style={{
              width: 20,
              height: 20,
              borderRadius: 6,
              borderWidth: 2,
              borderColor: reimbursable ? t.up : t.lineStrong,
              backgroundColor: reimbursable ? t.up : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {reimbursable && <Check size={13} color={t.dark ? '#04231C' : '#FFFFFF'} />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.ink, fontSize: 14.5, fontWeight: '600' }}>I get this back</Text>
            <Text style={{ color: t.dim, fontSize: 11.5, marginTop: 1 }}>
              Reimbursable — tracked until it is paid back
            </Text>
          </View>
        </Pressable>

        <Button title={txnId ? 'Save changes' : 'Add entry'} onPress={save} />
        {!!txnId && <Button title="Delete" variant="danger" onPress={remove} />}
      </Sheet>

      <ItemsEditor
        open={showItems}
        txnId={txnId ?? null}
        txnTotal={toMinor(Number(amount || '0'))}
        onClose={() => setShowItems(false)}
      />

      <CategoryPickerSheet
        visible={showCat}
        categories={categories}
        value={categoryId}
        kind={type}
        onClose={() => setShowCat(false)}
        onPick={(id) => {
          if (id) setCategoryId(id);
          setShowCat(false);
        }}
      />
      <DatePickerSheet
        visible={showDate}
        value={date}
        onClose={() => setShowDate(false)}
        onPick={(d) => {
          setDate(d);
          setShowDate(false);
        }}
      />
    </>
  );
}
