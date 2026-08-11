import type { UserRole } from '../../users/entities/user.entity';

export interface TokenPayload {
  sub: string; // userId
  email: string;
  role: UserRole;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface ITokenService {
  generateAccessToken(payload: TokenPayload): string;
  generateRefreshToken(userId: string, deviceId?: string): Promise<string>;
  verifyAccessToken(token: string): TokenPayload;
  validateRefreshToken(token: string, userId: string): Promise<boolean>;
  revokeRefreshToken(token: string): Promise<boolean>;
  revokeAllUserTokens(userId: string): Promise<void>;
}
