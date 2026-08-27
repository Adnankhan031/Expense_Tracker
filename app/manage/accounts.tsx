import React, { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { Account, archiveAccount, saveAccount, searchTxns } from '../../src/db';
import { useData } from '../../src/store';
import { radius, space, useTheme } from '../../src/theme';
import { Button, Card, Chip, IconBadge, Money, Screen, SectionTitle, Sheet, tap } from '../../src/ui';
import { IconTile } from '../../src/icons';

const ICONS = ['💵', '🏦', '💳', '📱', '🪙', '👛', '🏧', '💎'];

export default function AccountsScreen() {
  const t = useTheme();
  const { accounts, reload, version } = useData();
  const [editing, setEditing] = useState<Account | null>(null);
  const [creating, setCreating] = useState(false);

  const totals = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const x of searchTxns({ limit: 5000 })) {
      if (!x.account_id) continue;
      const delta = x.type === 'income' ? x.amount_minor : -x.amount_minor;
      map.set(x.account_id, (map.get(x.account_id) ?? 0) + delta);
    }
    return map;
  }, [version]);

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 48 }}>
        <Text style={{ color: t.dim, fontSize: 13, lineHeight: 19 }}>
          Tag entries with where the money came from. The balance below is income minus expenses for that account, not a
          bank balance.
        </Text>

        <Chip label="＋ New account" active onPress={() => setCreating(true)} />

        <SectionTitle>Accounts</SectionTitle>
        <Card>
          {accounts.map((a, i) => {
            const net = totals.get(a.id) ?? 0;
            return (
              <Pressable
                key={a.id}
                onPress={() => { tap(); setEditing(a); }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space.md,
                  paddingVertical: 11,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: t.line,
                }}
              >
                <IconTile name={a.icon} color={t.info} size={36} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.ink, fontSize: 15, fontWeight: '600' }}>{a.name}</Text>
                  <Text style={{ color: t.faint, fontSize: 11.5, textTransform: 'capitalize', marginTop: 1 }}>{a.kind}</Text>
                </View>
                <Money minor={net} size={14} color={net >= 0 ? t.up : t.down} prefix={net > 0 ? '+' : ''} />
                <Ionicons name="chevron-forward" size={17} color={t.faint} />
              </Pressable>
            );
          })}
        </Card>
      </ScrollView>

      <AccountEditor
        visible={!!editing || creating}
        account={editing}
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

function AccountEditor({
  visible,
  account,
  onClose,
  onSaved,
}: {
  visible: boolean;
  account: Account | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTheme();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('💵');
  const [kind, setKind] = useState('cash');

  React.useEffect(() => {
    if (!visible) return;
    setName(account?.name ?? '');
    setIcon(account?.icon ?? '💵');
    setKind(account?.kind ?? 'cash');
  }, [visible, account]);

  return (
    <Sheet visible={visible} onClose={onClose} title={account ? 'Edit account' : 'New account'}>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Name"
        placeholderTextColor={t.faint}
        style={{ backgroundColor: t.sunken, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, color: t.ink, fontSize: 15 }}
      />
      <View style={{ flexDirection: 'row', gap: 7, flexWrap: 'wrap' }}>
        {['cash', 'bank', 'card', 'wallet'].map((k) => (
          <Chip key={k} label={k} small active={kind === k} onPress={() => setKind(k)} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 7, flexWrap: 'wrap' }}>
        {ICONS.map((ic) => (
          <Pressable
            key={ic}
            onPress={() => { tap(); setIcon(ic); }}
            style={{
              width: 40,
              height: 40,
              borderRadius: radius.md,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: icon === ic ? t.brandSoft : t.sunken,
            }}
          >
            <Text style={{ fontSize: 19 }}>{ic}</Text>
          </Pressable>
        ))}
      </View>
      <Button
        title="Save"
        onPress={() => {
          if (!name.trim()) return;
          saveAccount({ id: account?.id, name: name.trim(), icon, kind });
          onSaved();
        }}
      />
      {!!account && (
        <Button
          title="Remove account"
          variant="ghost"
          onPress={() => {
            archiveAccount(account.id);
            onSaved();
          }}
        />
      )}
    </Sheet>
  );
}
