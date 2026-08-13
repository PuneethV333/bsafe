import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import type { UserDto } from '@bsafe/shared-types';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { FirebaseAuthGuard } from '../common/guards/firebase-auth.guard';
import { AuthService } from './auth.service';

@Controller('auth')
@UseGuards(FirebaseAuthGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Link/create the local user row for the caller's Firebase account.
   * The Firebase ID token travels in `Authorization: Bearer <token>`.
   */
  @Post('sync')
  sync(@CurrentUser() claims: DecodedIdToken): Promise<UserDto> {
    return this.authService.syncUser(claims.uid, claims);
  }

  /** Current session's user record (requires a prior /auth/sync). */
  @Get('me')
  me(@CurrentUser('uid') uid: string): Promise<UserDto> {
    return this.authService.findByFirebaseUid(uid);
  }
}