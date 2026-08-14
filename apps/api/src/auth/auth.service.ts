import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { UserDto } from '@bsafe/shared-types';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { CacheService } from '../cache/cache.service';
import { PrismaService } from '../prisma/prisma.service';
import { FirebaseAdminService } from './firebase-admin.service';

const PROFILE_CACHE_TTL_SECONDS = 60;

function toUserDto(user: {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  firebaseUid: string;
  isAdmin: boolean;
  createdAt: Date;
}): UserDto {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    firebaseUid: user.firebaseUid,
    isAdmin: user.isAdmin,
    createdAt: user.createdAt.toISOString(),
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly firebase: FirebaseAdminService,
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly config: ConfigService,
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
   * Emails listed in ADMIN_EMAILS are granted `isAdmin` on every sync.
   */
  async syncUser(uid: string, claims: DecodedIdToken): Promise<UserDto> {
    const listed = this.isListedAdmin(claims.email);

    const existing = await this.prisma.user.findUnique({ where: { firebaseUid: uid } });
    if (existing) {
      if (listed && !existing.isAdmin) {
        const promoted = await this.prisma.user.update({
          where: { id: existing.id },
          data: { isAdmin: true },
        });
        await this.cache.del(`profile:${uid}`);
        return toUserDto(promoted);
      }
      return toUserDto(existing);
    }

    const email = claims.email ?? null;
    if (email) {
      const byEmail = await this.prisma.user.findUnique({ where: { email } });
      if (byEmail) {
        const linked = await this.prisma.user.update({
          where: { id: byEmail.id },
          data: { firebaseUid: uid, isAdmin: listed || byEmail.isAdmin },
        });
        await this.cache.del(`profile:${uid}`);
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
          isAdmin: listed,
        },
      });
      await this.cache.del(`profile:${uid}`);
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

  private isListedAdmin(email?: string | null): boolean {
    if (!email) return false;
    const allowlist = this.config
      .get<string>('ADMIN_EMAILS', '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    return allowlist.includes(email.toLowerCase());
  }

  /** Load the local user row for an authenticated Firebase user (cached 60s). */
  async findByFirebaseUid(uid: string): Promise<UserDto> {
    const cacheKey = `profile:${uid}`;
    const cached = await this.cache.get<UserDto>(cacheKey);
    if (cached) return cached;

    const user = await this.prisma.user.findUnique({ where: { firebaseUid: uid } });
    if (!user) {
      throw new NotFoundException('No local user record for this Firebase account — call POST /auth/sync first.');
    }
    const dto = toUserDto(user);
    await this.cache.set(cacheKey, dto, PROFILE_CACHE_TTL_SECONDS);
    return dto;
  }
}