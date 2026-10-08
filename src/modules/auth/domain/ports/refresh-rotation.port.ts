export const REFRESH_ROTATION_STORE = Symbol('REFRESH_ROTATION_STORE');

/**
 * Serializes refresh-token rotation across requests and API instances.
 * Keys are the hash of the refresh token being rotated (never the token itself).
 */
export interface RefreshRotationStorePort {
  /** Claims the right to rotate this token; false if another request holds it. */
  tryLock(tokenHash: string, ttlMs: number): Promise<boolean>;
  release(tokenHash: string): Promise<void>;
  /** Result of a rotation that already happened for this token, if still cached. */
  getResult<T>(tokenHash: string): Promise<T | null>;
  saveResult<T>(tokenHash: string, result: T, ttlMs: number): Promise<void>;
}
