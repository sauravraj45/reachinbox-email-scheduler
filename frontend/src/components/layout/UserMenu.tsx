'use client';

import { useRef, useState } from 'react';
import { useDashboard } from '@/hooks/useDashboard';
import { useDismiss } from '@/hooks/useDismiss';
import { cn } from '@/lib/format';
import { Avatar } from '../ui/Avatar';
import { ChevronDownIcon, LogoutIcon } from '../ui/icons';

/** User card (avatar, name, email) with a dropdown containing Logout. */
export function UserMenu({ compact = false }: { compact?: boolean }) {
  const { user, logout } = useDashboard();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useDismiss(ref, open, () => setOpen(false));

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          'flex w-full items-center gap-2.5 rounded-lg text-left transition-colors',
          compact ? 'p-1' : 'bg-gray-100/80 px-3 py-2.5 hover:bg-gray-100',
        )}
      >
        <Avatar name={user.name} src={user.avatarUrl} className="h-8 w-8 shrink-0" />
        {!compact && (
          <>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-sm font-medium text-gray-900">{user.name}</span>
              <span className="block truncate text-[11px] text-gray-500">{user.email}</span>
            </span>
            <ChevronDownIcon width={16} height={16} className={cn('shrink-0 text-gray-400 transition-transform', open && 'rotate-180')} />
          </>
        )}
      </button>

      {open && (
        <div role="menu" className={cn('absolute z-30 mt-1 w-56 rounded-lg border border-gray-100 bg-white py-1 shadow-lg', compact ? 'right-0' : 'left-0 right-0 w-auto')}>
          {compact && (
            <div className="border-b border-gray-100 px-3 py-2 leading-tight">
              <p className="truncate text-sm font-semibold text-gray-900">{user.name}</p>
              <p className="truncate text-xs text-gray-500">{user.email}</p>
            </div>
          )}
          <button
            role="menuitem"
            onClick={() => void logout()}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <LogoutIcon width={16} height={16} />
            Logout
          </button>
        </div>
      )}
    </div>
  );
}
