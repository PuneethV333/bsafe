import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { FirebaseAdminService } from '../../auth/firebase-admin.service';

/**
 * Verifies the caller's Firebase ID token (`Authorization: Bearer <token>`) and
 * attaches the decoded claims to `request.firebaseUser`. Unauthenticated or
 * invalid tokens → 401; Firebase not configured → 503.
 */
@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(private readonly firebase: FirebaseAdminService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
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
      (request as FireAuthRequest).firebaseUser = claims;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired Firebase ID token.');
    }
  }
}

export interface FireAuthRequest {
  firebaseUser?: DecodedIdToken | undefined;
}