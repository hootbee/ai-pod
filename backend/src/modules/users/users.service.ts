import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthProvider, User, UserRole } from './entities/user.entity';
import type { GoogleUserInfo } from '../auth/interfaces/google-auth.service.interface';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async findByProvider(
    provider: AuthProvider,
    providerId: string,
  ): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { provider, providerId },
    });
  }

  async findOrCreate(info: GoogleUserInfo): Promise<User> {
    const existing =
      (await this.findByProvider(AuthProvider.GOOGLE, info.googleId)) ??
      (await this.findByEmail(info.email));

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
}
