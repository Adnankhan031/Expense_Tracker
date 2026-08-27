'use client';

import React from 'react';

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}

export function Card({
  children,
  className,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const cls = cx('rounded-2xl border border-line bg-card p-4', onClick && 'active:opacity-75 cursor-pointer', className);
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={cx(cls, 'w-full text-left')}>
        {children}
      </button>
    );
  return <div className={cls}>{children}</div>;
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mt-6 mb-2 flex items-center justify-between">
      <h2 className="text-[11.5px] font-bold uppercase tracking-[0.11em] text-dim">{children}</h2>
      {right}
    </div>
  );
}

export function Money({
  minor,
  fmt,
  className,
  prefix,
}: {
  minor: number;
  fmt: (m: number) => string;
  className?: string;
  prefix?: string;
}) {
  return (
    <span className={cx('tabular font-bold', className)}>
      {prefix}
      {fmt(minor)}
    </span>
  );
}

export function Chip({
  label,
  active,
  onClick,
  color,
  icon,
  small,
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
  color?: string;
  icon?: string;
  small?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={active && color ? { backgroundColor: color + '26', color } : undefined}
      className={cx(
        'inline-flex shrink-0 items-center gap-1 rounded-full border font-semibold transition active:scale-95',
        small ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-[13px]',
        active && !color
          ? 'border-transparent bg-accent-soft text-accent'
          : active
            ? 'border-transparent'
            : 'border-line bg-card-alt text-dim'
      )}
    >
      {icon && <span>{icon}</span>}
      {label}
    </button>
  );
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  className,
  disabled,
  loading,
  type = 'button',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  className?: string;
  disabled?: boolean;
  loading?: boolean;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={cx(
        'w-full rounded-xl px-4 py-3 text-[15px] font-bold transition active:scale-[0.98] disabled:opacity-40',
        variant === 'primary' && 'bg-accent text-on-accent',
        variant === 'ghost' && 'bg-card-alt text-ink',
        variant === 'danger' && 'bg-danger-soft text-danger',
        className
      )}
    >
      {loading ? <Spinner /> : children}
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cx(
        'spin inline-block size-4 rounded-full border-2 border-current border-t-transparent align-[-2px]',
        className
      )}
    />
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
    <div className="flex gap-0.5 rounded-xl bg-card-alt p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cx(
            'flex-1 rounded-lg py-2 text-[13px] font-semibold transition',
            o.value === value ? 'bg-card text-ink shadow-sm' : 'text-dim'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function IconBadge({ icon, color, size = 38 }: { icon: string; color: string; size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-xl"
      style={{ width: size, height: size, backgroundColor: color + '24', fontSize: size * 0.45 }}
    >
      {icon}
    </span>
  );
}

export function EmptyState({ icon, title, body }: { icon: string; title: string; body?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <span className="text-4xl">{icon}</span>
      <h3 className="text-base font-bold">{title}</h3>
      {body && <p className="max-w-xs text-[13.5px] leading-6 text-dim">{body}</p>}
    </div>
  );
}

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
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
      />
      <div className="rise safe-b relative max-h-[88dvh] overflow-y-auto rounded-t-3xl border-t border-line bg-elev">
        <div className="sticky top-0 z-10 bg-elev pt-2.5">
          <div className="mx-auto h-1 w-10 rounded-full bg-line-strong" />
          {title && <h2 className="px-4 pt-3 text-[17px] font-bold">{title}</h2>}
        </div>
        <div className="flex flex-col gap-3 p-4">{children}</div>
      </div>
    </div>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-dim">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  'w-full rounded-xl bg-card-alt px-3.5 py-3 text-[15px] outline-none ring-accent/40 focus:ring-2';

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
      {icon && <span className="shrink-0 text-dim">{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className={cx('block text-[15px] font-semibold', danger && 'text-danger')}>{title}</span>
        {subtitle && <span className="mt-0.5 block text-[12.5px] text-dim">{subtitle}</span>}
      </span>
      {right}
    </>
  );
  if (!onClick) return <div className="flex items-center gap-3 py-3">{inner}</div>;
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 py-3 text-left active:opacity-70">
      {inner}
    </button>
  );
}

export function Divider() {
  return <div className="h-px bg-line" />;
}
