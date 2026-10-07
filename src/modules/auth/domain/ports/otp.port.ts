import { OtpPurpose } from '../otp-purpose';

export const OTP_SERVICE = Symbol('OTP_SERVICE');

export interface OtpPort {
  /** Generates, stores (hashed) in Redis with TTL, returns plaintext OTP for emailing. */
  issue(email: string, purpose: OtpPurpose): Promise<string>;
  /**
   * Binds the current OTP to the requesting client: returns an opaque token that
   * `verify` will then require, so only that client can confirm the code.
   * Call after `issue` (issuing a new OTP clears the previous binding).
   */
  bindClient(email: string, purpose: OtpPurpose): Promise<string>;
  /**
   * Returns true and deletes the OTP when it matches (and, if bound, the client
   * token matches too). Wrong attempts are counted; the OTP is discarded after
   * too many so it cannot be brute-forced.
   */
  verify(email: string, purpose: OtpPurpose, otp: string, clientToken?: string): Promise<boolean>;
}
