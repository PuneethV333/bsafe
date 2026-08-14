export type AlertStatus = 'sent' | 'acknowledged' | 'resolved';

export interface UserDto {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  firebaseUid: string;
  isAdmin: boolean;
  createdAt: string;
}

export interface EmergencyContactDto {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  relationship?: string | null;
}

export interface AlertLocationDto {
  id: string;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  recordedAt: string;
}

export interface AlertDto {
  id: string;
  status: AlertStatus;
  triggeredAt: string;
  resolvedAt?: string | null;
  lastLocation?: AlertLocationDto | null;
  locationCount: number;
}

export type AlertListItemDto = AlertDto;

export type TriggerType = 'tap' | 'longPress';

export interface TriggerAlertInput {
  triggerType?: TriggerType;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
}

export interface UpdateLocationInput {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export type AlertStatusUpdate = Extract<AlertStatus, 'acknowledged' | 'resolved'>;

export type NotificationChannel = 'sms' | 'email';
export type NotificationStatus = 'queued' | 'sent' | 'failed';

export interface NotificationDeliveryDto {
  id: string;
  contactId: string;
  contactName: string;
  channel: NotificationChannel;
  status: NotificationStatus;
  attempts: number;
  lastError?: string | null;
  sentAt?: string | null;
  createdAt: string;
}

/** Public, tokenized tracking view (what a contact sees at /track/:token). */
export interface AlertTrackingDto {
  id: string;
  status: AlertStatus;
  userName: string;
  triggeredAt: string;
  resolvedAt?: string | null;
  lastLocation?: AlertLocationDto | null;
  locationCount: number;
}

/** One row of the admin alert table (cross-user). */
export interface AdminAlertRowDto {
  id: string;
  status: AlertStatus;
  userName: string;
  userEmail?: string | null;
  triggeredAt: string;
  acknowledgedAt?: string | null;
  resolvedAt?: string | null;
  locationCount: number;
  deliveriesSent: number;
  deliveriesFailed: number;
}

/** Read-only admin KPI reporting. */
export interface AdminReportDto {
  totals: {
    alerts: number;
    acknowledged: number;
    resolved: number;
  };
  activeNow: number;
  ackRate: number;
  alertsPerDay: { day: string; count: number }[];
  avgAcknowledgeMinutes?: number | null;
  avgResolveMinutes?: number | null;
}
