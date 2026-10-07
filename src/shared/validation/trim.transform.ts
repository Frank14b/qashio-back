import { Transform } from 'class-transformer';

/**
 * Trims string input before validation, so `@IsNotEmpty()` rejects
 * whitespace-only values. class-transformer has no built-in trim.
 */
export function Trim() {
  return Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );
}
