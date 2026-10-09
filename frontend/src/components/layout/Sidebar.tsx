'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ComponentType, SVGProps } from 'react';
import { useDashboard } from '@/hooks/useDashboard';
import { cn } from '@/lib/format';
import { ClockIcon, SendIcon } from '../ui/icons';
import { Logo } from '../ui/Logo';
import { SlackConnect } from './SlackConnect';
import { UserMenu } from './UserMenu';

interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  count?: number;
}

export function Sidebar() {
  const pathname = usePathname();
  const { stats } = useDashboard();

  const items: NavItem[] = [
    { href: '/dashboard/scheduled', label: 'Scheduled', icon: ClockIcon, count: stats?.scheduled },
    { href: '/dashboard/sent', label: 'Sent', icon: SendIcon, count: stats ? stats.sent + stats.failed : undefined },
  ];

  return (
    <aside className="hidden w-[260px] shrink-0 flex-col border-r border-gray-100 bg-white px-4 py-5 md:flex">
      <div className="px-2 pb-6 text-gray-900">
        <Logo className="h-[22px] w-auto" />
      </div>

      <UserMenu />

      <Link
        href="/dashboard/compose"
        className="mt-4 flex h-10 w-full items-center justify-center rounded-full border border-brand-600 bg-white text-sm font-medium text-brand-700 transition-colors hover:bg-brand-50"
      >
        Compose
      </Link>

      <nav className="mt-6 flex flex-col gap-1">
        <p className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wide text-gray-400">Core</p>
        {items.map(({ href, label, icon: Icon, count }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                active ? 'bg-brand-50 font-medium text-gray-900' : 'text-gray-700 hover:bg-gray-50',
              )}
            >
              <Icon width={16} height={16} className={active ? 'text-gray-900' : 'text-gray-600'} />
              <span className="flex-1">{label}</span>
              {count !== undefined && <span className="text-xs text-gray-400">{count}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto pt-4">
        <SlackConnect />
      </div>
    </aside>
  );
}
