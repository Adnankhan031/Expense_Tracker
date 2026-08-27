import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { radius, space, useTheme } from './theme';
import { formatMoney } from './format';
import { useSettings } from './store';

export const tap = () => {
  if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
};
export const tapSuccess = () => {
  if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
};
export const tapWarn = () => {
  if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
};

/* ------------------------------------------------------------------ */

export function Screen({ children, style }: { children?: React.ReactNode; style?: ViewStyle }) {
  const t = useTheme();
  return <SafeAreaView style={[{ flex: 1, backgroundColor: t.bg }, style]} edges={['top']}>{children}</SafeAreaView>;
}

export function Header({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  const t = useTheme();
  return (
    <View style={s.header}>
      <View style={{ flex: 1 }}>
        <Text style={[s.h1, { color: t.text }]}>{title}</Text>
        {!!subtitle && <Text style={[s.sub, { color: t.textDim }]}>{subtitle}</Text>}
      </View>
      {right}
    </View>
  );
}

export function Card({
  children,
  style,
  onPress,
  padded = true,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  padded?: boolean;
}) {
  const t = useTheme();
  const body = (
    <View
      style={[
        {
          backgroundColor: t.card,
          borderRadius: radius.lg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: t.line,
          padding: padded ? space.lg : 0,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable onPress={() => { tap(); onPress(); }} style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}>
      {body}
    </Pressable>
  );
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={s.sectionRow}>
      <Text style={[s.section, { color: t.textDim }]}>{children}</Text>
      {right}
    </View>
  );
}

export function Money({
  minor,
  size = 18,
  weight = '700',
  color,
  compact,
  decimals,
  prefix,
  style,
}: {
  minor: number;
  size?: number;
  weight?: TextStyle['fontWeight'];
  color?: string;
  compact?: boolean;
  decimals?: boolean;
  prefix?: string;
  style?: TextStyle;
}) {
  const t = useTheme();
  const { currency, numberStyle } = useSettings();
  return (
    <Text
      style={[
        {
          color: color ?? t.text,
          fontSize: size,
          fontWeight: weight,
          fontVariant: ['tabular-nums'],
          letterSpacing: -0.4,
        },
        style,
      ]}
    >
      {prefix ?? ''}
      {formatMoney(minor, { symbol: currency, style: numberStyle, compact, decimals })}
    </Text>
  );
}

export function Chip({
  label,
  active,
  onPress,
  color,
  small,
  icon,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  color?: string;
  small?: boolean;
  icon?: string;
}) {
  const t = useTheme();
  const bg = active ? (color ? color + '26' : t.accentSoft) : t.cardAlt;
  const fg = active ? color ?? t.accent : t.textDim;
  return (
    <Pressable
      onPress={onPress ? () => { tap(); onPress(); } : undefined}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          borderRadius: radius.pill,
          paddingHorizontal: small ? 9 : 12,
          paddingVertical: small ? 4 : 6,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: active ? 'transparent' : t.line,
          opacity: pressed ? 0.7 : 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
        },
      ]}
    >
      {!!icon && <Text style={{ fontSize: small ? 10 : 12 }}>{icon}</Text>}
      <Text style={{ color: fg, fontSize: small ? 11 : 13, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  style,
  disabled,
  loading,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  style?: ViewStyle;
  disabled?: boolean;
  loading?: boolean;
}) {
  const t = useTheme();
  const bg = variant === 'primary' ? t.accent : variant === 'danger' ? t.dangerSoft : t.cardAlt;
  const fg = variant === 'primary' ? t.onAccent : variant === 'danger' ? t.danger : t.text;
  return (
    <Pressable
      disabled={disabled || loading}
      onPress={() => { tap(); onPress(); }}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          borderRadius: radius.md,
          paddingVertical: 14,
          paddingHorizontal: space.lg,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.4 : pressed ? 0.8 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={{ color: fg, fontWeight: '700', fontSize: 15 }}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: t.cardAlt, borderRadius: radius.md, padding: 3, gap: 3 }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => { tap(); onChange(o.value); }}
            style={{
              flex: 1,
              paddingVertical: 8,
              borderRadius: radius.sm,
              backgroundColor: active ? t.card : 'transparent',
              alignItems: 'center',
            }}
          >
            <Text style={{ color: active ? t.text : t.textDim, fontWeight: active ? '700' : '600', fontSize: 13 }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Sheet({
  visible,
  onClose,
  title,
  children,
  maxHeight = '88%',
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxHeight?: number | `${number}%`;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={{ flex: 1, backgroundColor: '#00000099' }} onPress={onClose} />
      <View
        style={{
          backgroundColor: t.bgElev,
          borderTopLeftRadius: radius.xl,
          borderTopRightRadius: radius.xl,
          paddingBottom: insets.bottom + space.lg,
          maxHeight: maxHeight as any,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderColor: t.line,
        }}
      >
        <View style={{ alignItems: 'center', paddingTop: 10 }}>
          <View style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: t.lineStrong }} />
        </View>
        {!!title && (
          <Text style={{ color: t.text, fontSize: 17, fontWeight: '700', paddingHorizontal: space.lg, paddingTop: space.md }}>
            {title}
          </Text>
        )}
        <ScrollView
          style={{ flexGrow: 0 }}
          contentContainerStyle={{ padding: space.lg, gap: space.md }}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </View>
    </Modal>
  );
}

export function EmptyState({ icon, title, body }: { icon: string; title: string; body?: string }) {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center', padding: space.xxl, gap: 8 }}>
      <Text style={{ fontSize: 40 }}>{icon}</Text>
      <Text style={{ color: t.text, fontSize: 16, fontWeight: '700' }}>{title}</Text>
      {!!body && (
        <Text style={{ color: t.textDim, fontSize: 13.5, textAlign: 'center', lineHeight: 20, maxWidth: 300 }}>
          {body}
        </Text>
      )}
    </View>
  );
}

export function Row({
  left,
  title,
  subtitle,
  right,
  onPress,
  danger,
}: {
  left?: React.ReactNode;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  danger?: boolean;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress ? () => { tap(); onPress(); } : undefined}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        paddingVertical: 13,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {left}
      <View style={{ flex: 1 }}>
        <Text style={{ color: danger ? t.danger : t.text, fontSize: 15, fontWeight: '600' }}>{title}</Text>
        {!!subtitle && <Text style={{ color: t.textDim, fontSize: 12.5, marginTop: 2 }}>{subtitle}</Text>}
      </View>
      {right}
    </Pressable>
  );
}

export function IconBadge({ icon, color, size = 38 }: { icon: string; color: string; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 3,
        backgroundColor: color + '24',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: size * 0.45 }}>{icon}</Text>
    </View>
  );
}

export function Divider() {
  const t = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: t.line }} />;
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.md, gap: space.md },
  h1: { fontSize: 28, fontWeight: '800', letterSpacing: -0.8 },
  sub: { fontSize: 13, marginTop: 2 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.sm, marginTop: space.lg },
  section: { fontSize: 11.5, fontWeight: '700', letterSpacing: 1.1, textTransform: 'uppercase' },
});
