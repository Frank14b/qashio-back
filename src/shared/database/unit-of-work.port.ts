export const UNIT_OF_WORK = Symbol('UNIT_OF_WORK');

/**
 * Runs `work` in one database transaction: every repository write and every
 * emitted domain event (outbox row) inside it commits or rolls back together.
 * Nested calls join the outer transaction.
 */
export interface UnitOfWorkPort {
  run<T>(work: () => Promise<T>): Promise<T>;
}
