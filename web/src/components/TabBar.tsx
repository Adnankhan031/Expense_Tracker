'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cx } from './ui';

const TABS = [
  { href: '/add', label: 'Add', icon: ChatIcon },
  { href: '/overview', label: 'Overview', icon: PieIcon },
  { href: '/analytics', label: 'Analytics', icon: ChartIcon },
  { href: '/history', label: 'History', icon: CalendarIcon },
  { href: '/settings', label: 'Settings', icon: GearIcon },
];

export function TabBar() {
  const path = usePathname();
  return (
    <nav className="safe-b fixed inset-x-0 bottom-0 z-40 border-t border-line bg-elev/95 backdrop-blur-lg">
      <div className="mx-auto flex max-w-2xl">
        {TABS.map((t) => {
          const active = path === t.href || path.startsWith(t.href + '/');
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cx(
                'flex flex-1 flex-col items-center gap-1 py-2.5 text-[10.5px] font-semibold transition',
                active ? 'text-accent' : 'text-faint'
              )}
            >
              <Icon filled={active} />
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

type IconProps = { filled?: boolean };
const base = (filled?: boolean) => ({
  width: 21,
  height: 21,
  viewBox: '0 0 24 24',
  fill: filled ? 'currentColor' : 'none',
  stroke: 'currentColor',
  strokeWidth: filled ? 0 : 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

function ChatIcon({ filled }: IconProps) {
  return (
    <svg {...base(filled)}>
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}
function PieIcon({ filled }: IconProps) {
  return (
    <svg {...base(filled)}>
      <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
      <path d="M22 12A10 10 0 0 0 12 2v10z" />
    </svg>
  );
}
function ChartIcon({ filled }: IconProps) {
  return (
    <svg {...base(filled)}>
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}
function CalendarIcon({ filled }: IconProps) {
  return (
    <svg {...base(filled)}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
function GearIcon({ filled }: IconProps) {
  return (
    <svg {...base(filled)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
