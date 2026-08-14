import type { AlertLocationDto } from '@bsafe/shared-types';
import { io, type Socket } from 'socket.io-client';

const API_ORIGIN = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

export interface AlertSocketPayload {
  alertId: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
}

/**
 * Open an authenticated Socket.IO connection for live alert streaming.
 * The handshake is rejected server-side unless `token` is a valid Firebase ID token.
 * Without VITE_API_URL the client stays same-origin (Vite dev proxy / socket.io path).
 */
export function openAlertSocket(token: string): Socket {
  return API_ORIGIN ? io(API_ORIGIN, { auth: { token } }) : io({ auth: { token } });
}

export function joinAlertRoom(socket: Socket, alertId: string): void {
  socket.emit('joinAlert', { alertId });
}

export function pushLocation(socket: Socket, payload: AlertSocketPayload): void {
  socket.emit('updateLocation', payload);
}

export function onLocationUpdate(
  socket: Socket,
  handler: (location: AlertLocationDto) => void,
): () => void {
  socket.on('location:update', handler);
  return () => socket.off('location:update', handler);
}
