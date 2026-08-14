import type { AlertLocationDto } from '@bsafe/shared-types';
import { io, type Socket } from 'socket.io-client';

export interface AlertSocketPayload {
  alertId: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
}

/**
 * Open an authenticated Socket.IO connection for live alert streaming.
 * The handshake is rejected server-side unless `token` is a valid Firebase ID token.
 */
export function openAlertSocket(token: string): Socket {
  return io({ auth: { token } });
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
