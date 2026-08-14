export type AlertStatus = 'sent' | 'acknowledged' | 'resolved';

export interface UserDto {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  firebaseUid: string;
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
