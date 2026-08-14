export const SMS_PROVIDER = 'SMS_PROVIDER';
export const EMAIL_PROVIDER = 'EMAIL_PROVIDER';
export const NOTIFICATIONS_DRY_RUN = 'NOTIFICATIONS_DRY_RUN';

export interface SmsProvider {
  name: string;
  sendSms(to: string, body: string): Promise<void>;
}

export interface EmailProvider {
  name: string;
  sendEmail(to: string, subject: string, html: string): Promise<void>;
}