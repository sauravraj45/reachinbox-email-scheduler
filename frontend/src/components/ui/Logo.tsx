/** "ONB" wordmark from the design: geometric outlined letters (the B reads like an 8). */
export function Logo({ className = 'h-6 w-auto' }: { className?: string }) {
  return (
    <svg viewBox="0 0 62 22" className={className} role="img" aria-label="ONB" fill="none" stroke="currentColor" strokeWidth={3.4} strokeLinejoin="round">
      <rect x="1.7" y="1.7" width="16" height="18.6" rx="6" />
      <path d="M24 20.3V1.7l13 18.6V1.7" />
      <rect x="44" y="1.7" width="14" height="8.6" rx="4" />
      <rect x="43.3" y="10.3" width="15.4" height="10" rx="4.6" />
    </svg>
  );
}
