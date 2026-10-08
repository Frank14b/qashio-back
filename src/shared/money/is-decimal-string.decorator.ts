import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsDecimal } from 'class-validator';

/**
 * Money field: accepts a JSON number or numeric string (sign allowed, up to 4
 * decimals) and keeps it as a string so it never passes through float math.
 * Sign and currency-scale rules are enforced in use cases.
 */
export function IsDecimalString() {
  return applyDecorators(
    Transform(({ value }: { value: unknown }) =>
      typeof value === 'number' && Number.isFinite(value) ? String(value) : value,
    ),
    IsDecimal(
      { decimal_digits: '0,4' },
      { message: ({ property }) => `${property} must be a decimal number (e.g. "125.50")` },
    ),
  );
}
