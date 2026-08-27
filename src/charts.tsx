import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Stop } from 'react-native-svg';
import { radius, useTheme } from './theme';

export type Slice = { value: number; color: string; label: string };

/* ------------------------------------------------------------------ */
/* donut                                                               */
/* ------------------------------------------------------------------ */

export function Donut({
  data,
  size = 172,
  thickness = 22,
  children,
}: {
  data: Slice[];
  size?: number;
  thickness?: number;
  children?: React.ReactNode;
}) {
  const t = useTheme();
  const total = data.reduce((a, b) => a + b.value, 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={t.sunken} strokeWidth={thickness} fill="none" />
          {total > 0 &&
            data.map((d, i) => {
              const frac = d.value / total;
              const len = Math.max(frac * c - 2, 0);
              const el = (
                <Circle
                  key={i}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  stroke={d.color}
                  strokeWidth={thickness}
                  strokeDasharray={`${len} ${c - len}`}
                  strokeDashoffset={-offset}
                  strokeLinecap="butt"
                  fill="none"
                />
              );
              offset += frac * c;
              return el;
            })}
        </G>
      </Svg>
      <View style={{ alignItems: 'center' }}>{children}</View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* progress ring                                                       */
/* ------------------------------------------------------------------ */

export function Ring({
  progress,
  size = 92,
  thickness = 9,
  color,
  track,
  children,
}: {
  progress: number;
  size?: number;
  thickness?: number;
  color?: string;
  track?: string;
  children?: React.ReactNode;
}) {
  const t = useTheme();
  const p = Math.max(0, Math.min(1, progress));
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const stroke = color ?? (p >= 1 ? t.down : p >= 0.8 ? t.warn : t.brand);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={track ?? t.sunken} strokeWidth={thickness} fill="none" />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={stroke}
            strokeWidth={thickness}
            strokeDasharray={`${p * c} ${c}`}
            strokeLinecap="round"
            fill="none"
          />
        </G>
      </Svg>
      <View style={{ alignItems: 'center' }}>{children}</View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* vertical bars                                                       */
/* ------------------------------------------------------------------ */

export type Bar = { label: string; value: number; highlight?: boolean; color?: string };

export function Bars({
  data,
  height = 130,
  color,
  showLabels = true,
  labelEvery = 1,
}: {
  data: Bar[];
  height?: number;
  color?: string;
  showLabels?: boolean;
  labelEvery?: number;
}) {
  const t = useTheme();
  const max = Math.max(1, ...data.map((d) => d.value));
  const accent = color ?? t.brand;
  return (
    <View>
      <View style={{ height, flexDirection: 'row', alignItems: 'flex-end', gap: data.length > 20 ? 2 : 4 }}>
        {data.map((d, i) => {
          const h = Math.max(d.value > 0 ? 3 : 1, (d.value / max) * height);
          return (
            <View
              key={i}
              style={{
                flex: 1,
                height: h,
                borderRadius: 3,
                backgroundColor: d.color ?? accent,
                opacity: d.value === 0 ? 0.16 : d.highlight ? 1 : 0.55,
              }}
            />
          );
        })}
      </View>
      {showLabels && (
        <View style={{ flexDirection: 'row', marginTop: 6, gap: data.length > 20 ? 2 : 4 }}>
          {data.map((d, i) => (
            <View key={i} style={{ flex: 1, alignItems: 'center' }}>
              <Text
                numberOfLines={1}
                style={{ color: d.highlight ? t.ink : t.faint, fontSize: 9, fontWeight: d.highlight ? '700' : '500' }}
              >
                {i % labelEvery === 0 ? d.label : ''}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* trend line with area fill                                           */
/* ------------------------------------------------------------------ */

export function TrendLine({
  values,
  labels,
  height = 150,
  color,
}: {
  values: number[];
  labels?: string[];
  height?: number;
  color?: string;
}) {
  const t = useTheme();
  const [w, setW] = React.useState(0);
  const accent = color ?? t.brand;
  const max = Math.max(1, ...values);
  const min = 0;
  const pad = 6;

  const pts = values.map((v, i) => {
    const x = values.length === 1 ? w / 2 : (i / (values.length - 1)) * (w - pad * 2) + pad;
    const y = height - pad - ((v - min) / (max - min || 1)) * (height - pad * 2);
    return { x, y };
  });

  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const areaPath = pts.length
    ? `${linePath} L${pts[pts.length - 1].x.toFixed(1)},${height} L${pts[0].x.toFixed(1)},${height} Z`
    : '';

  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w > 0 && (
        <Svg width={w} height={height}>
          <Defs>
            <LinearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={accent} stopOpacity="0.32" />
              <Stop offset="1" stopColor={accent} stopOpacity="0.02" />
            </LinearGradient>
          </Defs>
          {[0.25, 0.5, 0.75].map((g) => (
            <Line key={g} x1={0} x2={w} y1={height * g} y2={height * g} stroke={t.line} strokeWidth={1} />
          ))}
          {!!areaPath && <Path d={areaPath} fill="url(#areaFill)" />}
          {!!linePath && <Path d={linePath} stroke={accent} strokeWidth={2.5} fill="none" strokeLinejoin="round" />}
          {pts.map((p, i) => (
            <Circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={i === pts.length - 1 ? 4.5 : 2.5}
              fill={i === pts.length - 1 ? accent : t.bg}
              stroke={accent}
              strokeWidth={i === pts.length - 1 ? 0 : 2}
            />
          ))}
        </Svg>
      )}
      {!!labels && (
        <View style={{ flexDirection: 'row', marginTop: 4 }}>
          {labels.map((l, i) => (
            <View key={i} style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ color: t.faint, fontSize: 9.5 }}>{l}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* grouped income vs expense bars                                      */
/* ------------------------------------------------------------------ */

export function GroupedBars({
  data,
  height = 140,
}: {
  data: { label: string; expense: number; income: number }[];
  height?: number;
}) {
  const t = useTheme();
  const max = Math.max(1, ...data.flatMap((d) => [d.expense, d.income]));
  return (
    <View>
      <View style={{ height, flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
        {data.map((d, i) => (
          <View key={i} style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 2, height }}>
            <View
              style={{
                flex: 1,
                height: Math.max(2, (d.expense / max) * height),
                backgroundColor: t.down,
                opacity: 0.85,
                borderRadius: 3,
              }}
            />
            <View
              style={{
                flex: 1,
                height: Math.max(2, (d.income / max) * height),
                backgroundColor: t.up,
                opacity: 0.85,
                borderRadius: 3,
              }}
            />
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', marginTop: 6, gap: 8 }}>
        {data.map((d, i) => (
          <View key={i} style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ color: t.faint, fontSize: 9.5 }}>{d.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* horizontal bar list                                                 */
/* ------------------------------------------------------------------ */

export function HBar({ fraction, color, height = 7 }: { fraction: number; color: string; height?: number }) {
  const t = useTheme();
  return (
    <View style={{ height, backgroundColor: t.sunken, borderRadius: height / 2, overflow: 'hidden' }}>
      <View
        style={{
          width: `${Math.max(2, Math.min(100, fraction * 100))}%`,
          height: '100%',
          backgroundColor: color,
          borderRadius: height / 2,
        }}
      />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* calendar heat grid                                                  */
/* ------------------------------------------------------------------ */

export function HeatGrid({
  cells,
  onPress,
  selected,
}: {
  cells: { date: string; day: number; value: number; muted?: boolean }[];
  onPress?: (date: string) => void;
  selected?: string | null;
}) {
  const t = useTheme();
  const max = Math.max(1, ...cells.map((c) => c.value));
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {cells.map((c, i) => {
        const intensity = c.value > 0 ? 0.18 + (c.value / max) * 0.82 : 0;
        const isSel = selected === c.date;
        return (
          <View key={i} style={{ width: `${100 / 7}%`, aspectRatio: 1, padding: 2.5 }}>
            <Pressable
              disabled={!onPress || c.muted}
              onPress={onPress && !c.muted ? () => onPress(c.date) : undefined}
              style={{
                flex: 1,
                borderRadius: radius.sm,
                backgroundColor: c.muted ? 'transparent' : intensity > 0 ? t.brand : t.sunken,
                opacity: c.muted ? 0.25 : intensity > 0 ? intensity : 1,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: isSel ? 2 : 0,
                borderColor: t.ink,
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '700',
                  color: intensity > 0.55 ? t.onBrand : c.muted ? t.faint : t.dim,
                }}
              >
                {c.day || ''}
              </Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

export function Sparkline({ values, width = 62, height = 24, color }: { values: number[]; width?: number; height?: number; color?: string }) {
  const t = useTheme();
  const accent = color ?? t.brand;
  const max = Math.max(1, ...values);
  if (!values.length) return <View style={{ width, height }} />;
  const step = values.length > 1 ? width / (values.length - 1) : width;
  const d = values
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${(height - (v / max) * height).toFixed(1)}`)
    .join(' ');
  return (
    <Svg width={width} height={height}>
      <Path d={d} stroke={accent} strokeWidth={1.8} fill="none" strokeLinejoin="round" />
    </Svg>
  );
}

export function BarLegendDot({ color }: { color: string }) {
  return <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: color }} />;
}
