export type EmailStatus = 'scheduled' | 'rate_limited' | 'sending' | 'sent' | 'failed';

export type EmailTab = 'scheduled' | 'sent';

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  slack: SlackStatus;
}

interface SlackStatus {
  configured: boolean;
  connected: boolean;
  teamName: string | null;
  channel: string | null;
}

export interface Sender {
  id: number;
  name: string;
  email: string;
}

export interface Attachment {
  id: string;
  filename: string;
  contentType: string;
  size: number;
}

export interface Email {
  id: string;
  campaignId: string;
  to: string;
  subject: string;
  body: string;
  status: EmailStatus;
  scheduledAt: string;
  sentAt: string | null;
  error: string | null;
  previewUrl: string | null;
  attempts: number;
  rescheduleCount: number;
  sender: Sender;
  /** Only returned by the detail endpoint. */
  attachments?: Attachment[];
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  searchEngine: 'elasticsearch' | 'sql' | null;
}

export interface EmailStats {
  scheduled: number;
  sent: number;
  failed: number;
}

export interface SchedulerConfig {
  minDelayBetweenSendsMs: number;
  maxEmailsPerHourPerSender: number;
  defaultHourlyLimit: number;
  workerConcurrency: number;
  maxLeads: number;
}

export interface CampaignRequest {
  senderId: number;
  subject: string;
  body: string;
  leads: string[];
  startAt: string;
  delayMs: number;
  hourlyLimit: number;
  attachmentIds: string[];
}

export interface CampaignResponse {
  campaignId: string;
  scheduled: number;
  duplicatesRemoved: number;
  firstAt: string;
  lastAt: string;
}
