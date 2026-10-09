'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { HtmlBody } from '@/components/emails/HtmlBody';
import { AttachmentCard } from '@/components/ui/AttachmentCard';
import { Avatar } from '@/components/ui/Avatar';
import { ErrorState } from '@/components/ui/EmptyState';
import { ArrowLeftIcon, ChevronDownIcon, StarIcon, TrashIcon } from '@/components/ui/icons';
import { PageSpinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { useApi } from '@/hooks/useApi';
import { useDashboard } from '@/hooks/useDashboard';
import { useStarred } from '@/hooks/useStarred';
import { api } from '@/lib/api';
import { cn, formatDetail, formatFull } from '@/lib/format';

export default function EmailDetailPage({ params }: PageProps<'/dashboard/emails/[id]'>) {
  const { id } = use(params);
  const router = useRouter();
  const toast = useToast();
  const { user, refreshStats } = useDashboard();
  const { starred, toggle } = useStarred();
  const [deleting, setDeleting] = useState(false);
  const { data: email, error, loading, reload } = useApi(() => api.email(id), [id], { pollMs: 5000 });

  if (loading && !email) return <PageSpinner />;
  if (error && !email) return <ErrorState message={error} onRetry={() => void reload()} />;
  if (!email) return null;

  const pending = email.status === 'scheduled' || email.status === 'rate_limited';
  const isStarred = starred.has(email.id);
  const isHtml = /<\/?[a-z][\s\S]*>/i.test(email.body);
  const when = email.sentAt ?? email.scheduledAt;

  const remove = async () => {
    const msg = pending ? 'Cancel this scheduled email? It will not be sent.' : 'Delete this email from your history?';
    if (!window.confirm(msg)) return;
    setDeleting(true);
    try {
      await api.deleteEmail(email.id);
      toast.success(pending ? 'Scheduled email cancelled.' : 'Email deleted.');
      void refreshStats();
      router.push(pending ? '/dashboard/scheduled' : '/dashboard/sent');
    } catch (err) {
      toast.error((err as Error).message);
      setDeleting(false);
    }
  };

  const iconBtn = 'rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-40';

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center gap-3 px-6 py-4">
        <button onClick={() => router.back()} aria-label="Back" className="rounded-full p-1 text-gray-800 hover:bg-gray-100">
          <ArrowLeftIcon />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-xl font-normal text-gray-900">{email.subject}</h1>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label={isStarred ? 'Unstar' : 'Star'}
            aria-pressed={isStarred}
            onClick={() => toggle(email.id)}
            className={cn(iconBtn, isStarred && 'text-amber-400 hover:text-amber-500')}
          >
            <StarIcon width={17} height={17} fill={isStarred ? 'currentColor' : 'none'} />
          </button>
          <button
            type="button"
            aria-label={pending ? 'Cancel scheduled email' : 'Delete email'}
            title={pending ? 'Cancel scheduled email' : 'Delete'}
            onClick={() => void remove()}
            disabled={deleting || email.status === 'sending'}
            className={cn(iconBtn, 'hover:text-red-600')}
          >
            <TrashIcon width={17} height={17} />
          </button>
          <Avatar name={user.name} src={user.avatarUrl} className="ml-2 h-8 w-8" />
        </div>
      </div>

      <div className="w-full max-w-5xl px-6 pb-10 sm:pl-16 sm:pr-12">
        <div className="flex items-start gap-3">
          <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500 text-sm font-medium text-white">
            {email.sender.name.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm">
              <span className="font-medium text-gray-900">{email.sender.name}</span>{' '}
              <span className="text-xs text-gray-500">&lt;{email.sender.email}&gt;</span>
            </p>
            <p className="mt-1 inline-flex items-center gap-0.5 text-xs text-gray-500">
              to {email.to === user.email ? 'me' : email.to}
              <ChevronDownIcon width={12} height={12} />
            </p>
          </div>
          <time dateTime={when} title={formatFull(when)} className="shrink-0 text-xs text-gray-500">
            {formatDetail(when)}
          </time>
        </div>

        <div className="mt-5 pl-12">
          {isHtml ? (
            <HtmlBody html={email.body} />
          ) : (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">{email.body}</p>
          )}

          {email.attachments && email.attachments.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-3" aria-label="Attachments">
              {email.attachments.map((a) => (
                <AttachmentCard
                  key={a.id}
                  filename={a.filename}
                  size={a.size}
                  contentType={a.contentType}
                  previewSrc={api.attachmentUrl(a.id)}
                  href={api.attachmentUrl(a.id, true)}
                />
              ))}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
