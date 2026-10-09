import type { InputHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/format';

/** Inline "Label  value" row used by the compose form (the design's From / To / Subject rows). */
export function FieldRow({ label, children, htmlFor }: { label: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="flex items-center gap-4 border-b border-gray-100 py-3">
      <label htmlFor={htmlFor} className="w-16 shrink-0 text-xs text-gray-700">
        {label}
      </label>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/** Borderless input that sits inside a FieldRow. */
export function BareInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...rest}
      className={cn('w-full bg-transparent text-[13px] text-gray-900 placeholder:text-gray-400 focus:outline-none', className)}
    />
  );
}
