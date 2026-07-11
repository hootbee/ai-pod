import type { TokenPair } from './token.service.interface';

export interface IAuthService {
  loginWithGoogle(idToken?: string, accessToken?: string): Promise<TokenPair>;
  refresh(refreshToken: string): Promise<TokenPair>;
  logout(userId: string, refreshToken: string): Promise<void>;
}
