import { randomInt } from 'node:crypto';

// Crockford base32 — no I, L, O, U to avoid misreading references aloud or in print.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const RANDOM_LENGTH = 6;

export const TRANSACTION_REFERENCE_PATTERN = /^TXN-\d{6}-[0-9A-HJKMNP-TV-Z]{6}$/;

/**
 * Human-readable unique reference, e.g. `TXN-261007-7K3Q9D`.
 * Date part is UTC `YYMMDD` of creation; random part gives ~1e9 values per day.
 * Uniqueness is guaranteed by the DB constraint — callers retry on collision.
 */
export function generateTransactionReference(now: Date = new Date()): string {
  const yy = String(now.getUTCFullYear() % 100).padStart(2, '0');
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  let random = '';
  for (let i = 0; i < RANDOM_LENGTH; i += 1) {
    random += ALPHABET[randomInt(ALPHABET.length)];
  }
  return `TXN-${yy}${mm}${dd}-${random}`;
}
