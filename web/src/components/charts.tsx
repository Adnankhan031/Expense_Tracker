'use client';

import React from 'react';

export type Slice = { value: number; color: string; label: string };

export function Donut({
  data,
  size = 168,
  thickness = 20,
  children,
}: {
  data: Slice[];
  size?: number;
  thickness?: number;
  children?: React.ReactNode;
}) {
  const total = data.reduce((a, b) => a + b.value, 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0 -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="var(--color-card-alt)"
          strokeWidth={thickness}
          fill="none"
        />
        {total > 0 &&
          data.map((d, i) => {
            const frac = d.value / total;
            const len = Math.max(frac * c - 2, 0);
            const el = (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={r}
                stroke={d.color}
                strokeWidth={thickness}
                strokeDasharray={`${len} ${c - len}`}
                strokeDashoffset={-offset}
                fill="none"
              />
            );
            offset += frac * c;
            return el;
          })}
      </svg>
      <div className="relative flex flex-col items-center">{children}</div>
    </div>
  );
}

export function Ring({
  progress,
  size = 82,
  thickness = 8,
  children,
}: {
  progress: number;
  size?: number;
  thickness?: number;
  children?: React.ReactNode;
}) {
  const p = Math.max(0, Math.min(1, progress));
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const stroke = p >= 1 ? 'var(--color-danger)' : p >= 0.8 ? 'var(--color-warn)' : 'var(--color-accent)';
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0 -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--color-card-alt)" strokeWidth={thickness} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={stroke}
          strokeWidth={thickness}
          strokeDasharray={`${p * c} ${c}`}
          strokeLinecap="round"
          fill="none"
        />
      </svg>
      <div className="relative flex flex-col items-center leading-tight">{children}</div>
    </div>
  );
}

export type Bar = { label: string; value: number; highlight?: boolean; color?: string };

export function Bars({
  data,
  height = 110,
  labelEvery = 1,
  showLabels = true,
  color,
}: {
  data: Bar[];
  height?: number;
  labelEvery?: number;
  showLabels?: boolean;
  color?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const gap = data.length > 20 ? 2 : 4;
  return (
    <div>
      <div className="flex items-end" style={{ height, gap }}>
        {data.map((d, i) => (
          <div
            key={i}
            className="flex-1 rounded-[3px]"
            style={{
              height: Math.max(d.value > 0 ? 3 : 1, (d.value / max) * height),
              background: d.color ?? color ?? 'var(--color-accent)',
              opacity: d.value === 0 ? 0.16 : d.highlight ? 1 : 0.55,
            }}
          />
        ))}
      </div>
      {showLabels && (
        <div className="mt-1.5 flex" style={{ gap }}>
          {data.map((d, i) => (
            <div key={i} className="flex-1 text-center">
              <span
                className={d.highlight ? 'text-[9px] font-bold text-ink' : 'text-[9px] font-medium text-faint'}
              >
                {i % labelEvery === 0 ? d.label : ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function TrendLine({
  values,
  labels,
  height = 140,
}: {
  values: number[];
  labels?: string[];
  height?: number;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [w, setW] = React.useState(0);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const max = Math.max(1, ...values);
  const pad = 6;
  const pts = values.map((v, i) => ({
    x: values.length === 1 ? w / 2 : (i / (values.length - 1)) * (w - pad * 2) + pad,
    y: height - pad - (v / max) * (height - pad * 2),
  }));
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = pts.length
    ? `${line} L${pts[pts.length - 1].x.toFixed(1)},${height} L${pts[0].x.toFixed(1)},${height} Z`
    : '';

  return (
    <div ref={ref}>
      {w > 0 && (
        <svg width={w} height={height}>
          <defs>
            <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--color-accent)" stopOpacity="0.32" />
              <stop offset="1" stopColor="var(--color-accent)" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map((g) => (
            <line key={g} x1={0} x2={w} y1={height * g} y2={height * g} stroke="var(--color-line)" strokeWidth={1} />
          ))}
          {area && <path d={area} fill="url(#trendFill)" />}
          {line && <path d={line} stroke="var(--color-accent)" strokeWidth={2.5} fill="none" strokeLinejoin="round" />}
          {pts.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={i === pts.length - 1 ? 4.5 : 2.5}
              fill={i === pts.length - 1 ? 'var(--color-accent)' : 'var(--color-bg)'}
              stroke="var(--color-accent)"
              strokeWidth={i === pts.length - 1 ? 0 : 2}
            />
          ))}
        </svg>
      )}
      {labels && (
        <div className="mt-1 flex">
          {labels.map((l, i) => (
            <div key={i} className="flex-1 text-center text-[9.5px] text-faint">
              {l}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function GroupedBars({
  data,
  height = 130,
}: {
  data: { label: string; expense: number; income: number }[];
  height?: number;
}) {
  const max = Math.max(1, ...data.flatMap((d) => [d.expense, d.income]));
  return (
    <div>
      <div className="flex items-end gap-2" style={{ height }}>
        {data.map((d, i) => (
          <div key={i} className="flex flex-1 items-end gap-0.5" style={{ height }}>
            <div
              className="flex-1 rounded-[3px] bg-danger opacity-85"
              style={{ height: Math.max(2, (d.expense / max) * height) }}
            />
            <div
              className="flex-1 rounded-[3px] bg-accent opacity-85"
              style={{ height: Math.max(2, (d.income / max) * height) }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-2">
        {data.map((d, i) => (
          <div key={i} className="flex-1 text-center text-[9.5px] text-faint">
            {d.label}
          </div>
        ))}
      </div>
    </div>
  );
}

export function HBar({ fraction, color, height = 7 }: { fraction: number; color: string; height?: number }) {
  return (
    <div className="overflow-hidden rounded-full bg-card-alt" style={{ height }}>
      <div
        className="h-full rounded-full transition-[width] duration-500"
        style={{ width: `${Math.max(2, Math.min(100, fraction * 100))}%`, background: color }}
      />
    </div>
  );
}

export function HeatGrid({
  cells,
  selected,
  onPick,
}: {
  cells: { date: string; day: number; value: number; muted?: boolean }[];
  selected?: string | null;
  onPick?: (date: string) => void;
}) {
  const max = Math.max(1, ...cells.map((c) => c.value));
  return (
    <div className="grid grid-cols-7 gap-1">
      {cells.map((c, i) => {
        const intensity = c.value > 0 ? 0.18 + (c.value / max) * 0.82 : 0;
        const isSel = selected === c.date;
        if (c.muted) return <div key={i} className="aspect-square" />;
        return (
          <button
            key={i}
            type="button"
            onClick={() => onPick?.(c.date)}
            className="grid aspect-square place-items-center rounded-lg text-[11px] font-bold transition active:scale-95"
            style={{
              background: intensity > 0 ? 'var(--color-accent)' : 'var(--color-card-alt)',
              opacity: intensity > 0 ? intensity : 1,
              color: intensity > 0.55 ? 'var(--color-on-accent)' : 'var(--color-dim)',
              outline: isSel ? '2px solid var(--color-ink)' : undefined,
            }}
          >
            {c.day}
          </button>
        );
      })}
    </div>
  );
}
