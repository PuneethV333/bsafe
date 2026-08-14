import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { EmergencyContactDto } from '@bsafe/shared-types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UsersService } from '../users/users.service';
import { ContactsService } from './contacts.service';
import { CreateContactDto, UpdateContactDto } from './dto';

@Controller('contacts')
export class ContactsController {
  constructor(
    private readonly contacts: ContactsService,
    private readonly users: UsersService,
  ) {}

  /** List trusted contacts (cached 30s). */
  @Get()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async list(@CurrentUser('uid') uid: string): Promise<EmergencyContactDto[]> {
    const userId = await this.users.resolveLocalUserId(uid);
    return this.contacts.list(userId);
  }

  /** Add a contact. Max 5 per user; duplicates by phone/email rejected (409). */
  @Post()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async create(
    @CurrentUser('uid') uid: string,
    @Body() dto: CreateContactDto,
  ): Promise<EmergencyContactDto> {
    const userId = await this.users.resolveLocalUserId(uid);
    return this.contacts.create(userId, dto);
  }

  @Patch(':id')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async update(
    @CurrentUser('uid') uid: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateContactDto,
  ): Promise<EmergencyContactDto> {
    const userId = await this.users.resolveLocalUserId(uid);
    return this.contacts.update(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async remove(
    @CurrentUser('uid') uid: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    const userId = await this.users.resolveLocalUserId(uid);
    await this.contacts.remove(userId, id);
  }
}