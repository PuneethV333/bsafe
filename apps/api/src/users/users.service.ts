import { Injectable, NotFoundException } from '@nestjs/common';
import type { UserDto } from '@bsafe/shared-types';
import { CacheService } from '../cache/cache.service';
import { PrismaService } from '../prisma/prisma.service';
import { withReadRetry } from '../prisma/retry';
import { UpdateUserDto } from './dto/update-user.dto';

const PROFILE_CACHE_TTL_SECONDS = 60;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async getProfile(firebaseUid: string): Promise<UserDto> {
    const cacheKey = `profile:${firebaseUid}`;
    const cached = await this.cache.get<UserDto>(cacheKey);
    if (cached) return cached;

    const user = await this.prisma.user.findUnique({ where: { firebaseUid } });
    if (!user) throw new NotFoundException('No local user record — call POST /auth/sync first.');
    const dto = toUserDto(user);
    await this.cache.set(cacheKey, dto, PROFILE_CACHE_TTL_SECONDS);
    return dto;
  }

  async updateProfile(firebaseUid: string, dto: UpdateUserDto): Promise<UserDto> {
    const user = await this.prisma.user.findUnique({ where: { firebaseUid } });
    if (!user) throw new NotFoundException('No local user record — call POST /auth/sync first.');

    const phone = dto.phone === undefined ? undefined : dto.phone ?? null;

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { ...(dto.name !== undefined && { name: dto.name }), ...(phone !== undefined && { phone }) },
    });
    await this.cache.del(`profile:${firebaseUid}`);
    return toUserDto(updated);
  }

  /**
   * Resolve a Firebase uid to the local user's UUID — the FK used by
   * `emergency_contacts.user_id` and `alerts.user_id`. Controllers receive the
   * Firebase uid from the ID token, so every write path must go through here.
   */
  async resolveLocalUserId(firebaseUid: string): Promise<string> {
    const user = await withReadRetry(() => this.getProfile(firebaseUid));
    return user.id;
  }
}

export function toUserDto(user: {
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