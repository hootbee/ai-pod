import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
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

  async findByGoogleId(googleId: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { googleId } });
  }

  async findOrCreate(info: GoogleUserInfo): Promise<User> {
    const existing = await this.findByGoogleId(info.googleId);
    if (existing) return existing;

    return this.usersRepository.save(
      this.usersRepository.create({
        googleId: info.googleId,
        email: info.email,
        name: info.name,
        profileImageUrl: info.profileImageUrl,
      }),
    );
  }
}
