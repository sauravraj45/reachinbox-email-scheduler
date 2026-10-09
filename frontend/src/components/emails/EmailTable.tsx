'use client';

import Link from 'next/link';
import { useStarred } from '@/hooks/useStarred';
import type { Email, EmailTab } from '@/lib/types';
import { cn, formatShort, stripHtml } from '@/lib/format';
import { StarIcon } from '../ui/icons';
import { StatusBadge } from './StatusBadge';

/**
 * Inbox-style rows (as in the design): "To: <email>" · status chip · **subject** - preview · ☆.
 * Scheduled rows: the chip carries the scheduled time. Sent rows: chip says Sent/Failed and
 * the sent time is shown before the star.
 */
export function EmailTable({ emails, tab }: { emails: Email[]; tab: EmailTab }) {
  const { starred, toggle } = useStarred();
  return (
    <ul aria-label={tab === 'scheduled' ? 'Scheduled emails' : 'Sent emails'} className="text-sm">
      {emails.map((e) => {
        const time = tab === 'scheduled' ? e.scheduledAt : (e.sentAt ?? e.scheduledAt);
        const isStarred = starred.has(e.id);
        return (
          <li key={e.id} className="relative border-b border-gray-100 transition-colors hover:bg-gray-50">
            <Link
              href={`/dashboard/emails/${e.id}`}
              className="flex flex-col gap-1.5 py-3.5 pl-6 pr-14 md:flex-row md:items-center md:gap-4"
            >
              <span className="truncate font-medium text-gray-900 md:w-48 md:shrink-0">
                <span>To: </span>
                {e.to}
              </span>
              <span className="flex min-w-0 flex-1 items-center gap-3">
                <StatusBadge email={e} />
                <span className="min-w-0 truncate">
                  <span className="font-medium text-gray-900">{e.subject}</span>
                  <span className="text-gray-400"> - {stripHtml(e.body)}</span>
                </span>
              </span>
              {tab === 'sent' && (
                <time dateTime={time} title={new Date(time).toLocaleString()} className="shrink-0 text-xs text-gray-500">
                  {formatShort(time)}
                </time>
              )}
            </Link>
            <button
              type="button"
              aria-label={isStarred ? 'Unstar' : 'Star'}
              aria-pressed={isStarred}
              onClick={() => toggle(e.id)}
              className={cn('absolute right-4 top-3.5 rounded p-1 md:top-1/2 md:-translate-y-1/2', isStarred ? 'text-amber-400' : 'text-gray-300 hover:text-gray-500')}
            >
              <StarIcon width={16} height={16} fill={isStarred ? 'currentColor' : 'none'} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function EmailTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading emails">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-gray-100 px-6 py-4">
          <div className="h-3.5 w-44 animate-pulse rounded bg-gray-100" />
          <div className="h-5 w-24 animate-pulse rounded-full bg-gray-100" />
          <div className="h-3.5 flex-1 animate-pulse rounded bg-gray-100" />
        </div>
      ))}
    </div>
  );
}
