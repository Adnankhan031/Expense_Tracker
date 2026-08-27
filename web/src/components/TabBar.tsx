'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarDays, ChartNoAxesCombined, MessageSquareText, PieChart, Settings } from 'lucide-react';
import { cx } from './ui';

const TABS = [
  { href: '/add', label: 'Add', Icon: MessageSquareText },
  { href: '/overview', label: 'Overview', Icon: PieChart },
  { href: '/analytics', label: 'Analytics', Icon: ChartNoAxesCombined },
  { href: '/history', label: 'History', Icon: CalendarDays },
  { href: '/settings', label: 'Settings', Icon: Settings },
];

export function TabBar() {
  const path = usePathname();
  return (
    <nav className="safe-b fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-2xl">
        {TABS.map(({ href, label, Icon }) => {
          const active = path === href || path.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className="relative flex flex-1 flex-col items-center gap-1 py-2.5 transition active:scale-95"
            >
              {active && <span className="absolute inset-x-[30%] top-0 h-0.5 rounded-full bg-brand" />}
              <Icon size={20} strokeWidth={active ? 2.4 : 1.9} className={active ? 'text-brand' : 'text-faint'} />
              <span className={cx('text-[10px] font-bold', active ? 'text-brand' : 'text-faint')}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
