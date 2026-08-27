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
import { X } from 'lucide-react-native';
import { radius, space, useTheme } from './theme';
import { useKeyboardHeight } from './useKeyboard';
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

/* ---------------------------------------------------------------- surfaces */

export function Screen({ children, style }: { children?: React.ReactNode; style?: ViewStyle }) {
  const t = useTheme();
  return (
    <SafeAreaView style={[{ flex: 1, backgroundColor: t.bg }, style]} edges={['top']}>
      {children}
    </SafeAreaView>
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
          backgroundColor: t.surface,
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
    <Pressable
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
    >
      {body}
    </Pressable>
  );
}

export function PageTitle({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.md, paddingTop: space.md, paddingBottom: 4 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.ink, fontSize: 28, fontWeight: '800', letterSpacing: -0.8 }}>{title}</Text>
        {!!subtitle && <Text style={{ color: t.dim, fontSize: 13, marginTop: 5 }}>{subtitle}</Text>}
      </View>
      {right}
    </View>
  );
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        marginBottom: space.sm,
        marginTop: space.xl,
      }}
    >
      <Text style={{ color: t.faint, fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' }}>
        {children}
      </Text>
      {right}
    </View>
  );
}

/* ------------------------------------------------------------------- money */

export function Money({
  minor,
  size = 18,
  weight = '700',
  color,
  compact,
  prefix,
  style,
}: {
  minor: number;
  size?: number;
  weight?: TextStyle['fontWeight'];
  color?: string;
  compact?: boolean;
  prefix?: string;
  style?: TextStyle;
}) {
  const t = useTheme();
  const { currency } = useSettings();
  return (
    <Text
      style={[
        {
          color: color ?? t.ink,
          fontSize: size,
          fontWeight: weight,
          fontVariant: ['tabular-nums'],
          letterSpacing: -0.4,
        },
        style,
      ]}
    >
      {prefix ?? ''}
      {formatMoney(minor, {
        symbol: currency.symbol,
        style: currency.grouping,
        digits: currency.digits,
        compact,
      })}
    </Text>
  );
}

/* ------------------------------------------------------------------ inputs */

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
  icon?: React.ReactNode;
}) {
  const t = useTheme();
  const bg = active ? (color ? color + '24' : t.brand) : t.sunken;
  const fg = active ? (color ? color : t.onBrand) : t.dim;
  return (
    <Pressable
      onPress={
        onPress
          ? () => {
              tap();
              onPress();
            }
          : undefined
      }
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          borderRadius: radius.pill,
          paddingHorizontal: small ? 10 : 12,
          paddingVertical: small ? 5 : 7,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: active ? 'transparent' : t.line,
          opacity: pressed ? 0.7 : 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
        },
      ]}
    >
      {icon}
      <Text style={{ color: fg, fontSize: small ? 11.5 : 13, fontWeight: '700' }}>{label}</Text>
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
  icon,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'outline' | 'danger';
  style?: ViewStyle;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
}) {
  const t = useTheme();
  const bg =
    variant === 'primary' ? t.brand : variant === 'danger' ? t.downSoft : variant === 'outline' ? 'transparent' : t.sunken;
  const fg = variant === 'primary' ? t.onBrand : variant === 'danger' ? t.down : t.ink;
  return (
    <Pressable
      disabled={disabled || loading}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          borderRadius: radius.md,
          borderWidth: variant === 'outline' ? StyleSheet.hairlineWidth : 0,
          borderColor: t.lineStrong,
          paddingVertical: 14,
          paddingHorizontal: space.lg,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} size="small" /> : icon}
      <Text style={{ color: fg, fontWeight: '700', fontSize: 15 }}>{title}</Text>
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
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: t.sunken,
        borderRadius: radius.md,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: t.line,
        padding: 4,
        gap: 4,
      }}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => {
              tap();
              onChange(o.value);
            }}
            style={{
              flex: 1,
              paddingVertical: 8,
              borderRadius: radius.sm,
              backgroundColor: active ? t.brand : 'transparent',
              alignItems: 'center',
            }}
          >
            <Text style={{ color: active ? t.onBrand : t.dim, fontWeight: '700', fontSize: 13 }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ------------------------------------------------------------------- sheet */

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
  // Sheets hold text inputs, and a Modal does not resize for the keyboard on
  // Android — without this you cannot see what you are typing.
  const kb = useKeyboardHeight();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={{ flex: 1, backgroundColor: '#000000A6' }} onPress={onClose} />
      <View
        style={{
          backgroundColor: t.raised,
          borderTopLeftRadius: radius.xl,
          borderTopRightRadius: radius.xl,
          paddingBottom: (kb > 0 ? kb + space.md : insets.bottom + space.lg),
          maxHeight: maxHeight as never,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderColor: t.line,
        }}
      >
        <View style={{ alignItems: 'center', paddingTop: 10 }}>
          <View style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: t.lineStrong }} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingTop: space.md }}>
          {!!title && <Text style={{ color: t.ink, fontSize: 17, fontWeight: '700', flex: 1 }}>{title}</Text>}
          <Pressable
            onPress={onClose}
            hitSlop={10}
            style={{
              width: 32,
              height: 32,
              borderRadius: radius.sm,
              backgroundColor: t.sunken,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={16} color={t.dim} />
          </Pressable>
        </View>
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

/* ------------------------------------------------------------------ layout */

export function EmptyState({
  icon,
  title,
  body,
}: {
  icon?: React.ReactNode;
  title: string;
  body?: string;
}) {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center', padding: space.xxl, gap: 10 }}>
      {!!icon && (
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: radius.lg,
            backgroundColor: t.sunken,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {icon}
        </View>
      )}
      <Text style={{ color: t.ink, fontSize: 15, fontWeight: '700' }}>{title}</Text>
      {!!body && (
        <Text style={{ color: t.dim, fontSize: 13, textAlign: 'center', lineHeight: 20, maxWidth: 300 }}>{body}</Text>
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
      onPress={
        onPress
          ? () => {
              tap();
              onPress();
            }
          : undefined
      }
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
        <Text style={{ color: danger ? t.down : t.ink, fontSize: 15, fontWeight: '600' }}>{title}</Text>
        {!!subtitle && <Text style={{ color: t.dim, fontSize: 12.5, marginTop: 2, lineHeight: 17 }}>{subtitle}</Text>}
      </View>
      {right}
    </Pressable>
  );
}

export function StatTile({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) {
  const t = useTheme();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: t.surface,
        borderRadius: radius.md,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: t.line,
        padding: 12,
      }}
    >
      <Text style={{ color: t.faint, fontSize: 10, fontWeight: '700', letterSpacing: 0.9, textTransform: 'uppercase' }}>
        {label}
      </Text>
      <View style={{ marginTop: 4 }}>{value}</View>
      {tone ? null : null}
    </View>
  );
}

export function Divider() {
  const t = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: t.line }} />;
}

/** Kept so older screens keep compiling; prefer IconTile from ./icons. */
export function IconBadge({ icon, color, size = 38 }: { icon: React.ReactNode; color: string; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius.md,
        backgroundColor: color + '1f',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {icon}
    </View>
  );
}
