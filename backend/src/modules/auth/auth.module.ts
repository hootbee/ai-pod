import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleAuthService } from './google-auth.service';
import { TokenService } from './token.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { RefreshToken } from './entities/refresh-token.entity';
import { AuthAuditLog } from './entities/auth-audit-log.entity';
import { AuthAuditService } from './auth-audit.service';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({}),
    TypeOrmModule.forFeature([RefreshToken, AuthAuditLog]),
    UsersModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthAuditService, GoogleAuthService, TokenService, JwtStrategy],
  exports: [JwtStrategy],
})
export class AuthModule {}
