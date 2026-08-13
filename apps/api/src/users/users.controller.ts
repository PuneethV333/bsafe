import { Body, Controller, Get, Patch } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { UserDto } from '@bsafe/shared-types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  /** Get profile (cached 60s). */
  @Get('me')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  me(@CurrentUser('uid') uid: string): Promise<UserDto> {
    return this.users.getProfile(uid);
  }

  /** Update profile (name, phone); invalidates the profile cache. */
  @Patch('me')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  updateMe(@CurrentUser('uid') uid: string, @Body() dto: UpdateUserDto): Promise<UserDto> {
    return this.users.updateProfile(uid, dto);
  }
}