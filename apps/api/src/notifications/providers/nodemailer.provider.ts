import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';
import {
  EMAIL_PROVIDER,
  NOTIFICATIONS_DRY_RUN,
  type EmailProvider,
} from './provider.tokens';

/**
 * Email dispatch over plain SMTP (Nodemailer). Works with any SMTP host —
 * Gmail (app password), Outlook, or a managed relay — instead of a
 * vendor-specific API, and stays dry-run by default like the SMS provider.
 *
 * Required when NOTIFICATIONS_DRY_RUN=false: SMTP_HOST, SMTP_PORT,
 * SMTP_USER, SMTP_PASS, SMTP_FROM_EMAIL. SMTP_FROM_NAME and
 * SMTP_SECURE are optional.
 */
const realEmailProvider = (config: ConfigService): EmailProvider => {
  const host = config.get<string>('SMTP_HOST');
  const port = Number(config.get<string>('SMTP_PORT') ?? '587');
  const user = config.get<string>('SMTP_USER');
  const pass = config.get<string>('SMTP_PASS');
  const fromEmail = config.get<string>('SMTP_FROM_EMAIL');
  const fromName = config.get<string>('SMTP_FROM_NAME', 'bsafe');
  const secure = config.get<string>('SMTP_SECURE', 'false') === 'true';

  if (!host || !user || !pass || !fromEmail) {
    throw new Error(
      'SMTP_HOST, SMTP_USER, SMTP_PASS and SMTP_FROM_EMAIL are required to send ' +
        'email (or set NOTIFICATIONS_DRY_RUN=true). SMTP_PORT defaults to 587.',
    );
  }

  const transporter: Transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
  const logger = new Logger('EmailProvider');
  const from = `${fromName} <${fromEmail}>`;

  return {
    name: 'nodemailer',
    async sendEmail(to, subject, html) {
      const info = await transporter.sendMail({ from, to, subject, html });
      logger.log(`email queued: id=${info.messageId} to=${to}`);
    },
  };
};

const dryRunEmailProvider = (): EmailProvider => {
  const logger = new Logger('EmailProvider(dry-run)');
  return {
    name: 'nodemailer-dry-run',
    async sendEmail(to, subject, html) {
      logger.log(`[dry-run] would email ${to} (subject: ${subject})`);
      void html;
    },
  };
};

export const emailProviderFactory = {
  provide: EMAIL_PROVIDER,
  inject: [ConfigService],
  useFactory: (config: ConfigService): EmailProvider =>
    config.get<string>(NOTIFICATIONS_DRY_RUN, 'true') === 'true'
      ? dryRunEmailProvider()
      : realEmailProvider(config),
};