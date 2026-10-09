'use client';

import { useRef, useState, type KeyboardEvent } from 'react';
import { isEmail, parseLeads } from '@/lib/leads';
import { UploadIcon, XIcon } from '../ui/icons';

const VISIBLE_CHIPS = 3;

/**
 * "To" field: upload a CSV/TXT list (any layout; addresses are detected by pattern)
 * or type/paste addresses. Shows a few chips plus "+N" and the detected count.
 */
export function LeadsField({ leads, onChange, max }: { leads: string[]; onChange: (leads: string[]) => void; max: number }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState('');
  const [info, setInfo] = useState<string | null>(null);

  const merge = (incoming: string[]) => {
    const next = [...new Set([...leads, ...incoming])];
    if (next.length > max) setInfo(`Only the first ${max.toLocaleString()} addresses were kept.`);
    onChange(next.slice(0, max));
  };

  const onFile = async (file: File) => {
    const { emails, duplicates } = parseLeads(await file.text());
    if (emails.length === 0) {
      setInfo(`No email addresses found in ${file.name}.`);
      return;
    }
    setInfo(`${emails.length.toLocaleString()} email address${emails.length === 1 ? '' : 'es'} detected in ${file.name}${duplicates ? ` (${duplicates} duplicate${duplicates === 1 ? '' : 's'} removed)` : ''}.`);
    merge(emails);
  };

  const commitDraft = () => {
    const parsed = parseLeads(draft).emails;
    if (parsed.length) merge(parsed);
    setDraft('');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (['Enter', ',', ' ', 'Tab'].includes(e.key) && draft.trim()) {
      if (e.key !== 'Tab') e.preventDefault();
      commitDraft();
    } else if (e.key === 'Backspace' && !draft && leads.length) {
      onChange(leads.slice(0, -1));
    }
  };

  const hidden = leads.length - VISIBLE_CHIPS;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        {leads.slice(0, VISIBLE_CHIPS).map((l) => (
          <span key={l} className="inline-flex items-center gap-1 rounded-full border border-brand-500 bg-white py-0.5 pl-2.5 pr-1 text-xs text-gray-700">
            {l}
            <button type="button" aria-label={`Remove ${l}`} onClick={() => onChange(leads.filter((x) => x !== l))} className="rounded-full p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
              <XIcon width={12} height={12} />
            </button>
          </span>
        ))}
        {hidden > 0 && <span className="rounded-full border border-brand-500 bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">+{hidden.toLocaleString()}</span>}
        <input
          id="to"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => draft.trim() && commitDraft()}
          onPaste={(e) => {
            const text = e.clipboardData.getData('text');
            if (/[\s,;]/.test(text.trim())) {
              e.preventDefault();
              merge(parseLeads(text).emails);
            }
          }}
          placeholder={leads.length ? '' : 'recipient@example.com'}
          className="min-w-40 flex-1 bg-transparent text-sm placeholder:text-gray-400 focus:outline-none"
          aria-invalid={Boolean(draft) && !isEmail(draft)}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="ml-auto inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-800"
        >
          <UploadIcon width={15} height={15} />
          Upload List
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.txt,text/csv,text/plain"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f);
            e.target.value = '';
          }}
        />
      </div>
      <div className="flex items-center gap-3 text-xs">
        <span className={leads.length ? 'font-medium text-brand-700' : 'text-gray-400'}>
          {leads.length.toLocaleString()} recipient{leads.length === 1 ? '' : 's'}
        </span>
        {info && <span className="text-gray-500">{info}</span>}
        {leads.length > 0 && (
          <button type="button" className="ml-auto text-gray-400 hover:text-red-600" onClick={() => { onChange([]); setInfo(null); }}>
            Clear all
          </button>
        )}
      </div>
    </div>
  );
}
