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

export interface AlertDto {
  id: string;
  status: AlertStatus;
  triggeredAt: string;
  resolvedAt?: string | null;
}
