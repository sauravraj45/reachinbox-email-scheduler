import nodemailer, { Transporter } from 'nodemailer';
import type { SenderRow } from './senders.service';

const transporters = new Map<number, Transporter>();

function transporterFor(sender: SenderRow): Transporter {
  let t = transporters.get(sender.id);
  if (!t) {
    t = nodemailer.createTransport({
      host: sender.smtp_host,
      port: sender.smtp_port,
      secure: sender.smtp_port === 465,
      auth: { user: sender.smtp_user, pass: sender.smtp_pass },
      pool: true,
      maxConnections: 2,
    });
    transporters.set(sender.id, t);
  }
  return t;
}

export async function sendMail(
  sender: SenderRow,
  mail: {
    emailId: string;
    to: string;
    subject: string;
    body: string;
    attachments?: { filename: string; content: Buffer; contentType: string }[];
  },
): Promise<{ messageId: string; previewUrl: string | null }> {
  const isHtml = /<\/?[a-z][\s\S]*>/i.test(mail.body);
  const info = await transporterFor(sender).sendMail({
    from: { name: sender.name, address: sender.email },
    to: mail.to,
    subject: mail.subject,
    ...(isHtml ? { html: mail.body } : { text: mail.body }),
    attachments: mail.attachments,
    // Deterministic Message-ID: a retried send is recognisable as the same message downstream.
    messageId: `<${mail.emailId}@reachinbox.scheduler>`,
  });
  const preview = nodemailer.getTestMessageUrl(info);
  return { messageId: info.messageId, previewUrl: preview || null };
}
