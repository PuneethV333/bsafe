import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { CacheModule } from './cache/cache.module';
import { FirebaseAuthGuard } from './common/guards/firebase-auth.guard';
import { HealthController } from './health/health.controller';
import { NotificationsModule } from './notifications/notifications.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { RedisThrottlerStorage } from './redis/redis-throttler.storage';
import { RedisService } from './redis/redis.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    RedisModule,
    CacheModule,
    PrismaModule,
    AuthModule,
    NotificationsModule,
    ThrottlerModule.forRootAsync({
      inject: [RedisService],
      useFactory: (redis: RedisService) => ({
        errorMessage: 'Too many requests — please slow down and try again shortly.',
        throttlers: [{ name: 'default', ttl: 60_000, limit: 60 }],
        storage: new RedisThrottlerStorage(redis),
        // Per-user when authenticated (auth guard runs first), otherwise per-IP.
        getTracker: (req) => req.firebaseUser?.uid ?? String(req.ip ?? 'unknown'),
      }),
    }),
  ],
  controllers: [AppController, HealthController],
  providers: [
    { provide: APP_GUARD, useClass: FirebaseAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}