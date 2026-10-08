export const SMS_PROVIDER = 'SMS_PROVIDER';
export const NOTIFICATIONS_DRY_RUN = 'NOTIFICATIONS_DRY_RUN';

export interface SmsProvider {
  name: string;
  sendSms(to: string, body: string): Promise<void>;
}