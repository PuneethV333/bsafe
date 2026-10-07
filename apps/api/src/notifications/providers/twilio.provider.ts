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
  const phoneNumber = config.get<string>('TWILIO_PHONE_NUMBER');
  if (!accountSid || !authToken || !phoneNumber) {
    throw new Error(
      'TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_PHONE_NUMBER ' +
        'are required to send SMS (or set NOTIFICATIONS_DRY_RUN=true). ' +
        'TWILIO_PHONE_NUMBER must be a Twilio trial number in E.164 format ' +
        '(e.g. +14155238885) — a Messaging Service is not required.',
    );
  }
  const client: Twilio = twilio(accountSid, authToken);
  const logger = new Logger('TwilioProvider');
  const from = toE164(phoneNumber);

  return {
    name: 'twilio',
    async sendSms(to, body) {
      const message = await client.messages.create({
        to: toE164(to),
        from,
        body,
      });
      logger.log(`SMS queued: sid=${message.sid} to=${to} from=${from}`);
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