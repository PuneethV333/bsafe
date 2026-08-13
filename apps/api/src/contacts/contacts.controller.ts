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
import { ContactsService } from './contacts.service';
import { CreateContactDto, UpdateContactDto } from './dto';

@Controller('contacts')
export class ContactsController {
  constructor(private readonly contacts: ContactsService) {}

  /** List trusted contacts (cached 30s). */
  @Get()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  list(@CurrentUser('uid') uid: string): Promise<EmergencyContactDto[]> {
    return this.contacts.list(uid);
  }

  /** Add a contact. Max 5 per user; duplicates by phone/email rejected (409). */
  @Post()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  create(
    @CurrentUser('uid') uid: string,
    @Body() dto: CreateContactDto,
  ): Promise<EmergencyContactDto> {
    return this.contacts.create(uid, dto);
  }

  @Patch(':id')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  update(
    @CurrentUser('uid') uid: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateContactDto,
  ): Promise<EmergencyContactDto> {
    return this.contacts.update(uid, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async remove(
    @CurrentUser('uid') uid: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    await this.contacts.remove(uid, id);
  }
}