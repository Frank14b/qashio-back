import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import {
  ListTransactionsQueryDto,
  TransactionSummaryQueryDto,
} from './list-transactions-query.dto';

const errorsFor = <T extends object>(cls: new () => T, query: Record<string, unknown>) =>
  validateSync(plainToInstance(cls, query)).flatMap((error) => Object.values(error.constraints ?? {}));

describe('transaction query DTOs: date range', () => {
  it.each([TransactionSummaryQueryDto, ListTransactionsQueryDto])(
    '%p rejects `to` before `from`',
    (cls) => {
      expect(
        errorsFor(cls, { from: '2026-10-31T00:00:00.000Z', to: '2026-10-01T00:00:00.000Z' }),
      ).toEqual(['to must not be before from']);
    },
  );

  it('accepts an equal or later `to`, or an open-ended range', () => {
    const day = '2026-10-07T00:00:00.000Z';
    expect(errorsFor(TransactionSummaryQueryDto, { from: day, to: day })).toEqual([]);
    expect(
      errorsFor(TransactionSummaryQueryDto, { from: day, to: '2026-10-08T00:00:00.000Z' }),
    ).toEqual([]);
    expect(errorsFor(TransactionSummaryQueryDto, { from: day })).toEqual([]);
    expect(errorsFor(TransactionSummaryQueryDto, { to: day })).toEqual([]);
  });

  it('reports a malformed date as a date error, not a range error', () => {
    expect(errorsFor(TransactionSummaryQueryDto, { from: 'nope', to: '2026-10-01' })).toEqual([
      'from must be a valid ISO 8601 date string',
    ]);
  });
});
