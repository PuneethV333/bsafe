import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { EmergencyContactDto } from '@bsafe/shared-types';
import { CacheService } from '../cache/cache.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContactDto, UpdateContactDto } from './dto';

const CONTACTS_CACHE_TTL_SECONDS = 30;
const MAX_CONTACTS = 5;

@Injectable()
export class ContactsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  /** List the user's trusted contacts (cached 30s). */
  async list(userId: string): Promise<EmergencyContactDto[]> {
    const cacheKey = this.cacheKey(userId);
    const cached = await this.cache.get<EmergencyContactDto[]>(cacheKey);
    if (cached) return cached;

    const contacts = await this.prisma.emergencyContact.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
    const dto = contacts.map(toContactDto);
    await this.cache.set(cacheKey, dto, CONTACTS_CACHE_TTL_SECONDS);
    return dto;
  }

  /** Add a contact. Enforces the 5-contact cap and dedupe by phone/email. */
  async create(userId: string, dto: CreateContactDto): Promise<EmergencyContactDto> {
    const count = await this.prisma.emergencyContact.count({ where: { userId } });
    if (count >= MAX_CONTACTS) {
      throw new BadRequestException(`Maximum of ${MAX_CONTACTS} contacts allowed.`);
    }

    await this.assertNoDuplicate(userId, dto.phone, dto.email ?? null);

    try {
      const created = await this.prisma.emergencyContact.create({
        data: {
          userId,
          name: dto.name,
          phone: dto.phone,
          email: dto.email ?? null,
          relationship: dto.relationship ?? null,
        },
      });
      await this.invalidate(userId);
      return toContactDto(created);
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002') {
        throw new ConflictException('A contact with this phone or email already exists.');
      }
      throw e;
    }
  }

  /** Edit a contact owned by this user. */
  async update(userId: string, id: string, dto: UpdateContactDto): Promise<EmergencyContactDto> {
    const contact = await this.findOwned(userId, id);
    await this.assertNoDuplicate(userId, dto.phone ?? null, dto.email ?? null, id);

    const updated = await this.prisma.emergencyContact.update({
      where: { id: contact.id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.email !== undefined && { email: dto.email ?? null }),
        ...(dto.relationship !== undefined && { relationship: dto.relationship ?? null }),
      },
    });
    await this.invalidate(userId);
    return toContactDto(updated);
  }

  /** Remove a contact owned by this user. */
  async remove(userId: string, id: string): Promise<void> {
    const contact = await this.findOwned(userId, id);
    await this.prisma.emergencyContact.delete({ where: { id: contact.id } });
    await this.invalidate(userId);
  }

  private async findOwned(userId: string, id: string) {
    const contact = await this.prisma.emergencyContact.findUnique({ where: { id } });
    if (!contact || contact.userId !== userId) {
      throw new NotFoundException('Contact not found.');
    }
    return contact;
  }

  /** Pre-flight duplicate check (unique constraints are the backstop). */
  private async assertNoDuplicate(
    userId: string,
    phone: string | null,
    email: string | null,
    excludeId?: string,
  ) {
    const or: Array<{ phone: string } | { email: string }> = [];
    if (phone) or.push({ phone });
    if (email) or.push({ email });
    if (or.length === 0) return;

    const existing = await this.prisma.emergencyContact.findFirst({
      where: { userId, OR: or, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
    });
    if (existing) throw new ConflictException('A contact with this phone or email already exists.');
  }

  private cacheKey(userId: string): string {
    return `contacts:${userId}`;
  }

  private async invalidate(userId: string): Promise<void> {
    await this.cache.del(this.cacheKey(userId));
  }
}

function toContactDto(contact: {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  relationship: string | null;
}): EmergencyContactDto {
  return {
    id: contact.id,
    name: contact.name,
    phone: contact.phone,
    email: contact.email,
    relationship: contact.relationship,
  };
}