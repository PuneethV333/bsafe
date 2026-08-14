import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { FireAuthRequest } from './firebase-auth.guard';

/**
 * Authorizes the authenticated caller as an admin (`users.is_admin`).
 * Runs after the global FirebaseAuthGuard, so `request.firebaseUser` is
 * already set; a valid token with a non-admin local user gets 403.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FireAuthRequest>();
    const uid = request.firebaseUser?.uid;
    if (!uid) {
      throw new ForbiddenException('Admin access required.');
    }
    const user = await this.prisma.user.findUnique({
      where: { firebaseUid: uid },
      select: { isAdmin: true },
    });
    if (!user?.isAdmin) {
      throw new ForbiddenException('Admin access required.');
    }
    return true;
  }
}