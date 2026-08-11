import type { TokenPair } from './token.service.interface';
import type { AuthAuditContext } from '../auth-audit.service';

export interface IAuthService {
  loginWithGoogle(
    idToken?: string,
    accessToken?: string,
    context?: AuthAuditContext,
  ): Promise<TokenPair>;
  refresh(refreshToken: string, context?: AuthAuditContext): Promise<TokenPair>;
  logout(userId: string, refreshToken: string, context?: AuthAuditContext): Promise<void>;
}
