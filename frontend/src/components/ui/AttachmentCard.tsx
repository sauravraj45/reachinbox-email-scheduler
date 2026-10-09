import { cn } from '@/lib/format';
import { PaperclipIcon, XIcon } from './icons';
import { Spinner } from './Spinner';

const formatBytes = (n: number) =>
  n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;

const RASTER = /^image\/(png|jpe?g|gif|webp)$/;

/** Attachment tile from the design: image thumbnail (or file icon) + name + size. */
export function AttachmentCard({ filename, size, contentType, previewSrc, href, uploading, onRemove }: {
  filename: string;
  size: number;
  contentType: string;
  /** Image URL for the thumbnail (object URL while composing, API URL when viewing). */
  previewSrc?: string;
  href?: string;
  uploading?: boolean;
  onRemove?: () => void;
}) {
  const isImage = RASTER.test(contentType) && previewSrc;
  const body = (
    <>
      <div className="flex h-28 items-center justify-center overflow-hidden bg-gray-100">
        {uploading ? (
          <Spinner className="h-5 w-5 text-brand-600" />
        ) : isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewSrc} alt={filename} className="h-full w-full object-cover" />
        ) : (
          <PaperclipIcon width={22} height={22} className="text-gray-400" />
        )}
      </div>
      <div className="px-2.5 py-2">
        <p className="truncate text-xs font-medium text-gray-900" title={filename}>
          {filename}
        </p>
        <p className="text-[11px] text-gray-500">{formatBytes(size)}</p>
      </div>
    </>
  );

  return (
    <div className={cn('group relative w-44 shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-white', uploading && 'opacity-70')}>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" className="block">
          {body}
        </a>
      ) : (
        body
      )}
      {onRemove && !uploading && (
        <button
          type="button"
          aria-label={`Remove ${filename}`}
          onClick={onRemove}
          className="absolute right-1.5 top-1.5 rounded-full bg-white/90 p-1 text-gray-600 shadow-sm hover:text-red-600"
        >
          <XIcon width={12} height={12} />
        </button>
      )}
    </div>
  );
}
