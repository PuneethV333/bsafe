import { Global, Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { FirebaseAdminService } from './firebase-admin.service';

@Global()
@Module({
  controllers: [AuthController],
  providers: [FirebaseAdminService, AuthService],
  exports: [FirebaseAdminService, AuthService],
})
export class AuthModule {}