import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { GoogleAuthService } from './google-auth.service';
import { UsersService } from '../users/users.service';
import { TokenService } from './token.service';
import { AuthProvider, UserRole } from '../users/entities/user.entity';

const mockGoogleAuthService = () => ({
  verify: jest.fn(),
  verifyAccessToken: jest.fn(),
});

const mockUsersService = () => ({
  findOrCreate: jest.fn(),
  findById: jest.fn(),
});

const mockTokenService = () => ({
  generateAccessToken: jest.fn(),
  generateRefreshToken: jest.fn(),
  validateRefreshToken: jest.fn(),
  revokeRefreshToken: jest.fn(),
});

describe('AuthService', () => {
  let service: AuthService;
  let usersService: ReturnType<typeof mockUsersService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: GoogleAuthService, useFactory: mockGoogleAuthService },
        { provide: UsersService, useFactory: mockUsersService },
        { provide: TokenService, useFactory: mockTokenService },
      ],
    }).compile();

    service = module.get(AuthService);
    usersService = module.get(UsersService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('me', () => {
    it('사용자 프로필 필드를 반환한다', async () => {
      const lastLoginAt = new Date('2026-03-20T14:00:00.000Z');
      const createdAt = new Date('2026-03-19T00:00:00.000Z');
      const updatedAt = new Date('2026-03-20T14:05:00.000Z');

      usersService.findById.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        nickname: '테스트',
        profileImageUrl: 'https://example.com/profile.png',
        provider: AuthProvider.GOOGLE,
        providerId: 'google-123',
        role: UserRole.USER,
        isActive: true,
        timezone: 'Asia/Seoul',
        lastLoginAt,
        createdAt,
        updatedAt,
      });

      await expect(service.me('user-1')).resolves.toEqual({
        userId: 'user-1',
        email: 'user@example.com',
        nickname: '테스트',
        profileImageUrl: 'https://example.com/profile.png',
        provider: AuthProvider.GOOGLE,
        providerId: 'google-123',
        role: UserRole.USER,
        isActive: true,
        timezone: 'Asia/Seoul',
        lastLoginAt,
        createdAt,
        updatedAt,
      });
    });

    it('사용자가 없으면 UnauthorizedException을 던진다', async () => {
      usersService.findById.mockResolvedValue(null);

      await expect(service.me('missing-user')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });
});
