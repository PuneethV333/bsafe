import { Injectable, NotFoundException } from '@nestjs/common';
import type { UserDto } from '@bsafe/shared-types';
import { CacheService } from '../cache/cache.service';
import { PrismaService } from '../prisma/prisma.service';
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
}

export function toUserDto(user: {
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