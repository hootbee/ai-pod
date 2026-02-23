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

  async loginWithGoogle(idToken: string): Promise<TokenPair> {
    const googleUser = await this.googleAuthService.verify(idToken);
    const user = await this.usersService.findOrCreate(googleUser);

    const accessToken = this.tokenService.generateAccessToken({
      sub: user.id,
      email: user.email,
    });
    const refreshToken = await this.tokenService.generateRefreshToken(user.id);

    return { accessToken, refreshToken };
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
    });
    const newRefreshToken = await this.tokenService.generateRefreshToken(user.id);

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  }

  async logout(userId: string, refreshToken: string): Promise<void> {
    await this.tokenService.revokeRefreshToken(refreshToken);
  }
}
