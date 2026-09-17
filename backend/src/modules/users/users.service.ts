import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuthProvider, User, UserRole } from './entities/user.entity';
import type { GoogleUserInfo } from '../auth/interfaces/google-auth.service.interface';
import { RefreshToken } from '../auth/entities/refresh-token.entity';
import { AuthAuditLog } from '../auth/entities/auth-audit-log.entity';
import { AnalyticsEvent } from '../analytics/entities/analytics-event.entity';
import { EpisodePlayLog } from '../episodes/entities/episode-play-log.entity';
import { CardNewsViewLog } from '../card-news/entities/card-news-view-log.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async findByProvider(provider: AuthProvider, providerId: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { provider, providerId },
    });
  }

  async findExisting(info: GoogleUserInfo): Promise<User | null> {
    return (
      (await this.findByProvider(AuthProvider.GOOGLE, info.googleId)) ??
      this.findByEmail(info.email)
    );
  }

  async findOrCreate(info: GoogleUserInfo): Promise<User> {
    const existing = await this.findExisting(info);

    if (existing) {
      existing.nickname = info.name;
      existing.profileImageUrl = info.profileImageUrl;
      existing.provider = AuthProvider.GOOGLE;
      existing.providerId = info.googleId;
      existing.isActive = true;
      existing.lastLoginAt = new Date();

      return this.usersRepository.save(existing);
    }

    return this.usersRepository.save(
      this.usersRepository.create({
        email: info.email,
        nickname: info.name,
        profileImageUrl: info.profileImageUrl,
        provider: AuthProvider.GOOGLE,
        providerId: info.googleId,
        role: UserRole.USER,
        isActive: true,
        timezone: 'Asia/Seoul',
        lastLoginAt: new Date(),
      }),
    );
  }

  async deleteAccount(userId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.delete(RefreshToken, { userId });
      await manager.delete(AnalyticsEvent, { userId });
      await manager.delete(EpisodePlayLog, { userId });
      await manager.delete(CardNewsViewLog, { userId });
      await manager.delete(AuthAuditLog, { userId });
      await manager.delete(User, { id: userId });
    });
  }
}
