'use client';

import { useRef, useState } from 'react';
import { useDismiss } from '@/hooks/useDismiss';
import { cn, formatFull, toLocalInput } from '@/lib/format';
import { Button } from '../ui/Button';
import { CalendarIcon } from '../ui/icons';

interface Preset {
  label: string;
  at: () => Date;
}

const tomorrowAt = (h: number) => () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(h, 0, 0, 0);
  return d;
};

const PRESETS: Preset[] = [
  { label: 'Tomorrow', at: tomorrowAt(9) },
  { label: 'Tomorrow, 10:00 AM', at: tomorrowAt(10) },
  { label: 'Tomorrow, 11:00 AM', at: tomorrowAt(11) },
  { label: 'Tomorrow, 3:00 PM', at: tomorrowAt(15) },
];

/** "Send Later" dropdown from the design: pick a date & time or a preset, then Done. */
export function SendLaterPopover({ onCancel, onDone, submitting }: {
  onCancel: () => void;
  onDone: (startAt: Date) => void;
  submitting: boolean;
}) {
  const [value, setValue] = useState('');
  const [preset, setPreset] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useDismiss(ref, !submitting, onCancel);

  const openPicker = () => {
    const el = inputRef.current;
    if (!el) return;
    try {
      el.showPicker();
    } catch {
      el.focus();
    }
  };

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Send later"
      className="absolute right-0 top-full z-30 mt-2 w-72 rounded-lg border border-gray-100 bg-white px-5 py-4 shadow-[0_8px_30px_rgba(0,0,0,0.08)]"
    >
      <p className="text-sm font-semibold text-gray-900">Send Later</p>

      {/* Styled trigger over a native datetime picker (keeps the design's placeholder + calendar icon). */}
      <div className="relative mt-3">
        <button
          type="button"
          onClick={openPicker}
          className="flex h-9 w-full items-center justify-between border-b border-gray-200 text-left text-sm"
        >
          <span className={value ? 'text-gray-900' : 'text-gray-400'}>{value ? formatFull(new Date(value).toISOString()) : 'Pick date & time'}</span>
          <CalendarIcon width={16} height={16} className="text-gray-400" />
        </button>
        <input
          ref={inputRef}
          type="datetime-local"
          aria-label="Pick date & time"
          tabIndex={-1}
          value={value}
          min={toLocalInput(new Date())}
          onChange={(e) => {
            setValue(e.target.value);
            setPreset(null);
          }}
          className="pointer-events-none absolute inset-0 opacity-0"
        />
      </div>

      <ul className="mt-2 flex flex-col">
        {PRESETS.map((p) => (
          <li key={p.label}>
            <button
              type="button"
              onClick={() => {
                setPreset(p.label);
                setValue(toLocalInput(p.at()));
              }}
              className={cn('w-full py-2 text-left text-sm transition-colors hover:text-gray-900', preset === p.label ? 'font-medium text-brand-700' : 'text-gray-600')}
            >
              {p.label}
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex items-center justify-end gap-5">
        <button type="button" onClick={onCancel} className="text-sm text-gray-700 hover:text-gray-900">
          Cancel
        </button>
        <Button type="button" variant="outline" size="sm" className="px-5" disabled={!value} loading={submitting} onClick={() => onDone(new Date(value))}>
          Done
        </Button>
      </div>
    </div>
  );
}
