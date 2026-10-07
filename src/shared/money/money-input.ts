import { BadRequestException } from '@nestjs/common';
import Decimal from 'decimal.js';

/** `numeric(19, 4)` storage: 15 integer digits, 4 fraction digits. */
const MAX_ABSOLUTE_VALUE = new Decimal('1e15');

export type MoneyInputOptions = {
  field: string;
  /** Max decimal places allowed by the currency (e.g. 2 for USD, 0 for XAF). */
  decimalPlaces: number;
  currencyCode: string;
  /** Require a strictly positive value (transaction amounts). */
  positive?: boolean;
};

/**
 * Validates a user-supplied money value against its currency and returns the
 * normalized decimal string to persist (e.g. `"0012.50"` → `"12.5"`).
 * Throws 400 on any violation. Uses decimal.js — never JS floats.
 */
export function parseMoneyInput(value: string | number, options: MoneyInputOptions): string {
  let amount: Decimal;
  try {
    amount = new Decimal(value);
  } catch {
    throw new BadRequestException(`${options.field} must be a decimal number`);
  }
  if (!amount.isFinite() || amount.abs().gte(MAX_ABSOLUTE_VALUE)) {
    throw new BadRequestException(`${options.field} must be less than 1e15 in absolute value`);
  }
  if (options.positive && !amount.gt(0)) {
    throw new BadRequestException(`${options.field} must be greater than 0`);
  }
  if (amount.decimalPlaces() > options.decimalPlaces) {
    throw new BadRequestException(
      `${options.field} has ${amount.decimalPlaces()} decimal places; ${options.currencyCode} allows ${options.decimalPlaces}`,
    );
  }
  // `+ 0` folds -0 into 0; toFixed() without args never uses exponent notation.
  return amount.plus(0).toFixed();
}

/** Formats a stored/aggregated decimal string to the currency's decimal places. */
export function formatMoney(value: string, decimalPlaces: number): string {
  return new Decimal(value).toFixed(decimalPlaces);
}
