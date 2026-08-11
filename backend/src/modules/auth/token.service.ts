import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { RefreshToken } from './entities/refresh-token.entity';
import type { ITokenService, TokenPayload } from './interfaces/token.service.interface';

@Injectable()
export class TokenService implements ITokenService {
  private readonly BCRYPT_ROUNDS = 10;
  private readonly REFRESH_EXPIRES_DAYS = 30;

  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
  ) {}

  generateAccessToken(payload: TokenPayload): string {
    const expiresIn = process.env.JWT_ACCESS_EXPIRES_IN ?? '3600';
    return this.jwtService.sign(payload, {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: Number.isNaN(Number(expiresIn)) ? 3600 : Number(expiresIn),
    });
  }

  async generateRefreshToken(userId: string, deviceId?: string): Promise<string> {
    const expiresDays = this.REFRESH_EXPIRES_DAYS;
    const raw = this.jwtService.sign(
      { sub: userId },
      {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: expiresDays * 24 * 60 * 60, // 초 단위
      },
    );

    const hashed = await bcrypt.hash(raw, this.BCRYPT_ROUNDS);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.REFRESH_EXPIRES_DAYS);

    await this.refreshTokenRepository.save(
      this.refreshTokenRepository.create({
        userId,
        token: hashed,
        expiresAt,
        revokedAt: null,
        lastUsedAt: null,
        deviceId: deviceId?.slice(0, 128) ?? null,
      }),
    );

    return raw;
  }

  verifyAccessToken(token: string): TokenPayload {
    try {
      return this.jwtService.verify<TokenPayload>(token, {
        secret: process.env.JWT_ACCESS_SECRET,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }

  async validateRefreshToken(rawToken: string, userId: string): Promise<boolean> {
    const stored = await this.refreshTokenRepository.find({ where: { userId } });
    for (const record of stored) {
      if (record.revokedAt || record.expiresAt < new Date()) continue;
      const match = await bcrypt.compare(rawToken, record.token);
      if (match) {
        record.lastUsedAt = new Date();
        await this.refreshTokenRepository.save(record);
        return true;
      }
    }
    return false;
  }

  async revokeRefreshToken(rawToken: string): Promise<boolean> {
    const all = await this.refreshTokenRepository.find();
    for (const record of all) {
      if (record.revokedAt) continue;
      const match = await bcrypt.compare(rawToken, record.token);
      if (match) {
        record.revokedAt = new Date();
        await this.refreshTokenRepository.save(record);
        return true;
      }
    }
    return false;
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    await this.refreshTokenRepository
      .createQueryBuilder()
      .update(RefreshToken)
      .set({ revokedAt: new Date() })
      .where('"userId" = :userId', { userId })
      .andWhere('"revokedAt" IS NULL')
      .execute();
  }
}
