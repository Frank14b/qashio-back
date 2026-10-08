import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'crypto';
import {
  AccessTokenPayload,
  TokenServicePort,
} from '../../domain/ports/token.service.port';

@Injectable()
export class JwtTokenService implements TokenServicePort {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  signAccessToken(payload: AccessTokenPayload): Promise<string> {
    return this.jwt.signAsync(payload);
  }

  generateRefreshToken(): string {
    return randomBytes(48).toString('base64url');
  }

  hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  getRefreshExpiresAt(): Date {
    const days = Number(this.config.get<string>('JWT_REFRESH_EXPIRES_DAYS', '30'));
    const expires = new Date();
    expires.setDate(expires.getDate() + days);
    return expires;
  }
}
