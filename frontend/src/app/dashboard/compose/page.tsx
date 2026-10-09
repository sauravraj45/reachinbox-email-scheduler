'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { LeadsField } from '@/components/compose/LeadsField';
import { RichTextEditor } from '@/components/compose/RichTextEditor';
import { SendLaterPopover } from '@/components/compose/SendLaterPopover';
import { AttachmentCard } from '@/components/ui/AttachmentCard';
import { Button } from '@/components/ui/Button';
import { BareInput, FieldRow } from '@/components/ui/Field';
import { ArrowLeftIcon, ChevronDownIcon, ClockIcon, PaperclipIcon } from '@/components/ui/icons';
import { PageSpinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { useApi } from '@/hooks/useApi';
import { MAX_FILES, useAttachmentUploads } from '@/hooks/useAttachmentUploads';
import { useDashboard } from '@/hooks/useDashboard';
import { api } from '@/lib/api';
import { formatFull } from '@/lib/format';

interface FormState {
  senderId: string;
  leads: string[];
  subject: string;
  body: string;
  delaySec: string;
  hourlyLimit: string;
}

type Errors = Partial<Record<keyof FormState, string>>;

const smallInput =
  'h-7 w-14 rounded-md border border-gray-200 bg-white px-2 text-center text-xs text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100';

export default function ComposePage() {
  const router = useRouter();
  const toast = useToast();
  const { refreshStats } = useDashboard();
  const setup = useApi(() => Promise.all([api.senders(), api.config()]), []);
  const [senders, cfg] = setup.data ?? [null, null];

  const [form, setForm] = useState<FormState>({ senderId: '', leads: [], subject: '', body: '', delaySec: '', hourlyLimit: '' });
  const [errors, setErrors] = useState<Errors>({});
  const [pickerOpen, setPickerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const files = useAttachmentUploads(toast.error);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fill defaults from server config once loaded
  useEffect(() => {
    if (!senders || !cfg) return;
    setForm((f) => ({
      ...f,
      senderId: f.senderId || String(senders[0]?.id ?? ''),
      delaySec: f.delaySec || String(Math.max(1, Math.round(cfg.minDelayBetweenSendsMs / 1000))),
      hourlyLimit: f.hourlyLimit || String(cfg.defaultHourlyLimit),
    }));
  }, [senders, cfg]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const validate = (): boolean => {
    const e: Errors = {};
    if (!form.senderId) e.senderId = 'Choose a sender';
    if (!form.leads.length) e.leads = 'Add at least one recipient (type or upload a list)';
    if (!form.subject.trim()) e.subject = 'Subject is required';
    if (!form.body.trim()) e.body = 'Body is required';
    const d = Number(form.delaySec);
    if (form.delaySec === '' || Number.isNaN(d) || d < 0) e.delaySec = 'Delay must be 0 or more seconds';
    const h = Number(form.hourlyLimit);
    if (!Number.isInteger(h) || h < 1) e.hourlyLimit = 'Hourly limit must be a whole number ≥ 1';
    else if (cfg && h > cfg.maxEmailsPerHourPerSender) e.hourlyLimit = `Hourly limit max is ${cfg.maxEmailsPerHourPerSender} per sender`;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const schedule = async (startAt: Date) => {
    if (files.uploading) {
      toast.info('Please wait for attachments to finish uploading.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.scheduleCampaign({
        senderId: Number(form.senderId),
        leads: form.leads,
        subject: form.subject.trim(),
        body: form.body,
        startAt: startAt.toISOString(),
        delayMs: Math.round(Number(form.delaySec) * 1000),
        hourlyLimit: Number(form.hourlyLimit),
        attachmentIds: files.ids,
      });
      toast.success(`Scheduled ${res.scheduled.toLocaleString()} email${res.scheduled === 1 ? '' : 's'} starting ${formatFull(res.firstAt)}.`);
      void refreshStats();
      router.push('/dashboard/scheduled');
    } catch (err) {
      toast.error((err as Error).message);
      setSubmitting(false);
    }
  };

  const openPicker = () => {
    if (validate()) setPickerOpen(true);
  };

  if (setup.loading) return <PageSpinner />;
  if (setup.error || !senders || !cfg) {
    return <p className="p-6 text-sm text-red-600">Could not load senders: {setup.error}</p>;
  }

  const rateNote =
    form.leads.length > Number(form.hourlyLimit) && Number(form.hourlyLimit) > 0
      ? `${form.leads.length.toLocaleString()} recipients exceed the hourly limit of ${form.hourlyLimit}; the rest roll over to the next hour automatically.`
      : null;
  const errorList = Object.values(errors).filter(Boolean);

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center gap-3 px-6 py-4">
        <Link href="/dashboard/scheduled" aria-label="Back" className="rounded-full p-1 text-gray-700 hover:bg-gray-100">
          <ArrowLeftIcon />
        </Link>
        <h1 className="flex-1 text-xl font-normal text-gray-900">Compose New Email</h1>
        <div className="relative flex items-center gap-1">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={files.items.length >= MAX_FILES}
            aria-label="Attach files"
            title={`Attach files (up to ${MAX_FILES}, 5 MB each)`}
            className="rounded-full p-2 text-brand-600 hover:bg-brand-50 disabled:opacity-40"
          >
            <PaperclipIcon width={18} height={18} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) files.add(e.target.files);
              e.target.value = '';
            }}
          />
          <button type="button" onClick={openPicker} aria-label="Schedule send" title="Send later" className="rounded-full p-2 text-gray-500 hover:bg-gray-100">
            <ClockIcon width={18} height={18} />
          </button>
          <Button variant="outline" size="sm" className="ml-1 h-8 px-4 text-xs font-medium" onClick={openPicker}>
            Send Later
          </Button>
          {pickerOpen && <SendLaterPopover submitting={submitting} onCancel={() => setPickerOpen(false)} onDone={(at) => void schedule(at)} />}
        </div>
      </div>

      <div className="w-full max-w-5xl px-6 pb-10 sm:px-16">
        <FieldRow label="From" htmlFor="sender">
          <div className="relative inline-flex max-w-full">
            <select
              id="sender"
              value={form.senderId}
              onChange={(e) => set('senderId', e.target.value)}
              className="h-7 max-w-full appearance-none truncate rounded-md bg-gray-100 pl-3 pr-8 text-[13px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-100"
            >
              {senders.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.email}
                </option>
              ))}
            </select>
            <ChevronDownIcon width={14} height={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
          </div>
        </FieldRow>

        <FieldRow label="To" htmlFor="to">
          <LeadsField leads={form.leads} onChange={(l) => set('leads', l)} max={cfg.maxLeads} />
        </FieldRow>

        <FieldRow label="Subject" htmlFor="subject">
          <BareInput id="subject" value={form.subject} onChange={(e) => set('subject', e.target.value)} placeholder="Subject" maxLength={500} />
        </FieldRow>

        <div className="flex flex-wrap items-center gap-x-10 gap-y-3 py-4">
          <label className="flex items-center gap-3 text-xs text-gray-700">
            Delay between 2 emails
            <input type="number" min={0} step="any" aria-label="Delay between 2 emails in seconds" value={form.delaySec} onChange={(e) => set('delaySec', e.target.value)} placeholder="00" className={smallInput} />
            <span className="text-xs text-gray-400">sec</span>
          </label>
          <label className="flex items-center gap-3 text-xs text-gray-700">
            Hourly Limit
            <input type="number" min={1} max={cfg.maxEmailsPerHourPerSender} aria-label="Hourly limit" value={form.hourlyLimit} onChange={(e) => set('hourlyLimit', e.target.value)} placeholder="00" className={smallInput} />
          </label>
        </div>

        <RichTextEditor value={form.body} onChange={(html) => set('body', html)} />

        {files.items.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-3" aria-label="Attachments">
            {files.items.map((f) => (
              <AttachmentCard
                key={f.key}
                filename={f.filename}
                size={f.size}
                contentType={f.contentType}
                previewSrc={f.previewUrl}
                uploading={f.status === 'uploading'}
                onRemove={() => files.remove(f.key)}
              />
            ))}
          </div>
        )}

        {errorList.length > 0 && (
          <ul className="mt-3 list-disc rounded-md border border-red-200 bg-red-50 py-2 pl-8 pr-3 text-xs text-red-700">
            {errorList.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
        {rateNote && <p className="mt-3 text-xs text-amber-700">{rateNote}</p>}
      </div>
    </div>
  );
}
