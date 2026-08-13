import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { FireAuthRequest } from '../guards/firebase-auth.guard';

/**
 * `@CurrentUser()` → full decoded Firebase claims.
 * `@CurrentUser('uid')` → just that claim.
 */
export const CurrentUser = createParamDecorator(
  (field: keyof DecodedIdToken | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<FireAuthRequest>();
    const claims = request.firebaseUser;
    return claims ? (field ? claims[field] : claims) : undefined;
  },
);