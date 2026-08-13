import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { UserDto } from '@bsafe/shared-types';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { PrismaService } from '../prisma/prisma.service';
import { FirebaseAdminService } from './firebase-admin.service';

function toUserDto(user: {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  firebaseUid: string;
  createdAt: Date;
}): UserDto {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    firebaseUid: user.firebaseUid,
    createdAt: user.createdAt.toISOString(),
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly firebase: FirebaseAdminService,
    private readonly prisma: PrismaService,
  ) {}

  /** Verify a Firebase ID token and return its claims. */
  async verify(idToken: string): Promise<DecodedIdToken> {
    if (!this.firebase.isConfigured()) {
      throw new ServiceUnavailableException('Firebase auth is not configured on this server.');
    }
    return this.firebase.verifyIdToken(idToken);
  }

  /**
   * Create or link a local `users` row for an authenticated Firebase user.
   * First login (or any later login) upserts the row keyed by firebase_uid.
   */
  async syncUser(uid: string, claims: DecodedIdToken): Promise<UserDto> {
    const existing = await this.prisma.user.findUnique({ where: { firebaseUid: uid } });
    if (existing) return toUserDto(existing);

    const email = claims.email ?? null;
    if (email) {
      const byEmail = await this.prisma.user.findUnique({ where: { email } });
      if (byEmail) {
        const linked = await this.prisma.user.update({
          where: { id: byEmail.id },
          data: { firebaseUid: uid },
        });
        return toUserDto(linked);
      }
    }

    try {
      const user = await this.prisma.user.create({
        data: {
          firebaseUid: uid,
          name: claims.name ?? 'Anonymous',
          email,
          phone: claims.phone_number ?? null,
        },
      });
      return toUserDto(user);
    } catch (e) {
      // Concurrent sign-in raced us to the create — fall back to the row.
      if ((e as { code?: string }).code === 'P2002') {
        const user = await this.prisma.user.findUniqueOrThrow({ where: { firebaseUid: uid } });
        return toUserDto(user);
      }
      throw e;
    }
  }

  /** Load the local user row for an authenticated Firebase user. */
  async findByFirebaseUid(uid: string): Promise<UserDto> {
    const user = await this.prisma.user.findUnique({ where: { firebaseUid: uid } });
    if (!user) {
      throw new NotFoundException('No local user record for this Firebase account — call POST /auth/sync first.');
    }
    return toUserDto(user);
  }
}