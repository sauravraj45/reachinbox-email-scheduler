'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useDashboard } from '@/hooks/useDashboard';
import { cn } from '@/lib/format';
import { PenIcon } from '../ui/icons';
import { Logo } from '../ui/Logo';
import { UserMenu } from './UserMenu';

/** Mobile-only top bar (the sidebar holds these controls on md+). */
export function MobileHeader() {
  const pathname = usePathname();
  const { stats } = useDashboard();
  const tabs = [
    { href: '/dashboard/scheduled', label: 'Scheduled', count: stats?.scheduled },
    { href: '/dashboard/sent', label: 'Sent', count: stats ? stats.sent + stats.failed : undefined },
  ];
  return (
    <header className="border-b border-gray-100 md:hidden">
      <div className="flex h-14 items-center gap-3 px-4">
        <Logo className="h-5 w-auto text-gray-900" />
        <div className="flex-1" />
        <Link href="/dashboard/compose" aria-label="Compose" className="rounded-full border border-brand-600 p-2 text-brand-700">
          <PenIcon width={16} height={16} />
        </Link>
        <UserMenu compact />
      </div>
      <nav className="flex gap-1 px-3 pb-2">
        {tabs.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={cn('rounded-full px-3 py-1 text-sm', pathname.startsWith(t.href) ? 'bg-brand-50 font-semibold text-gray-900' : 'text-gray-500')}
          >
            {t.label} {t.count !== undefined && <span className="text-xs text-gray-500">{t.count}</span>}
          </Link>
        ))}
      </nav>
    </header>
  );
}
