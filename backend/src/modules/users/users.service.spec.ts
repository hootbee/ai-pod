import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from './users.service';
import { AuthProvider, User, UserRole } from './entities/user.entity';

const mockUserRepository = () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
});

describe('UsersService', () => {
  let service: UsersService;
  let usersRepository: jest.Mocked<Repository<User>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useFactory: mockUserRepository,
        },
      ],
    }).compile();

    service = module.get(UsersService);
    usersRepository = module.get(getRepositoryToken(User));
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
});
