'use client';

import React from 'react';
import { Loader2, X } from 'lucide-react';

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}

/* ---------------------------------------------------------------- surfaces */

export function Card({
  children,
  className,
  onClick,
  tone = 'plain',
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  tone?: 'plain' | 'brand';
}) {
  const cls = cx(
    'rounded-2xl border border-line p-4 shadow-[var(--shadow-card)]',
    tone === 'brand' ? 'brand-wash' : 'bg-surface',
    onClick && 'text-left transition active:scale-[0.995] active:opacity-90',
    className
  );
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={cx(cls, 'w-full')}>
        {children}
      </button>
    );
  return <div className={cls}>{children}</div>;
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mt-7 mb-2.5 flex items-end justify-between gap-3">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.13em] text-faint">{children}</h2>
      {right}
    </div>
  );
}

export function PageTitle({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <header className="flex items-end gap-3 pt-5 pb-1">
      <div className="min-w-0 flex-1">
        <h1 className="text-[28px] font-extrabold leading-none tracking-[-0.03em]">{title}</h1>
        {subtitle && <p className="mt-1.5 text-[13px] text-dim">{subtitle}</p>}
      </div>
      {right}
    </header>
  );
}

/* ------------------------------------------------------------------ inputs */

export const inputClass =
  'w-full rounded-xl border border-line bg-sunken px-3.5 py-3 text-[15px] outline-none transition placeholder:text-faint focus:border-brand/60 focus:bg-surface';

export function Button({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  className,
  disabled,
  loading,
  type = 'button',
  icon: Icon,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'ghost' | 'outline' | 'danger';
  size?: 'md' | 'sm';
  className?: string;
  disabled?: boolean;
  loading?: boolean;
  type?: 'button' | 'submit';
  icon?: React.ComponentType<{ size?: number; className?: string }>;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={cx(
        'inline-flex w-full items-center justify-center gap-2 rounded-xl font-bold transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40',
        size === 'md' ? 'px-4 py-3 text-[15px]' : 'px-3 py-2 text-[13.5px]',
        variant === 'primary' && 'bg-brand text-on-brand',
        variant === 'ghost' && 'bg-sunken text-ink',
        variant === 'outline' && 'border border-line-strong text-ink',
        variant === 'danger' && 'bg-down-soft text-down',
        className
      )}
    >
      {loading ? <Loader2 size={16} className="spin" /> : Icon ? <Icon size={16} /> : null}
      {children}
    </button>
  );
}

export function Chip({
  label,
  active,
  onClick,
  color,
  icon: Icon,
  small,
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
  color?: string;
  icon?: React.ComponentType<{ size?: number }>;
  small?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={active && color ? { backgroundColor: color + '24', color, borderColor: 'transparent' } : undefined}
      className={cx(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border font-semibold transition active:scale-95',
        small ? 'px-2.5 py-1 text-[11.5px]' : 'px-3 py-1.5 text-[13px]',
        active && !color
          ? 'border-transparent bg-brand text-on-brand'
          : active
            ? ''
            : 'border-line bg-sunken text-dim hover:text-ink'
      )}
    >
      {Icon && <Icon size={small ? 12 : 14} />}
      {label}
    </button>
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
  return (
    <div className="flex gap-1 rounded-xl border border-line bg-sunken p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cx(
            'flex-1 rounded-lg py-2 text-[13px] font-bold transition',
            o.value === value ? 'bg-brand text-on-brand shadow-sm' : 'text-dim hover:text-ink'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Spinner({ size = 18, className }: { size?: number; className?: string }) {
  return <Loader2 size={size} className={cx('spin', className)} />;
}

/* ------------------------------------------------------------------ layout */

export function Row({
  icon,
  title,
  subtitle,
  right,
  onClick,
  danger,
}: {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
}) {
  const inner = (
    <>
      {icon && <span className={cx('shrink-0', danger ? 'text-down' : 'text-dim')}>{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className={cx('block text-[15px] font-semibold', danger && 'text-down')}>{title}</span>
        {subtitle && <span className="mt-0.5 block text-[12.5px] leading-snug text-dim">{subtitle}</span>}
      </span>
      {right}
    </>
  );
  if (!onClick) return <div className="flex items-center gap-3 py-3">{inner}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 py-3 text-left transition active:opacity-65"
    >
      {inner}
    </button>
  );
}

export function Divider() {
  return <div className="h-px bg-line" />;
}

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2.5 px-6 py-12 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-sunken text-dim">
        <Icon size={22} />
      </span>
      <h3 className="text-[15px] font-bold">{title}</h3>
      {body && <p className="max-w-xs text-[13px] leading-6 text-dim">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------- sheet */

export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end sm:items-center sm:justify-center">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/65 backdrop-blur-[3px]"
      />
      <div
        className={cx(
          'sheet-in safe-b relative max-h-[88dvh] w-full overflow-y-auto border-line bg-raised shadow-[var(--shadow-pop)]',
          'rounded-t-3xl border-t sm:max-w-md sm:rounded-3xl sm:border'
        )}
      >
        <div className="sticky top-0 z-10 flex items-center gap-2 bg-raised px-4 pt-3 pb-2">
          <div className="absolute inset-x-0 top-2 mx-auto h-1 w-10 rounded-full bg-line-strong sm:hidden" />
          {title && <h2 className="flex-1 pt-3 text-[17px] font-bold sm:pt-0">{title}</h2>}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="mt-3 grid size-8 shrink-0 place-items-center rounded-lg bg-sunken text-dim transition active:scale-95 sm:mt-0"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex flex-col gap-3 px-4 pt-1 pb-4">{children}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- stats */

export function StatTile({
  label,
  value,
  tone,
  sub,
}: {
  label: string;
  value: string;
  tone?: 'up' | 'down' | 'brand';
  sub?: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-line bg-surface p-3">
      <p className="truncate text-[10px] font-bold uppercase tracking-[0.1em] text-faint">{label}</p>
      <p
        className={cx(
          'tabular mt-1 truncate text-[17px] font-extrabold',
          tone === 'up' && 'text-up',
          tone === 'down' && 'text-down',
          tone === 'brand' && 'text-brand'
        )}
      >
        {value}
      </p>
      {sub && <p className="mt-0.5 truncate text-[10.5px] text-faint">{sub}</p>}
    </div>
  );
}

export function Delta({ pct }: { pct: number }) {
  const up = pct > 0;
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-bold',
        up ? 'bg-down-soft text-down' : 'bg-up-soft text-up'
      )}
    >
      {up ? '▲' : '▼'} {Math.abs(Math.round(pct))}%
    </span>
  );
}
