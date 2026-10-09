import type { Email, EmailStatus } from '@/lib/types';
import { cn, formatShort } from '@/lib/format';
import { ClockIcon } from '../ui/icons';

const styles: Record<EmailStatus, string> = {
  scheduled: 'bg-orange-50 text-orange-600 border-orange-200',
  rate_limited: 'bg-amber-50 text-amber-700 border-amber-200',
  sending: 'bg-sky-50 text-sky-700 border-sky-200',
  sent: 'bg-gray-100 text-gray-700 border-gray-200',
  failed: 'bg-red-50 text-red-600 border-red-200',
};

const labels: Record<EmailStatus, string> = {
  scheduled: 'Scheduled',
  rate_limited: 'Rate limited',
  sending: 'Sending',
  sent: 'Sent',
  failed: 'Failed',
};

/** Pending emails show their (re)scheduled time inside the chip, like the design's orange clock chip. */
export function StatusBadge({ email }: { email: Pick<Email, 'status' | 'scheduledAt'> }) {
  const pending = email.status === 'scheduled' || email.status === 'rate_limited';
  const text =
    email.status === 'rate_limited'
      ? `Rate limited · ${formatShort(email.scheduledAt)}`
      : pending
        ? formatShort(email.scheduledAt)
        : labels[email.status];
  return (
    <span
      title={labels[email.status]}
      className={cn('inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap', styles[email.status])}
    >
      {pending && <ClockIcon width={12} height={12} />}
      {text}
    </span>
  );
}
