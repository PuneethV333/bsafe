import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EmailProvider } from './provider.tokens';

/**
 * Email over HTTPS (port 443) instead of SMTP (25/465/587).
 *
 * Many hosts (Render free tier, Railway, Fly, most cloud VMs) block outbound
 * SMTP but always allow 443. Both providers below are plain REST calls, so no
 * extra dependency is needed (Node 18+ global fetch).
 *
 * EMAIL_API=brevo  -> BREVO_API_KEY, SMTP_FROM_EMAIL (must be a verified sender)
 * EMAIL_API=resend -> RESEND_API_KEY, SMTP_FROM_EMAIL (domain must be verified)
 */
const TIMEOUT_MS = 15_000;

async function postJson(
  url: string,
  headers: Record<string, string>,
  body: unknown,
): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const text = await res.text();
  if (!res.ok) {
    // Throwing lets BullMQ retry with its exponential backoff.
    throw new Error(`email API ${res.status}: ${text.slice(0, 300)}`);
  }
  return text ? (JSON.parse(text) as Record<string, unknown>) : {};
}

export const brevoEmailProvider = (config: ConfigService): EmailProvider => {
  const apiKey = config.get<string>('BREVO_API_KEY');
  const fromEmail = config.get<string>('SMTP_FROM_EMAIL');
  const fromName = config.get<string>('SMTP_FROM_NAME', 'bsafe');
  if (!apiKey || !fromEmail) {
    throw new Error('BREVO_API_KEY and SMTP_FROM_EMAIL are required for EMAIL_API=brevo.');
  }
  const logger = new Logger('EmailProvider(brevo)');
  return {
    name: 'brevo',
    async sendEmail(to, subject, html) {
      const out = await postJson(
        'https://api.brevo.com/v3/smtp/email',
        { 'api-key': apiKey },
        {
          sender: { name: fromName, email: fromEmail },
          to: [{ email: to }],
          subject,
          htmlContent: html,
        },
      );
      logger.log(`email accepted: id=${String(out.messageId)} to=${to}`);
    },
  };
};

export const resendEmailProvider = (config: ConfigService): EmailProvider => {
  const apiKey = config.get<string>('RESEND_API_KEY');
  const fromEmail = config.get<string>('SMTP_FROM_EMAIL');
  const fromName = config.get<string>('SMTP_FROM_NAME', 'bsafe');
  if (!apiKey || !fromEmail) {
    throw new Error('RESEND_API_KEY and SMTP_FROM_EMAIL are required for EMAIL_API=resend.');
  }
  const logger = new Logger('EmailProvider(resend)');
  return {
    name: 'resend',
    async sendEmail(to, subject, html) {
      const out = await postJson(
        'https://api.resend.com/emails',
        { Authorization: `Bearer ${apiKey}` },
        { from: `${fromName} <${fromEmail}>`, to: [to], subject, html },
      );
      logger.log(`email accepted: id=${String(out.id)} to=${to}`);
    },
  };
};