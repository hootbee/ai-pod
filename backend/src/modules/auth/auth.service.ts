import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { GoogleAuthService } from './google-auth.service';
import { TokenService } from './token.service';
import type { IAuthService } from './interfaces/auth.service.interface';
import type { TokenPair } from './interfaces/token.service.interface';

@Injectable()
export class AuthService implements IAuthService {
  constructor(
    private readonly googleAuthService: GoogleAuthService,
    private readonly usersService: UsersService,
    private readonly tokenService: TokenService,
  ) {}

  async loginWithGoogle(idToken?: string, googleAccessToken?: string): Promise<TokenPair> {
    if (!idToken && !googleAccessToken) {
      throw new UnauthorizedException('idToken or accessToken is required');
    }

    const googleUser = idToken
      ? await this.googleAuthService.verify(idToken)
      : await this.googleAuthService.verifyAccessToken(googleAccessToken!);
    const user = await this.usersService.findOrCreate(googleUser);

    const issuedAccessToken = this.tokenService.generateAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    const refreshToken = await this.tokenService.generateRefreshToken(user.id);

    return { accessToken: issuedAccessToken, refreshToken };
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    let payload: { sub: string };
    try {
      const { JwtService } = await import('@nestjs/jwt');
      const jwt = new JwtService({});
      payload = jwt.verify<{ sub: string }>(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const isValid = await this.tokenService.validateRefreshToken(
      refreshToken,
      payload.sub,
    );
    if (!isValid) {
      throw new UnauthorizedException('Refresh token not found or expired');
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    await this.tokenService.revokeRefreshToken(refreshToken);

    const newAccessToken = this.tokenService.generateAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    const newRefreshToken = await this.tokenService.generateRefreshToken(user.id);

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  }

  async logout(userId: string, refreshToken: string): Promise<void> {
    await this.tokenService.revokeRefreshToken(refreshToken);
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
