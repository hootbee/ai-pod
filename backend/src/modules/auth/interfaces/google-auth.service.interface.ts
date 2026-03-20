export interface GoogleUserInfo {
  googleId: string;
  email: string;
  name: string;
  profileImageUrl: string | null;
}

export interface IGoogleAuthService {
  verify(idToken: string): Promise<GoogleUserInfo>;
  verifyAccessToken(accessToken: string): Promise<GoogleUserInfo>;
}
