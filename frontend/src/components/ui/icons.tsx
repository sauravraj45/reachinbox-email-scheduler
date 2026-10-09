import type { SVGProps } from 'react';

/** Small inline icon set (stroke icons, 24px grid) to avoid an icon dependency. */
const make = (d: string | string[]) =>
  function Icon(props: SVGProps<SVGSVGElement>) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" width={18} height={18} aria-hidden {...props}>
        {(Array.isArray(d) ? d : [d]).map((p) => (
          <path key={p} d={p} />
        ))}
      </svg>
    );
  };

export const ClockIcon = make(['M12 7v5l3 2', 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z']);
export const SendIcon = make(['M22 2 11 13', 'M22 2 15 22l-4-9-9-4 20-7Z']);
export const SearchIcon = make(['m21 21-4.3-4.3', 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z']);
export const RefreshIcon = make(['M21 12a9 9 0 1 1-2.6-6.4', 'M21 4v5h-5']);
export const ArrowLeftIcon = make(['M19 12H5', 'm12 19-7-7 7-7']);
export const UploadIcon = make(['M12 15V3', 'm7 8 5-5 5 5', 'M5 21h14']);
export const LogoutIcon = make(['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'm16 17 5-5-5-5', 'M21 12H9']);
export const PenIcon = make(['M12 20h9', 'M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z']);
export const ChevronLeftIcon = make('m15 18-6-6 6-6');
export const ChevronRightIcon = make('m9 18 6-6-6-6');
export const XIcon = make(['M18 6 6 18', 'm6 6 12 12']);
export const ChevronDownIcon = make('m6 9 6 6 6-6');
export const TrashIcon = make(['M3 6h18', 'M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2', 'M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6', 'M10 11v6', 'M14 11v6']);
export const FilterIcon = make('M3 4h18l-7 8.5V19l-4 2v-8.5L3 4Z');
export const StarIcon = make('m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9L12 3Z');
export const PaperclipIcon = make('m21.4 11.1-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5');
export const StrikeIcon = make(['M16 4H9a3 3 0 0 0-2.8 4', 'M14 12a4 4 0 0 1 0 8H6', 'M4 12h16']);
export const AlignJustifyIcon = make(['M3 6h18', 'M3 12h18', 'M3 18h18']);
export const IndentIcon = make(['m3 8 4 4-4 4', 'M21 12H11', 'M21 6H11', 'M21 18H11']);
export const OutdentIcon = make(['m7 8-4 4 4 4', 'M21 12H11', 'M21 6H11', 'M21 18H11']);
export const CodeIcon = make(['m16 18 6-6-6-6', 'm8 6-6 6 6 6']);
export const CalendarIcon = make(['M8 2v4', 'M16 2v4', 'M3 10h18', 'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z']);
export const UndoIcon = make(['M3 7v6h6', 'M21 17a9 9 0 0 0-15-6.7L3 13']);
export const RedoIcon = make(['M21 7v6h-6', 'M3 17a9 9 0 0 1 15-6.7L21 13']);
export const AlignLeftIcon = make(['M3 6h18', 'M3 12h12', 'M3 18h16']);
export const AlignCenterIcon = make(['M3 6h18', 'M6 12h12', 'M4 18h16']);
export const AlignRightIcon = make(['M3 6h18', 'M9 12h12', 'M5 18h16']);
export const ListIcon = make(['M9 6h12', 'M9 12h12', 'M9 18h12', 'M4 6h.01', 'M4 12h.01', 'M4 18h.01']);
export const ListOrderedIcon = make(['M10 6h11', 'M10 12h11', 'M10 18h11', 'M4 6h1v4', 'M4 10h2', 'M6 18H4c0-1 2-2 2-3s-1-1.5-2-1']);
export const QuoteIcon = make(['M3 21c3 0 7-1 7-8V5c0-1.25-.76-2-2-2H4c-1.25 0-2 .75-2 1.97V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .01-1 1.03V20c0 1 0 1 1 1Z', 'M15 21c3 0 7-1 7-8V5c0-1.25-.76-2-2-2h-4c-1.25 0-2 .75-2 1.97V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1Z']);
export const ClearFormatIcon = make(['M4 7V4h16v3', 'M5 20h6', 'M13 4 8 20', 'm15 15 5 5', 'm20 15-5 5']);
export const LinkIcon = make(['M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7', 'M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7']);

export function SlackIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} aria-hidden {...props}>
      <path fill="#E01E5A" d="M5 15a2 2 0 1 1-2-2h2v2Zm1 0a2 2 0 1 1 4 0v5a2 2 0 1 1-4 0v-5Z" />
      <path fill="#36C5F0" d="M8 5a2 2 0 1 1 2-2v2H8Zm0 1a2 2 0 1 1 0 4H3a2 2 0 1 1 0-4h5Z" />
      <path fill="#2EB67D" d="M18 8a2 2 0 1 1 2 2h-2V8Zm-1 0a2 2 0 1 1-4 0V3a2 2 0 1 1 4 0v5Z" />
      <path fill="#ECB22E" d="M15 18a2 2 0 1 1-2 2v-2h2Zm0-1a2 2 0 1 1 0-4h5a2 2 0 1 1 0 4h-5Z" />
    </svg>
  );
}

export function GoogleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 48" width={18} height={18} aria-hidden {...props}>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5Z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7Z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44Z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5Z" />
    </svg>
  );
}
