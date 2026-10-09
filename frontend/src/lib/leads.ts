const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;

export interface ParsedLeads {
  emails: string[];
  duplicates: number;
}

/**
 * Extracts email addresses from any CSV / TXT content. Works regardless of
 * column layout or header names (e.g. "name,email" or one address per line).
 */
export function parseLeads(text: string): ParsedLeads {
  const found = (text.match(EMAIL_RE) ?? []).map((e) => e.toLowerCase());
  const emails = [...new Set(found)];
  return { emails, duplicates: found.length - emails.length };
}

export const isEmail = (value: string) => new RegExp(`^${EMAIL_RE.source}$`, 'i').test(value.trim());
