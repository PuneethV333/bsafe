import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { FirebaseAdminService } from '../../auth/firebase-admin.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * Verifies the caller's Firebase ID token (`Authorization: Bearer <token>`) and
 * attaches the decoded claims to `request.firebaseUser`. Routes marked `@Public()`
 * bypass verification. Unauthenticated/invalid tokens → 401; Firebase unconfigured → 503.
 *
 * Registered as a global guard so it runs BEFORE the throttler, which tracks
 * per-user when `request.firebaseUser.uid` is present.
 */
@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(
    private readonly firebase: FirebaseAdminService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    if (!this.firebase.isConfigured()) {
      throw new ServiceUnavailableException('Firebase auth is not configured on this server.');
    }

    const request = context.switchToHttp().getRequest<FireAuthRequest & { headers?: Record<string, unknown> }>();
    const header = String(request.headers?.authorization ?? '');
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Missing or malformed Authorization header.');
    }

    try {
      const claims: DecodedIdToken = await this.firebase.verifyIdToken(token);
      request.firebaseUser = claims;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired Firebase ID token.');
    }
  }
}

export interface FireAuthRequest {
  firebaseUser?: DecodedIdToken | undefined;
}