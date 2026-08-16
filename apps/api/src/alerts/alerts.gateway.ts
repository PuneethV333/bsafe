import {
  BadRequestException,
  Logger,
} from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { FirebaseAdminService } from '../auth/firebase-admin.service';
import { UsersService } from '../users/users.service';
import { AlertsService } from './alerts.service';

/** WebSocket is not covered by @nestjs/throttler — throttle here manually. */
const LOCATION_MIN_INTERVAL_MS = 5_000;

interface LocationPayload {
  alertId: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
}

const CORS_ORIGINS = (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

@WebSocketGateway({ cors: { origin: CORS_ORIGINS } })
export class AlertsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(AlertsGateway.name);
  // Known limitation: the per-user location throttle lives in an in-memory Map.
  // Fine for the single-instance Render deploy today; must move to Redis keyed
  // by userId before horizontal scaling (see Improvements.md task 4).
  private readonly lastLocationAt = new Map<string, number>();

  @WebSocketServer()
  private readonly server!: Server;

  constructor(
    private readonly firebase: FirebaseAdminService,
    private readonly users: UsersService,
    private readonly alerts: AlertsService,
  ) {}

  /**
   * Reject the handshake unless a valid Firebase ID token is supplied AND the
   * account has a local user row. `socket.data.userId` (local UUID) is resolved
   * here once — contacts and alerts are keyed by the local id, not the Firebase uid.
   */
  afterInit(server: Server): void {
    server.use((socket, next) => {
      const token = (socket.handshake.auth?.token as string | undefined) ?? '';
      if (!token) {
        return next(new Error('Missing Firebase token.'));
      }
      if (!this.firebase.isConfigured()) {
        return next(new Error('Firebase auth is not configured on this server.'));
      }
      this.firebase
        .verifyIdToken(token)
        .then((claims) =>
          this.users.resolveLocalUserId(claims.uid).then((userId) => ({ claims, userId })),
        )
        .then(({ claims, userId }) => {
          socket.data.uid = claims.uid;
          socket.data.userId = userId;
          next();
        })
        .catch(() => next(new Error('Invalid or expired Firebase ID token.')));
    });
  }

  handleConnection(socket: Socket): void {
    const uid = socket.data.uid as string | undefined;
    if (!uid) {
      this.logger.warn(`Socket ${socket.id} connected without auth — disconnecting.`);
      socket.disconnect(true);
      return;
    }
    this.logger.log(`Socket connected: ${socket.id} (user ${uid.slice(0, 8)}…)`);
  }

  handleDisconnect(socket: Socket): void {
    this.lastLocationAt.delete(socket.id);
  }

  /** Client subscribes to live updates for one of its own alerts. */
  @SubscribeMessage('joinAlert')
  async handleJoin(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: { alertId?: string },
  ): Promise<{ ok: boolean }> {
    if (typeof payload?.alertId !== 'string') {
      throw new BadRequestException('Malformed joinAlert payload.');
    }
    const userId = socket.data.userId as string;
    await this.alerts.findOwned(userId, payload.alertId);
    await socket.join(this.room(payload.alertId));
    return { ok: true };
  }

  /**
   * Live location ping from the trigger client. Ownership-checked, throttled
   * to one per 5s per socket, persisted, then broadcast to the alert's room
   * (contacts join it in Phase 7 via the tracking token).
   */
  @SubscribeMessage('updateLocation')
  async handleLocation(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: LocationPayload,
  ): Promise<{ ok: boolean; recordedAt: string }> {
    const userId = socket.data.userId as string;

    if (
      typeof payload?.alertId !== 'string' ||
      typeof payload?.latitude !== 'number' ||
      typeof payload?.longitude !== 'number'
    ) {
      throw new BadRequestException('Malformed updateLocation payload.');
    }

    const now = Date.now();
    const last = this.lastLocationAt.get(socket.id) ?? 0;
    if (now - last < LOCATION_MIN_INTERVAL_MS) {
      throw new BadRequestException(
        `Location updates throttled — at most one per ${LOCATION_MIN_INTERVAL_MS / 1000}s.`,
      );
    }
    this.lastLocationAt.set(socket.id, now);

    const location = await this.alerts.addLocation(userId, payload.alertId, {
      latitude: payload.latitude,
      longitude: payload.longitude,
      accuracy: payload.accuracy,
    });
    this.server.to(this.room(payload.alertId)).emit('location:update', location);
    return { ok: true, recordedAt: location.recordedAt };
  }

  private room(alertId: string): string {
    return `alert:${alertId}`;
  }
}