export type AuthSessionProps = {
  id: string;
  userId: string;
  refreshTokenHash: string;
  userAgent: string | null;
  ipAddress: string | null;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
};

export class AuthSession {
  readonly id: string;
  readonly userId: string;
  readonly refreshTokenHash: string;
  readonly userAgent: string | null;
  readonly ipAddress: string | null;
  readonly expiresAt: Date;
  readonly revokedAt: Date | null;
  readonly createdAt: Date;

  constructor(props: AuthSessionProps) {
    Object.assign(this, props);
  }

  get isActive(): boolean {
    return this.revokedAt === null && this.expiresAt.getTime() > Date.now();
  }
}
