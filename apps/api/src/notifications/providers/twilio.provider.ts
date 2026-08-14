import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Twilio } from 'twilio';
import twilio from 'twilio';
import {
  NOTIFICATIONS_DRY_RUN,
  type SmsProvider,
} from './provider.tokens';

const toE164 = (phone: string): string => {
  const digits = phone.replace(/[^+\d]/g, '');
  return digits.startsWith('+') ? digits : `+${digits}`;
};

const realSmsProvider = (config: ConfigService): SmsProvider => {
  const accountSid = config.get<string>('TWILIO_ACCOUNT_SID');
  const authToken = config.get<string>('TWILIO_AUTH_TOKEN');
  const messagingServiceSid = config.get<string>('TWILIO_MESSAGING_SERVICE_SID');
  if (!accountSid || !authToken || !messagingServiceSid) {
    throw new Error(
      'TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_MESSAGING_SERVICE_SID ' +
        'are required to send SMS (or set NOTIFICATIONS_DRY_RUN=true).',
    );
  }
  const client: Twilio = twilio(accountSid, authToken);
  const logger = new Logger('TwilioProvider');

  return {
    name: 'twilio',
    async sendSms(to, body) {
      const message = await client.messages.create({
        messagingServiceSid,
        to: toE164(to),
        body,
      });
      logger.log(`SMS queued: sid=${message.sid} to=${to}`);
    },
  };
};

const dryRunSmsProvider = (): SmsProvider => {
  const logger = new Logger('TwilioProvider(dry-run)');
  return {
    name: 'twilio-dry-run',
    async sendSms(to, body) {
      logger.log(`[dry-run] would send SMS to ${to}: ${body}`);
    },
  };
};

export const smsProviderFactory = {
  provide: 'SMS_PROVIDER',
  inject: [ConfigService],
  useFactory: (config: ConfigService): SmsProvider =>
    config.get<string>(NOTIFICATIONS_DRY_RUN, 'true') === 'true'
      ? dryRunSmsProvider()
      : realSmsProvider(config),
};