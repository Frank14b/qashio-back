import { CategoryKind } from '../domain/category-kind';

export type DefaultCategorySeed = {
  name: string;
  kind: CategoryKind;
};

/** Sensible starter set created after email verification (idempotent by name). */
export const DEFAULT_CATEGORY_SEEDS: DefaultCategorySeed[] = [
  { name: 'Food', kind: CategoryKind.EXPENSE },
  { name: 'Transport', kind: CategoryKind.EXPENSE },
  { name: 'Housing', kind: CategoryKind.EXPENSE },
  { name: 'Shopping', kind: CategoryKind.EXPENSE },
  { name: 'Entertainment', kind: CategoryKind.EXPENSE },
  { name: 'Health', kind: CategoryKind.EXPENSE },
  { name: 'Utilities', kind: CategoryKind.EXPENSE },
  { name: 'Salary', kind: CategoryKind.INCOME },
  { name: 'Freelance', kind: CategoryKind.INCOME },
  { name: 'Other', kind: CategoryKind.BOTH },
];
