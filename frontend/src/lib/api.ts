import type {
  Attachment,
  CampaignRequest,
  CampaignResponse,
  Email,
  EmailStats,
  EmailStatus,
  EmailTab,
  Paginated,
  SchedulerConfig,
  Sender,
  User,
} from './types';

/**
 * Backend base URL. Empty string = same origin: requests go to this Next.js server,
 * which proxies them to the backend (see rewrites in next.config.ts). Used for public
 * tunnels/deploys where only one URL is exposed.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public issues?: { path: string; message: string }[],
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    });
  } catch {
    throw new ApiError('Cannot reach the server. Is the backend running?', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const issues = data.issues as ApiError['issues'];
    const detail = issues?.length ? `: ${issues.map((i) => `${i.path} ${i.message}`).join(', ')}` : '';
    throw new ApiError((data.error ?? `Request failed (${res.status})`) + detail, res.status, issues);
  }
  return data as T;
}

export const api = {
  googleLoginUrl: `${API_URL}/auth/google`,
  slackConnectUrl: `${API_URL}/slack/connect`,

  me: () => request<User>('/api/me'),
  logout: () => request<{ ok: true }>('/auth/logout', { method: 'POST' }),
  config: () => request<SchedulerConfig>('/api/config'),
  senders: () => request<Sender[]>('/api/senders'),

  emails: (p: { tab: EmailTab; page: number; pageSize: number; q?: string; status?: EmailStatus }) => {
    const qs = new URLSearchParams({ tab: p.tab, page: String(p.page), pageSize: String(p.pageSize) });
    if (p.q) qs.set('q', p.q);
    if (p.status) qs.set('status', p.status);
    return request<Paginated<Email>>(`/api/emails?${qs}`);
  },
  email: (id: string) => request<Email>(`/api/emails/${encodeURIComponent(id)}`),
  deleteEmail: (id: string) => request<{ ok: true }>(`/api/emails/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  stats: () => request<EmailStats>('/api/emails/stats'),
  scheduleCampaign: (body: CampaignRequest) =>
    request<CampaignResponse>('/api/campaigns', { method: 'POST', body: JSON.stringify(body) }),

  uploadAttachment: (file: File) =>
    request<Attachment>('/api/attachments', {
      method: 'POST',
      body: file,
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Filename': encodeURIComponent(file.name),
        'X-Content-Type': file.type || 'application/octet-stream',
      },
    }),
  deleteAttachment: (id: string) => request<{ ok: boolean }>(`/api/attachments/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  attachmentUrl: (id: string, download = false) =>
    `${API_URL}/api/attachments/${encodeURIComponent(id)}${download ? '?download' : ''}`,

  disconnectSlack: () => request<{ ok: true }>('/api/slack', { method: 'DELETE' }),
  testSlack: () => request<{ ok: true }>('/api/slack/test', { method: 'POST' }),
};
