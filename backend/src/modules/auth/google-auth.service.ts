import { Injectable } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import type {
  GoogleUserInfo,
  IGoogleAuthService,
} from './interfaces/google-auth.service.interface';

@Injectable()
export class GoogleAuthService implements IGoogleAuthService {
  private readonly client: OAuth2Client;

  constructor() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      throw new Error('GOOGLE_CLIENT_ID is not set');
    }
    this.client = new OAuth2Client(clientId);
  }

  async verify(idToken: string): Promise<GoogleUserInfo> {
    // iOS/Android 앱마다 audience가 다를 수 있으므로 허용할 Client ID 목록 지정
    const allowedAudiences = [
      process.env.GOOGLE_CLIENT_ID!,                   // Web Client ID
      process.env.GOOGLE_IOS_CLIENT_ID,               // iOS Client ID (옵션)
    ].filter(Boolean) as string[];

    const ticket = await this.client.verifyIdToken({
      idToken,
      audience: allowedAudiences,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.sub || !payload.email) {
      throw new Error('Invalid Google ID token payload');
    }

    return {
      googleId: payload.sub,
      email: payload.email,
      name: payload.name ?? payload.email,
      profileImageUrl: payload.picture ?? null,
    };
  }
}
