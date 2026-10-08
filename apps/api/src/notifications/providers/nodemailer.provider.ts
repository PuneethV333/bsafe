import { promises as dns } from 'node:dns';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';
import { type EmailProvider } from './provider.tokens';

/**
 * Email dispatch over plain SMTP (Nodemailer). Works with any SMTP host —
 * Gmail (app password), Outlook, or a managed relay — instead of a
 * vendor-specific API, and stays dry-run by default like the SMS provider.
 *
 * Required when NOTIFICATIONS_DRY_RUN=false: SMTP_HOST, SMTP_PORT,
 * SMTP_USER, SMTP_PASS, SMTP_FROM_EMAIL. SMTP_FROM_NAME, SMTP_SECURE and
 * SMTP_FAMILY are optional.
 */
export const realEmailProvider = (config: ConfigService): EmailProvider => {
  const host = config.get<string>('SMTP_HOST') as string;
  const port = Number(config.get<string>('SMTP_PORT') ?? '587');
  const user = config.get<string>('SMTP_USER') as string;
  const pass = config.get<string>('SMTP_PASS') as string;
  const fromEmail = config.get<string>('SMTP_FROM_EMAIL') as string;
  const fromName = config.get<string>('SMTP_FROM_NAME', 'bsafe');
  const secure = config.get<string>('SMTP_SECURE', 'false') === 'true';
  const family = Number(config.get<string>('SMTP_FAMILY', '4'));

  if (!host || !user || !pass || !fromEmail) {
    throw new Error(
      'SMTP_HOST, SMTP_USER, SMTP_PASS and SMTP_FROM_EMAIL are required to send ' +
        'email (or set NOTIFICATIONS_DRY_RUN=true). SMTP_PORT defaults to 587.',
    );
  }

  const logger = new Logger('EmailProvider');
  const from = `${fromName} <${fromEmail}>`;

  /**
   * Nodemailer resolves the hostname itself (IPv4 *and* IPv6, then falls back
   * to an AAAA address), so its `family` option is ignored and hosts without
   * IPv6 egress — Render included — die with ENETUNREACH. Resolve an IPv4
   * address ourselves and connect to that, while passing `servername` so TLS
   * still sends SNI and validates the certificate against the real hostname.
   */
  let transporter: Promise<Transporter> | null = null;
  const getTransporter = (): Promise<Transporter> => {
    transporter ??= (async () => {
      let connectHost = host;
      if (family === 4) {
        try {
          const [address] = await dns.resolve4(host);
          if (address) connectHost = address;
        } catch {
          // No A record — let Nodemailer resolve it as before.
        }
      }
      return nodemailer.createTransport({
        host: connectHost,
        servername: host,
        port,
        secure,
        auth: { user, pass },
      } as Parameters<typeof nodemailer.createTransport>[0]);
    })();
    return transporter;
  };

  return {
    name: 'nodemailer',
    async sendEmail(to, subject, html) {
      const info = await (await getTransporter()).sendMail({ from, to, subject, html });
      logger.log(`email queued: id=${info.messageId} to=${to}`);
    },
  };
};

export const dryRunEmailProvider = (): EmailProvider => {
  const logger = new Logger('EmailProvider(dry-run)');
  return {
    name: 'nodemailer-dry-run',
    async sendEmail(to, subject) {
      logger.log(`[dry-run] would email ${to} (subject: ${subject})`);
    },
  };
};