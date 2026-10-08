import { BadRequestException } from '@nestjs/common';
import { formatMoney, parseMoneyInput } from './money-input';

describe('parseMoneyInput', () => {
  const usd = { field: 'amount', decimalPlaces: 2, currencyCode: 'USD' };

  it('normalizes strings and numbers', () => {
    expect(parseMoneyInput('0012.50', usd)).toBe('12.5');
    expect(parseMoneyInput(12.5, usd)).toBe('12.5');
    expect(parseMoneyInput('-0.00', usd)).toBe('0');
    expect(parseMoneyInput('-250.50', usd)).toBe('-250.5');
  });

  it('rejects more decimals than the currency allows', () => {
    expect(() => parseMoneyInput('1.234', usd)).toThrow('USD allows 2');
    expect(() =>
      parseMoneyInput('100.5', { field: 'amount', decimalPlaces: 0, currencyCode: 'XAF' }),
    ).toThrow(BadRequestException);
  });

  it('enforces positivity when required', () => {
    expect(() => parseMoneyInput('0', { ...usd, positive: true })).toThrow('greater than 0');
    expect(() => parseMoneyInput('-5', { ...usd, positive: true })).toThrow(BadRequestException);
    expect(parseMoneyInput('0.01', { ...usd, positive: true })).toBe('0.01');
  });

  it('rejects garbage and out-of-range values', () => {
    expect(() => parseMoneyInput('abc', usd)).toThrow(BadRequestException);
    expect(() => parseMoneyInput('1000000000000000', usd)).toThrow(BadRequestException);
  });
});

describe('formatMoney', () => {
  it('formats to the currency scale', () => {
    expect(formatMoney('12.5000', 2)).toBe('12.50');
    expect(formatMoney('1500.0000', 0)).toBe('1500');
    expect(formatMoney('-42.1000', 2)).toBe('-42.10');
  });
});
