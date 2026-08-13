import { Controller, Get, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { UserDto } from '@bsafe/shared-types';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Link/create the local user row for the caller's Firebase account.
   * The Firebase ID token travels in `Authorization: Bearer <token>`.
   */
  @Post('sync')
  @Throttle({ default: { limit: 10, ttl: 60_000, getTracker: (req) => String(req.ip ?? 'unknown') } })
  sync(@CurrentUser() claims: DecodedIdToken): Promise<UserDto> {
    return this.authService.syncUser(claims.uid, claims);
  }

  /** Current session's user record (requires a prior /auth/sync). */
  @Get('me')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  me(@CurrentUser('uid') uid: string): Promise<UserDto> {
    return this.authService.findByFirebaseUid(uid);
  }
}