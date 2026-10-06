import { OtpPurpose } from '../otp-purpose';

export const OTP_SERVICE = Symbol('OTP_SERVICE');

export interface OtpPort {
  /** Generates, stores (hashed) in Redis with TTL, returns plaintext OTP for emailing. */
  issue(email: string, purpose: OtpPurpose): Promise<string>;
  /** Returns true and deletes the key when the OTP matches. */
  verify(email: string, purpose: OtpPurpose, otp: string): Promise<boolean>;
}
