import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { withReadRetry } from './retry';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      // Neon (and most pooled Pg hosts) close idle server connections. Without
      // a short idle timeout pg keeps handing out sockets the server already
      // dropped, and the next query fails with ETIMEDOUT. Recycling sockets
      // well before the server does makes those failures disappear.
      adapter: new PrismaPg({
        connectionString: process.env.DATABASE_URL,
        max: 5,
        idleTimeoutMillis: 10_000,
        connectionTimeoutMillis: 10_000,
      }),
    });
  }

  /**
   * The very first query after boot can still race the pool's cold start, so
   * warm it during startup — that cost should never be paid by an SOS request.
   */
  async onModuleInit(): Promise<void> {
    try {
      await withReadRetry(() => this.user.findFirst({ select: { id: true } }), 5, 500);
      this.logger.log('Database connection verified.');
    } catch (error) {
      const { code, message } = error as { code?: string; message?: string };
      this.logger.error(
        `Database not reachable at boot (${code ?? 'unknown'}): ${message ?? 'no detail'}`,
      );
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}