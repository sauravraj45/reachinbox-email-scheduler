'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useApi } from '@/hooks/useApi';
import { useDashboard } from '@/hooks/useDashboard';
import { api } from '@/lib/api';
import type { EmailStatus, EmailTab } from '@/lib/types';
import { Button } from '../ui/Button';
import { EmptyState, ErrorState } from '../ui/EmptyState';
import { ChevronLeftIcon, ChevronRightIcon, ClockIcon, RefreshIcon, SearchIcon, SendIcon } from '../ui/icons';
import { EmailTable, EmailTableSkeleton } from './EmailTable';
import { FilterMenu } from './FilterMenu';

const PAGE_SIZE = 20;

const copy: Record<EmailTab, { empty: string; emptyDesc: string; icon: typeof ClockIcon }> = {
  scheduled: {
    empty: 'No scheduled emails',
    emptyDesc: 'Emails you schedule will show up here until they are sent.',
    icon: ClockIcon,
  },
  sent: {
    empty: 'No sent emails yet',
    emptyDesc: 'Once scheduled emails go out (or fail), they will be listed here.',
    icon: SendIcon,
  },
};

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function EmailListView({ tab }: { tab: EmailTab }) {
  const { refreshStats } = useDashboard();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<EmailStatus | null>(null);
  const q = useDebounced(search.trim(), 300);

  useEffect(() => setPage(1), [q, status]);

  // Poll so statuses move from Scheduled -> Sent live while the worker runs.
  const list = useApi(() => api.emails({ tab, page, pageSize: PAGE_SIZE, q: q || undefined, status: status ?? undefined }), [tab, page, q, status], { pollMs: 5000 });

  const total = list.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);
  const { icon: Icon, empty, emptyDesc } = copy[tab];

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center gap-1 px-6 pb-2 pt-4">
        <label className="flex h-9 w-full max-w-xl items-center gap-2 rounded-md bg-gray-100 px-3 text-gray-400 focus-within:ring-2 focus-within:ring-brand-100">
          <SearchIcon width={16} height={16} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search"
            className="w-full bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
            aria-label="Search emails"
          />
        </label>
        <span className="w-1" />
        <FilterMenu tab={tab} value={status} onChange={setStatus} />
        <button
          type="button"
          aria-label="Refresh"
          onClick={() => void Promise.all([list.reload(), refreshStats()])}
          className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
        >
          <RefreshIcon width={16} height={16} />
        </button>
      </div>

      {q && list.data?.searchEngine && (
        <p className="px-6 pt-2 text-xs text-gray-400">
          {total} result{total === 1 ? '' : 's'} via {list.data.searchEngine === 'elasticsearch' ? 'Elasticsearch' : 'database fallback'}
        </p>
      )}

      {list.error && !list.data ? (
        <ErrorState message={list.error} onRetry={() => void list.reload()} />
      ) : list.loading && !list.data ? (
        <EmailTableSkeleton />
      ) : list.data && list.data.items.length > 0 ? (
        <>
          <EmailTable emails={list.data.items} tab={tab} />
          <div className="flex items-center justify-end gap-3 px-6 py-3 text-xs text-gray-500">
            <span>
              {from}–{to} of {total}
            </span>
            <Button variant="ghost" size="sm" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeftIcon width={16} height={16} />
            </Button>
            <Button variant="ghost" size="sm" aria-label="Next page" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
              <ChevronRightIcon width={16} height={16} />
            </Button>
          </div>
        </>
      ) : q || status ? (
        <EmptyState icon={<SearchIcon />} title="No matches" description={q ? `Nothing in ${tab} matches “${q}”.` : 'No emails with this status.'} />
      ) : (
        <EmptyState
          icon={<Icon />}
          title={empty}
          description={emptyDesc}
          action={
            <Link href="/dashboard/compose" className="mt-2 text-sm font-semibold text-brand-700 hover:underline">
              Compose a new email
            </Link>
          }
        />
      )}
    </div>
  );
}
