import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { UsersService } from './users.service';
import { AuthProvider, User, UserRole } from './entities/user.entity';
import { AuthAuditEventType, AuthAuditLog } from '../auth/entities/auth-audit-log.entity';

const mockUserRepository = () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
});

const mockDataSource = () => ({
  transaction: jest.fn(),
});

const mockAuthAuditRepository = () => ({
  create: jest.fn((entity) => entity),
  save: jest.fn().mockResolvedValue(undefined),
});

describe('UsersService', () => {
  let service: UsersService;
  let usersRepository: jest.Mocked<Repository<User>>;
  let authAuditRepository: jest.Mocked<Repository<AuthAuditLog>>;
  let dataSource: { transaction: jest.Mock };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useFactory: mockUserRepository,
        },
        {
          provide: getRepositoryToken(AuthAuditLog),
          useFactory: mockAuthAuditRepository,
        },
        {
          provide: DataSource,
          useFactory: mockDataSource,
        },
      ],
    }).compile();

    service = module.get(UsersService);
    usersRepository = module.get(getRepositoryToken(User));
    authAuditRepository = module.get(getRepositoryToken(AuthAuditLog));
    dataSource = module.get(DataSource);
  });

  afterEach(() => jest.clearAllMocks());

  it('Google 사용자 신규 생성 시 기본 필드를 채운다', async () => {
    const now = new Date('2026-03-20T13:00:00.000Z');
    jest.useFakeTimers().setSystemTime(now);

    usersRepository.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    usersRepository.create.mockImplementation((entity) => entity as User);
    usersRepository.save.mockImplementation(async (entity) => entity as User);

    const result = await service.findOrCreate({
      googleId: 'google-123',
      email: 'user@example.com',
      name: '테스트 유저',
      profileImageUrl: 'https://example.com/profile.png',
    });

    expect(usersRepository.create).toHaveBeenCalledWith({
      email: 'user@example.com',
      nickname: '테스트 유저',
      profileImageUrl: 'https://example.com/profile.png',
      provider: AuthProvider.GOOGLE,
      providerId: 'google-123',
      role: UserRole.USER,
      isActive: true,
      timezone: 'Asia/Seoul',
      lastLoginAt: now,
    });
    expect(result.provider).toBe(AuthProvider.GOOGLE);
    expect(result.role).toBe(UserRole.USER);
    expect(result.lastLoginAt).toEqual(now);

    jest.useRealTimers();
  });

  it('기존 사용자가 있으면 로그인 정보를 갱신한다', async () => {
    const now = new Date('2026-03-20T13:30:00.000Z');
    jest.useFakeTimers().setSystemTime(now);

    const existingUser = {
      id: 'user-1',
      email: 'user@example.com',
      nickname: '이전 이름',
      profileImageUrl: null,
      provider: AuthProvider.GOOGLE,
      providerId: 'old-google-id',
      role: UserRole.USER,
      isActive: false,
      timezone: 'Asia/Seoul',
      lastLoginAt: null,
      createdAt: new Date('2026-03-19T00:00:00.000Z'),
      updatedAt: new Date('2026-03-19T00:00:00.000Z'),
    } as User;

    usersRepository.findOne.mockResolvedValueOnce(existingUser);
    usersRepository.save.mockImplementation(async (entity) => entity as User);

    const result = await service.findOrCreate({
      googleId: 'new-google-id',
      email: 'user@example.com',
      name: '새 닉네임',
      profileImageUrl: 'https://example.com/new.png',
    });

    expect(usersRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'user-1',
        nickname: '새 닉네임',
        profileImageUrl: 'https://example.com/new.png',
        provider: AuthProvider.GOOGLE,
        providerId: 'new-google-id',
        isActive: true,
        lastLoginAt: now,
      }),
    );
    expect(result.nickname).toBe('새 닉네임');
    expect(result.providerId).toBe('new-google-id');
    expect(result.lastLoginAt).toEqual(now);

    jest.useRealTimers();
  });

  it('계정 삭제 시 사용자 관련 데이터를 하나의 트랜잭션에서 삭제한다', async () => {
    const manager = {
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    dataSource.transaction.mockImplementation((callback) => Promise.resolve(callback(manager)));

    await service.deleteAccount('user-1');

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(manager.delete).toHaveBeenNthCalledWith(1, expect.anything(), { userId: 'user-1' });
    expect(manager.delete).toHaveBeenNthCalledWith(2, expect.anything(), { userId: 'user-1' });
    expect(manager.delete).toHaveBeenNthCalledWith(3, expect.anything(), { userId: 'user-1' });
    expect(manager.delete).toHaveBeenNthCalledWith(4, expect.anything(), { userId: 'user-1' });
    expect(manager.update).toHaveBeenCalledWith(
      AuthAuditLog,
      { userId: 'user-1' },
      { userId: null },
    );
    expect(manager.delete).toHaveBeenNthCalledWith(5, expect.anything(), { id: 'user-1' });
    expect(authAuditRepository.save).toHaveBeenCalledTimes(2);
    expect(authAuditRepository.save).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        userId: null,
        eventType: AuthAuditEventType.ACCOUNT_DELETION_REQUESTED,
        requestId: expect.any(String),
      }),
    );
    expect(authAuditRepository.save).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        userId: null,
        eventType: AuthAuditEventType.ACCOUNT_DELETION_SUCCEEDED,
        requestId: expect.any(String),
      }),
    );
  });

  it('존재하지 않는 사용자 탈퇴 요청은 실패 감사 로그를 남기고 404를 반환한다', async () => {
    const manager = {
      delete: jest.fn().mockResolvedValue({ affected: 0 }),
      update: jest.fn().mockResolvedValue({ affected: 0 }),
    };
    dataSource.transaction.mockImplementation((callback) => Promise.resolve(callback(manager)));

    await expect(service.deleteAccount('missing-user')).rejects.toThrow('User account not found');

    expect(authAuditRepository.save).toHaveBeenCalledTimes(2);
    expect(authAuditRepository.save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        eventType: AuthAuditEventType.ACCOUNT_DELETION_FAILED,
        failureReason: 'User account not found',
        requestId: expect.any(String),
      }),
    );
  });

  it('트랜잭션 실패 시 실패 감사 로그를 남기고 원래 오류를 전달한다', async () => {
    const deletionError = new Error('database failure');
    const manager = {
      delete: jest.fn().mockRejectedValue(deletionError),
      update: jest.fn(),
    };
    dataSource.transaction.mockImplementation((callback) => Promise.resolve(callback(manager)));

    await expect(service.deleteAccount('user-1')).rejects.toThrow('database failure');

    expect(authAuditRepository.save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        eventType: AuthAuditEventType.ACCOUNT_DELETION_FAILED,
        failureReason: 'Account deletion failed',
        requestId: expect.any(String),
      }),
    );
  });
});
