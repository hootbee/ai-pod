import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { GoogleAuthService } from './google-auth.service';
import { TokenService } from './token.service';
import { AuthAuditService } from './auth-audit.service';
import { AuthAuditEventType } from './entities/auth-audit-log.entity';
import type { AuthAuditContext } from './auth-audit.service';
import type { IAuthService } from './interfaces/auth.service.interface';
import type { TokenPair } from './interfaces/token.service.interface';

@Injectable()
export class AuthService implements IAuthService {
  constructor(
    private readonly googleAuthService: GoogleAuthService,
    private readonly usersService: UsersService,
    private readonly tokenService: TokenService,
    private readonly authAuditService: AuthAuditService,
  ) {}

  async loginWithGoogle(
    idToken?: string,
    googleAccessToken?: string,
    context?: AuthAuditContext,
  ): Promise<TokenPair> {
    if (!idToken && !googleAccessToken) {
      await this.authAuditService.record({
        ...context,
        eventType: AuthAuditEventType.LOGIN_FAILURE,
        provider: 'google',
        failureReason: 'missing_credentials',
      });
      throw new UnauthorizedException('idToken or accessToken is required');
    }

    try {
      const googleUser = idToken
        ? await this.googleAuthService.verify(idToken)
        : await this.googleAuthService.verifyAccessToken(googleAccessToken!);
      const user = await this.usersService.findOrCreate(googleUser);

      const issuedAccessToken = this.tokenService.generateAccessToken({
        sub: user.id,
        email: user.email,
        role: user.role,
      });
      const refreshToken = await this.tokenService.generateRefreshToken(user.id, context?.deviceId);

      await this.authAuditService.record({
        ...context,
        userId: user.id,
        eventType: AuthAuditEventType.LOGIN_SUCCESS,
        provider: 'google',
      });

      return { accessToken: issuedAccessToken, refreshToken };
    } catch (error) {
      await this.authAuditService.record({
        ...context,
        eventType: AuthAuditEventType.LOGIN_FAILURE,
        provider: 'google',
        failureReason: 'provider_verification_or_token_issue',
      });
      throw error;
    }
  }

  async refresh(refreshToken: string, context?: AuthAuditContext): Promise<TokenPair> {
    let userId: string | null = null;
    let payload: { sub: string };
    try {
      const { JwtService } = await import('@nestjs/jwt');
      const jwt = new JwtService({});
      payload = jwt.verify<{ sub: string }>(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
      userId = payload.sub;
    } catch {
      await this.authAuditService.record({
        ...context,
        eventType: AuthAuditEventType.REFRESH_FAILURE,
        failureReason: 'invalid_refresh_token',
      });
      throw new UnauthorizedException('Invalid refresh token');
    }

    const isValid = await this.tokenService.validateRefreshToken(refreshToken, payload.sub);
    if (!isValid) {
      await this.authAuditService.record({
        ...context,
        userId,
        eventType: AuthAuditEventType.REFRESH_FAILURE,
        failureReason: 'refresh_token_not_found_or_expired',
      });
      throw new UnauthorizedException('Refresh token not found or expired');
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      await this.authAuditService.record({
        ...context,
        userId,
        eventType: AuthAuditEventType.REFRESH_FAILURE,
        failureReason: 'user_not_found',
      });
      throw new UnauthorizedException('User not found');
    }

    try {
      await this.tokenService.revokeRefreshToken(refreshToken);

      const newAccessToken = this.tokenService.generateAccessToken({
        sub: user.id,
        email: user.email,
        role: user.role,
      });
      const newRefreshToken = await this.tokenService.generateRefreshToken(
        user.id,
        context?.deviceId,
      );

      await this.authAuditService.record({
        ...context,
        userId: user.id,
        eventType: AuthAuditEventType.REFRESH_SUCCESS,
      });

      return { accessToken: newAccessToken, refreshToken: newRefreshToken };
    } catch (error) {
      await this.authAuditService.record({
        ...context,
        userId: user.id,
        eventType: AuthAuditEventType.REFRESH_FAILURE,
        failureReason: 'token_rotation_failed',
      });
      throw error;
    }
  }

  async logout(userId: string, refreshToken: string, context?: AuthAuditContext): Promise<void> {
    try {
      const revoked = await this.tokenService.revokeRefreshToken(refreshToken);
      await this.authAuditService.record({
        ...context,
        userId,
        eventType: revoked ? AuthAuditEventType.LOGOUT_SUCCESS : AuthAuditEventType.LOGOUT_FAILURE,
        ...(revoked ? {} : { failureReason: 'refresh_token_not_found' }),
      });
    } catch (error) {
      await this.authAuditService.record({
        ...context,
        userId,
        eventType: AuthAuditEventType.LOGOUT_FAILURE,
        failureReason: 'token_revoke_failed',
      });
      throw error;
    }
  }

  async me(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      userId: user.id,
      email: user.email,
      nickname: user.nickname,
      profileImageUrl: user.profileImageUrl,
      provider: user.provider,
      providerId: user.providerId,
      role: user.role,
      isActive: user.isActive,
      timezone: user.timezone,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
