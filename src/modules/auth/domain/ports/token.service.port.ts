export const TOKEN_SERVICE = Symbol('TOKEN_SERVICE');

export type AccessTokenPayload = {
  sub: string;
  sid: string;
  email: string;
};

export interface TokenServicePort {
  signAccessToken(payload: AccessTokenPayload): Promise<string>;
  generateRefreshToken(): string;
  hashRefreshToken(token: string): string;
  getRefreshExpiresAt(): Date;
}
