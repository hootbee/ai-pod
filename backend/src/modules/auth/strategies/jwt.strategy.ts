import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import type { TokenPayload } from '../interfaces/token.service.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    super({
      // 1순위: Authorization: Bearer <token> 헤더
      // 2순위: ?token=<token> 쿼리 파라미터 (Flutter just_audio 스트리밍용)
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req: Request) => (req?.query?.token as string | undefined) ?? null,
      ]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_ACCESS_SECRET ?? 'fallback_secret',
    });
  }

  validate(payload: TokenPayload): TokenPayload {
    return { sub: payload.sub, email: payload.email };
  }
}
