import { CategoryKind } from '../domain/category-kind';
import { CreateDefaultCategoriesUseCase } from './create-default-categories.use-case';
import { DEFAULT_CATEGORY_SEEDS } from './default-categories';

describe('CreateDefaultCategoriesUseCase', () => {
  const categories = {
    findNamesByUserId: jest.fn(),
    createMany: jest.fn(),
  };
  let useCase: CreateDefaultCategoriesUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new CreateDefaultCategoriesUseCase(categories as never);
  });

  it('creates all defaults when the user has none', async () => {
    categories.findNamesByUserId.mockResolvedValue(new Set());
    categories.createMany.mockImplementation(async (inputs: unknown[]) => inputs);

    const result = await useCase.execute({ userId: 'user-1' });

    expect(categories.createMany).toHaveBeenCalledWith(
      DEFAULT_CATEGORY_SEEDS.map((seed) => ({
        userId: 'user-1',
        name: seed.name,
        kind: seed.kind,
      })),
    );
    expect(result).toHaveLength(DEFAULT_CATEGORY_SEEDS.length);
  });

  it('is idempotent and only inserts missing names', async () => {
    categories.findNamesByUserId.mockResolvedValue(new Set(['Food', 'Salary']));
    categories.createMany.mockResolvedValue([
      { name: 'Transport', kind: CategoryKind.EXPENSE },
    ]);

    await useCase.execute({ userId: 'user-1' });

    const created = categories.createMany.mock.calls[0][0] as Array<{
      name: string;
    }>;
    expect(created.map((c) => c.name)).not.toContain('Food');
    expect(created.map((c) => c.name)).not.toContain('Salary');
    expect(created.map((c) => c.name)).toContain('Transport');
  });

  it('skips createMany when all defaults already exist', async () => {
    categories.findNamesByUserId.mockResolvedValue(
      new Set(DEFAULT_CATEGORY_SEEDS.map((s) => s.name)),
    );

    const result = await useCase.execute({ userId: 'user-1' });

    expect(categories.createMany).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });
});
