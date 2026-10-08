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
 *
 * SMTP_FROM_EMAIL is also accepted as EMAIL_FROM_EMAIL / FROM_EMAIL so a
 * sender set under any of those names still works.
 */
const TIMEOUT_MS = 15_000;

function clean(value: string | undefined): string {
  return (value ?? '').trim().replace(/^["']|["']$/g, '').trim();
}

function getSender(config: ConfigService): { fromEmail: string; fromName: string } {
  const fromEmail =
    clean(config.get<string>('SMTP_FROM_EMAIL')) ||
    clean(config.get<string>('EMAIL_FROM_EMAIL')) ||
    clean(config.get<string>('FROM_EMAIL'));
  const fromName =
    clean(config.get<string>('SMTP_FROM_NAME')) ||
    clean(config.get<string>('EMAIL_FROM_NAME')) ||
    'bsafe';
  return { fromEmail, fromName };
}

async function postJson(
  url: string,
  headers: Record<string, string>,
  body: unknown,
): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await res.text();
    if (!res.ok) {
      // Throwing lets BullMQ retry with its exponential backoff. The body
      // carries the actionable reason (bad key, unverified sender, ...).
      throw new Error(`email API ${res.status}: ${text.slice(0, 500)}`);
    }
    const trimmed = text.trim();
    if (!trimmed) return {};
    try {
      return JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      return { raw: trimmed.slice(0, 500) };
    }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`email API timed out after ${TIMEOUT_MS}ms (${url})`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function assertRecipient(to: string): string {
  const cleanTo = clean(to);
  if (!cleanTo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanTo)) {
    throw new Error(`invalid recipient email: ${JSON.stringify(to)}`);
  }
  return cleanTo;
}

export const brevoEmailProvider = (config: ConfigService): EmailProvider => {
  const apiKey = clean(config.get<string>('BREVO_API_KEY'));
  const { fromEmail, fromName } = getSender(config);
  if (!apiKey || !fromEmail) {
    throw new Error(
      'BREVO_API_KEY and a sender email (SMTP_FROM_EMAIL / EMAIL_FROM_EMAIL / FROM_EMAIL) ' +
        'are required for EMAIL_API=brevo. The sender must be a verified Brevo sender.',
    );
  }
  const logger = new Logger('EmailProvider(brevo)');
  return {
    name: 'brevo',
    async sendEmail(to, subject, html) {
      const recipient = assertRecipient(to);
      const out = await postJson(
        'https://api.brevo.com/v3/smtp/email',
        { 'api-key': apiKey },
        {
          sender: { name: fromName, email: fromEmail },
          to: [{ email: recipient }],
          subject,
          htmlContent: html,
          textContent: htmlToText(html),
        },
      );
      logger.log(`email accepted: id=${String(out.messageId ?? out.raw ?? 'unknown')} to=${recipient}`);
    },
  };
};

export const resendEmailProvider = (config: ConfigService): EmailProvider => {
  const apiKey = clean(config.get<string>('RESEND_API_KEY'));
  const { fromEmail, fromName } = getSender(config);
  if (!apiKey || !fromEmail) {
    throw new Error(
      'RESEND_API_KEY and a sender email (SMTP_FROM_EMAIL / EMAIL_FROM_EMAIL / FROM_EMAIL) ' +
        'are required for EMAIL_API=resend. The sender domain must be verified in Resend. ' +
        'Note: Resend test keys (re_...) only deliver to the account owner email.',
    );
  }
  const logger = new Logger('EmailProvider(resend)');
  return {
    name: 'resend',
    async sendEmail(to, subject, html) {
      const recipient = assertRecipient(to);
      const out = await postJson(
        'https://api.resend.com/emails',
        { Authorization: `Bearer ${apiKey}` },
        { from: `${fromName} <${fromEmail}>`, to: [recipient], subject, html, text: htmlToText(html) },
      );
      logger.log(`email accepted: id=${String(out.id ?? out.raw ?? 'unknown')} to=${recipient}`);
    },
  };
};

function htmlToText(html: string): string {
  return html
    .replace(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, '$2 ($1)')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h\d|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}