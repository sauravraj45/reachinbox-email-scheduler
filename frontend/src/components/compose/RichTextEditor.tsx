'use client';

import { useEffect, useRef, type ComponentType, type SVGProps } from 'react';
import { cn } from '@/lib/format';
import {
  AlignCenterIcon,
  AlignJustifyIcon,
  AlignLeftIcon,
  AlignRightIcon,
  ChevronDownIcon,
  ClearFormatIcon,
  CodeIcon,
  IndentIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  OutdentIcon,
  QuoteIcon,
  RedoIcon,
  StrikeIcon,
  UndoIcon,
} from '../ui/icons';

type Tool =
  | { kind: 'icon'; cmd: string; label: string; icon: ComponentType<SVGProps<SVGSVGElement>>; arg?: string }
  | { kind: 'text'; cmd: string; label: string; text: string; className: string }
  | { kind: 'size' }
  | { kind: 'sep' };

// Same tool order as the design's toolbar.
const TOOLS: Tool[] = [
  { kind: 'icon', cmd: 'undo', label: 'Undo', icon: UndoIcon },
  { kind: 'icon', cmd: 'redo', label: 'Redo', icon: RedoIcon },
  { kind: 'sep' },
  { kind: 'size' },
  { kind: 'sep' },
  { kind: 'text', cmd: 'bold', label: 'Bold', text: 'B', className: 'font-bold' },
  { kind: 'text', cmd: 'italic', label: 'Italic', text: 'I', className: 'italic font-serif' },
  { kind: 'text', cmd: 'underline', label: 'Underline', text: 'U', className: 'underline' },
  { kind: 'icon', cmd: 'strikeThrough', label: 'Strikethrough', icon: StrikeIcon },
  { kind: 'sep' },
  { kind: 'icon', cmd: 'justifyLeft', label: 'Align left', icon: AlignLeftIcon },
  { kind: 'icon', cmd: 'justifyCenter', label: 'Align center', icon: AlignCenterIcon },
  { kind: 'icon', cmd: 'justifyRight', label: 'Align right', icon: AlignRightIcon },
  { kind: 'icon', cmd: 'justifyFull', label: 'Justify', icon: AlignJustifyIcon },
  { kind: 'sep' },
  { kind: 'icon', cmd: 'insertUnorderedList', label: 'Bulleted list', icon: ListIcon },
  { kind: 'icon', cmd: 'insertOrderedList', label: 'Numbered list', icon: ListOrderedIcon },
  { kind: 'icon', cmd: 'outdent', label: 'Decrease indent', icon: OutdentIcon },
  { kind: 'icon', cmd: 'indent', label: 'Increase indent', icon: IndentIcon },
  { kind: 'sep' },
  { kind: 'icon', cmd: 'formatBlock', arg: 'blockquote', label: 'Quote', icon: QuoteIcon },
  { kind: 'icon', cmd: 'formatBlock', arg: 'pre', label: 'Code block', icon: CodeIcon },
  { kind: 'icon', cmd: 'createLink', label: 'Insert link', icon: LinkIcon },
  { kind: 'icon', cmd: 'removeFormat', label: 'Clear formatting', icon: ClearFormatIcon },
];

const SIZES = [
  { label: 'Small', value: '2' },
  { label: 'Normal', value: '3' },
  { label: 'Large', value: '5' },
  { label: 'Huge', value: '6' },
];

const btn = 'flex h-7 min-w-7 items-center justify-center rounded px-1 text-sm text-gray-600 hover:bg-gray-100';

/**
 * Rich-text body editor (contentEditable + execCommand) producing HTML.
 * Uncontrolled after mount: `value` seeds it, `onChange` reports HTML ('' when empty).
 */
export function RichTextEditor({ value, onChange, placeholder = 'Type Your Reply...' }: { value: string; onChange: (html: string) => void; placeholder?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current && !ref.current.innerHTML && value) ref.current.innerHTML = value;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emit = () => {
    const el = ref.current;
    if (!el) return;
    const isEmpty = !el.textContent?.trim() && !el.querySelector('img,li');
    onChange(isEmpty ? '' : el.innerHTML);
  };

  const exec = (cmd: string, arg?: string) => {
    ref.current?.focus();
    if (cmd === 'createLink') {
      const url = window.prompt('Link URL', 'https://');
      if (!url) return;
      arg = url;
    }
    document.execCommand(cmd, false, arg);
    emit();
  };

  return (
    <div className="flex min-h-[420px] flex-col rounded-lg bg-gray-50 px-5 py-4">
      <p className="text-sm text-gray-400">{placeholder}</p>

      <div className="mt-3 flex flex-wrap items-center gap-0.5 rounded-md bg-white px-2 py-1" role="toolbar" aria-label="Formatting">
        {TOOLS.map((t, i) => {
          if (t.kind === 'sep') return <span key={i} className="mx-1.5 h-4 w-px bg-gray-200" />;
          if (t.kind === 'size') {
            return (
              <label key="size" className={cn(btn, 'relative gap-0.5 px-1.5')} title="Text size">
                <span className="text-sm">T<span className="text-[10px]">T</span></span>
                <ChevronDownIcon width={12} height={12} />
                <select
                  aria-label="Text size"
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) exec('fontSize', e.target.value);
                    e.target.value = '';
                  }}
                  className="absolute inset-0 cursor-pointer opacity-0"
                >
                  <option value="" disabled>
                    Text size
                  </option>
                  {SIZES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
            );
          }
          return (
            <button
              key={t.label}
              type="button"
              title={t.label}
              aria-label={t.label}
              // mousedown + preventDefault keeps the text selection in the editor
              onMouseDown={(e) => {
                e.preventDefault();
                exec(t.cmd, t.kind === 'icon' ? t.arg : undefined);
              }}
              className={btn}
            >
              {t.kind === 'icon' ? <t.icon width={15} height={15} /> : <span className={t.className}>{t.text}</span>}
            </button>
          );
        })}
      </div>

      <div
        id="body"
        ref={ref}
        role="textbox"
        aria-multiline="true"
        aria-label="Body"
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        className={cn(
          'mt-3 flex-1 text-sm leading-relaxed text-gray-900 outline-none',
          '[&_blockquote]:border-l-2 [&_blockquote]:border-gray-300 [&_blockquote]:pl-3 [&_blockquote]:text-gray-600',
          '[&_pre]:rounded [&_pre]:bg-white [&_pre]:p-2 [&_pre]:font-mono [&_pre]:text-xs',
          '[&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6 [&_a]:text-brand-700 [&_a]:underline',
        )}
      />
    </div>
  );
}
