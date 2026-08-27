'use client';

import React from 'react';

export type Slice = { value: number; color: string; label: string };

/* ------------------------------------------------------------------- donut */

export function Donut({
  data,
  size = 176,
  thickness = 18,
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
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--color-sunken)" strokeWidth={thickness} fill="none" />
        {total > 0 &&
          data.map((d, i) => {
            const frac = d.value / total;
            const len = Math.max(frac * c - 3, 0);
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
                strokeLinecap="round"
                fill="none"
              />
            );
            offset += frac * c;
            return el;
          })}
      </svg>
      <div className="relative flex flex-col items-center leading-tight">{children}</div>
    </div>
  );
}

/* -------------------------------------------------------------------- ring */

export function Ring({
  progress,
  size = 84,
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
  const stroke = p >= 1 ? 'var(--color-down)' : p >= 0.8 ? 'var(--color-warn)' : 'var(--color-up)';
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0 -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--color-sunken)" strokeWidth={thickness} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={stroke}
          strokeWidth={thickness}
          strokeDasharray={`${p * c} ${c}`}
          strokeLinecap="round"
          fill="none"
          style={{ transition: 'stroke-dasharray 0.6s cubic-bezier(0.2,0.85,0.3,1)' }}
        />
      </svg>
      <div className="relative flex flex-col items-center leading-tight">{children}</div>
    </div>
  );
}

/* -------------------------------------------------------------------- bars */

export type Bar = { label: string; value: number; highlight?: boolean; color?: string };

export function Bars({
  data,
  height = 112,
  labelEvery = 1,
  showLabels = true,
  color,
  onPick,
}: {
  data: Bar[];
  height?: number;
  labelEvery?: number;
  showLabels?: boolean;
  color?: string;
  onPick?: (index: number) => void;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const gap = data.length > 20 ? 2 : data.length > 12 ? 3 : 5;
  return (
    <div>
      <div className="flex items-end" style={{ height, gap }}>
        {data.map((d, i) => (
          <button
            key={i}
            type="button"
            disabled={!onPick}
            onClick={() => onPick?.(i)}
            title={d.label}
            className="grow-bar flex-1 rounded-[4px] transition-opacity"
            style={{
              height: Math.max(d.value > 0 ? 4 : 2, (d.value / max) * height),
              background: d.color ?? color ?? 'var(--color-brand)',
              opacity: d.value === 0 ? 0.14 : d.highlight ? 1 : 0.48,
              animationDelay: `${Math.min(i * 12, 260)}ms`,
            }}
          />
        ))}
      </div>
      {showLabels && (
        <div className="mt-2 flex" style={{ gap }}>
          {data.map((d, i) => (
            <div key={i} className="min-w-0 flex-1 text-center">
              <span className={d.highlight ? 'text-[9.5px] font-bold text-ink' : 'text-[9.5px] text-faint'}>
                {i % labelEvery === 0 ? d.label : ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- trend line */

export function TrendLine({
  values,
  labels,
  height = 146,
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
  const pad = 8;
  const pts = values.map((v, i) => ({
    x: values.length === 1 ? w / 2 : (i / (values.length - 1)) * (w - pad * 2) + pad,
    y: height - pad - (v / max) * (height - pad * 2),
  }));

  // Catmull-Rom style smoothing keeps the line readable without hiding spikes.
  const line = pts.reduce((d, p, i, arr) => {
    if (i === 0) return `M${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    const prev = arr[i - 1];
    const cx = (prev.x + p.x) / 2;
    return `${d} C${cx.toFixed(1)},${prev.y.toFixed(1)} ${cx.toFixed(1)},${p.y.toFixed(1)} ${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  }, '');
  const area = pts.length ? `${line} L${pts[pts.length - 1].x.toFixed(1)},${height} L${pts[0].x.toFixed(1)},${height} Z` : '';

  return (
    <div ref={ref}>
      {w > 0 && (
        <svg width={w} height={height}>
          <defs>
            <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--color-brand)" stopOpacity="0.34" />
              <stop offset="1" stopColor="var(--color-brand)" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map((g) => (
            <line
              key={g}
              x1={0}
              x2={w}
              y1={height * g}
              y2={height * g}
              stroke="var(--color-line-soft)"
              strokeWidth={1}
            />
          ))}
          {area && <path d={area} fill="url(#trendFill)" />}
          {line && (
            <path d={line} stroke="var(--color-brand)" strokeWidth={2.5} fill="none" strokeLinecap="round" />
          )}
          {pts.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={i === pts.length - 1 ? 4.5 : 2.5}
              fill={i === pts.length - 1 ? 'var(--color-brand)' : 'var(--color-bg)'}
              stroke="var(--color-brand)"
              strokeWidth={i === pts.length - 1 ? 0 : 2}
            />
          ))}
        </svg>
      )}
      {labels && (
        <div className="mt-1.5 flex">
          {labels.map((l, i) => (
            <div key={i} className="min-w-0 flex-1 text-center text-[9.5px] text-faint">
              {l}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ paired bars */

export function GroupedBars({
  data,
  height = 132,
}: {
  data: { label: string; expense: number; income: number }[];
  height?: number;
}) {
  const max = Math.max(1, ...data.flatMap((d) => [d.expense, d.income]));
  return (
    <div>
      <div className="flex items-end gap-2.5" style={{ height }}>
        {data.map((d, i) => (
          <div key={i} className="flex min-w-0 flex-1 items-end gap-1" style={{ height }}>
            <div
              className="grow-bar flex-1 rounded-[4px] bg-down"
              style={{ height: Math.max(3, (d.expense / max) * height), animationDelay: `${i * 30}ms` }}
            />
            <div
              className="grow-bar flex-1 rounded-[4px] bg-up"
              style={{ height: Math.max(3, (d.income / max) * height), animationDelay: `${i * 30 + 60}ms` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2.5">
        {data.map((d, i) => (
          <div key={i} className="min-w-0 flex-1 text-center text-[9.5px] text-faint">
            {d.label}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- horizontal bar */

export function HBar({ fraction, color, height = 6 }: { fraction: number; color: string; height?: number }) {
  return (
    <div className="overflow-hidden rounded-full bg-sunken" style={{ height }}>
      <div
        className="h-full rounded-full transition-[width] duration-700 ease-out"
        style={{ width: `${Math.max(2, Math.min(100, fraction * 100))}%`, background: color }}
      />
    </div>
  );
}

/* -------------------------------------------------------------- heat grid */

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
    <div className="grid grid-cols-7 gap-1.5">
      {cells.map((c, i) => {
        if (c.muted) return <div key={i} className="aspect-square" />;
        const t = c.value > 0 ? 0.22 + (c.value / max) * 0.78 : 0;
        const isSel = selected === c.date;
        return (
          <button
            key={i}
            type="button"
            onClick={() => onPick?.(c.date)}
            className="grid aspect-square place-items-center rounded-[10px] text-[11px] font-bold transition active:scale-90"
            style={{
              background: t > 0 ? `color-mix(in oklab, var(--color-brand) ${Math.round(t * 100)}%, var(--color-sunken))` : 'var(--color-sunken)',
              color: t > 0.55 ? 'var(--color-on-brand)' : t > 0 ? 'var(--color-ink)' : 'var(--color-faint)',
              outline: isSel ? '2px solid var(--color-ink)' : undefined,
              outlineOffset: isSel ? '1px' : undefined,
            }}
          >
            {c.day}
          </button>
        );
      })}
    </div>
  );
}

export function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11.5px] text-dim">
      <span className="size-2.5 rounded-[3px]" style={{ background: color }} />
      {label}
    </span>
  );
}
