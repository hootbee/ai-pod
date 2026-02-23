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
    const ticket = await this.client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
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
