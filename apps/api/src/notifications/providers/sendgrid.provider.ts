import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sgMail from '@sendgrid/mail';
import {
  EMAIL_PROVIDER,
  NOTIFICATIONS_DRY_RUN,
  type EmailProvider,
} from './provider.tokens';

const realEmailProvider = (config: ConfigService): EmailProvider => {
  const apiKey = config.get<string>('SENDGRID_API_KEY');
  const fromEmail = config.get<string>('SENDGRID_FROM_EMAIL');
  const fromName = config.get<string>('SENDGRID_FROM_NAME', 'bsafe');
  if (!apiKey) {
    throw new Error(
      'SENDGRID_API_KEY is required to send email (or set NOTIFICATIONS_DRY_RUN=true).',
    );
  }
  if (!fromEmail) {
    throw new Error(
      'SENDGRID_FROM_EMAIL is required to send email (or set NOTIFICATIONS_DRY_RUN=true).',
    );
  }
  sgMail.setApiKey(apiKey);
  const logger = new Logger('SendGridProvider');

  return {
    name: 'sendgrid',
    async sendEmail(to, subject, html) {
      await sgMail.send({
        to,
        from: { email: fromEmail, name: fromName },
        subject,
        html,
      });
      logger.log(`email sent to ${to} (subject: ${subject})`);
    },
  };
};

const dryRunEmailProvider = (): EmailProvider => {
  const logger = new Logger('SendGridProvider(dry-run)');
  return {
    name: 'sendgrid-dry-run',
    async sendEmail(to, subject) {
      logger.log(`[dry-run] would email ${to} (subject: ${subject})`);
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