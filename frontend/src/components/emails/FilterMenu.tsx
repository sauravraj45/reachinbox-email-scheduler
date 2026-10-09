'use client';

import { useRef, useState } from 'react';
import { useDismiss } from '@/hooks/useDismiss';
import { cn } from '@/lib/format';
import type { EmailStatus, EmailTab } from '@/lib/types';
import { FilterIcon } from '../ui/icons';

const OPTIONS: Record<EmailTab, { value: EmailStatus | null; label: string }[]> = {
  scheduled: [
    { value: null, label: 'All scheduled' },
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'rate_limited', label: 'Rate limited' },
    { value: 'sending', label: 'Sending' },
  ],
  sent: [
    { value: null, label: 'All' },
    { value: 'sent', label: 'Sent' },
    { value: 'failed', label: 'Failed' },
  ],
};

/** Status filter for the list (the funnel icon next to search in the design). */
export function FilterMenu({ tab, value, onChange }: { tab: EmailTab; value: EmailStatus | null; onChange: (v: EmailStatus | null) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, open, () => setOpen(false));

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Filter by status"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn('relative rounded-md p-2 hover:bg-gray-100', value ? 'text-brand-700' : 'text-gray-500')}
      >
        <FilterIcon width={16} height={16} />
        {value && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-brand-600" />}
      </button>
      {open && (
        <div role="menu" className="absolute left-0 z-30 mt-1 w-44 rounded-lg border border-gray-100 bg-white py-1 shadow-lg">
          {OPTIONS[tab].map((o) => (
            <button
              key={o.label}
              role="menuitemradio"
              aria-checked={value === o.value}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
              className={cn('block w-full px-3 py-2 text-left text-sm hover:bg-gray-50', value === o.value ? 'font-medium text-brand-700' : 'text-gray-700')}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
