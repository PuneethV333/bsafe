import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { cert, deleteApp, initializeApp } from 'firebase-admin';
import type { App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import type { DecodedIdToken } from 'firebase-admin/auth';

/**
 * Wraps the Firebase Admin SDK. The app is only initialised when all three
 * credential env vars are present (dev works without them), so every auth path
 * must guard with `isConfigured()`.
 */
@Injectable()
export class FirebaseAdminService implements OnModuleDestroy {
  private readonly logger = new Logger(FirebaseAdminService.name);
  private readonly app: App | null;

  constructor(private readonly config: ConfigService) {
    const projectId = this.config.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.config.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey = this.config.get<string>('FIREBASE_PRIVATE_KEY');

    if (projectId && clientEmail && privateKey) {
      this.app = initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey: privateKey.replace(/\\n/g, '\n'),
        }),
      });
      this.logger.log('Firebase Admin SDK initialised.');
    } else {
      this.app = null;
      this.logger.warn(
        'Firebase Admin SDK NOT initialised (missing FIREBASE_* env vars). Auth endpoints will 503.',
      );
    }
  }

  /** Whether Firebase auth is usable on this server. */
  isConfigured(): boolean {
    return this.app !== null;
  }

  /** Verify a Firebase ID token. Throws when the token is invalid/expired. */
  async verifyIdToken(idToken: string): Promise<DecodedIdToken> {
    if (!this.app) {
      throw new Error('Firebase Admin SDK is not configured.');
    }
    return getAuth(this.app).verifyIdToken(idToken);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.app) {
      await deleteApp(this.app);
      this.logger.log('Firebase Admin SDK shut down.');
    }
  }
}