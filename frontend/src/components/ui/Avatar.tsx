import { cn, initials } from '@/lib/format';

export function Avatar({ name, src, className }: { name: string; src?: string | null; className?: string }) {
  if (src) {
    // Plain <img>: Google avatar hosts would otherwise need next/image remotePatterns.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={name} referrerPolicy="no-referrer" className={cn('rounded-full object-cover', className ?? 'h-9 w-9')} />;
  }
  return (
    <div
      aria-label={name}
      className={cn('flex items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700', className ?? 'h-9 w-9')}
    >
      {initials(name)}
    </div>
  );
}
