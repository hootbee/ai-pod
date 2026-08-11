import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { GoogleAuthService } from './google-auth.service';
import { UsersService } from '../users/users.service';
import { TokenService } from './token.service';
import { AuthProvider, UserRole } from '../users/entities/user.entity';
import { AuthAuditService } from './auth-audit.service';
import { AuthAuditEventType } from './entities/auth-audit-log.entity';

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

const mockAuthAuditService = () => ({
  record: jest.fn(),
});

describe('AuthService', () => {
  let service: AuthService;
  let usersService: ReturnType<typeof mockUsersService>;
  let googleAuthService: ReturnType<typeof mockGoogleAuthService>;
  let tokenService: ReturnType<typeof mockTokenService>;
  let authAuditService: ReturnType<typeof mockAuthAuditService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: GoogleAuthService, useFactory: mockGoogleAuthService },
        { provide: UsersService, useFactory: mockUsersService },
        { provide: TokenService, useFactory: mockTokenService },
        { provide: AuthAuditService, useFactory: mockAuthAuditService },
      ],
    }).compile();

    service = module.get(AuthService);
    usersService = module.get(UsersService);
    googleAuthService = module.get(GoogleAuthService);
    tokenService = module.get(TokenService);
    authAuditService = module.get(AuthAuditService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('loginWithGoogle', () => {
    it('로그인 성공을 감사 로그에 기록한다', async () => {
      googleAuthService.verify.mockResolvedValue({
        providerId: 'google-123',
        email: 'user@example.com',
        nickname: '테스트',
      });
      usersService.findOrCreate.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        role: UserRole.USER,
      });
      tokenService.generateAccessToken.mockReturnValue('access-token');
      tokenService.generateRefreshToken.mockResolvedValue('refresh-token');
      tokenService.revokeRefreshToken.mockResolvedValue(true);

      await service.loginWithGoogle('id-token', undefined, {
        requestId: 'request-1',
      });

      expect(authAuditService.record).toHaveBeenCalledWith({
        requestId: 'request-1',
        userId: 'user-1',
        eventType: AuthAuditEventType.LOGIN_SUCCESS,
        provider: 'google',
      });
      expect(tokenService.generateRefreshToken).toHaveBeenCalledWith('user-1', undefined);
    });

    it('로그인 정보가 없으면 실패 감사 로그를 기록한다', async () => {
      await expect(service.loginWithGoogle()).rejects.toBeInstanceOf(UnauthorizedException);

      expect(authAuditService.record).toHaveBeenCalledWith({
        eventType: AuthAuditEventType.LOGIN_FAILURE,
        provider: 'google',
        failureReason: 'missing_credentials',
      });
    });
  });

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

      await expect(service.me('missing-user')).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
