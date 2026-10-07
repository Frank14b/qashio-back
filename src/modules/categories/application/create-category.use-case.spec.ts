import { ConflictException } from '@nestjs/common';
import { CategoryKind } from '../domain/category-kind';
import { CreateCategoryUseCase } from './create-category.use-case';

describe('CreateCategoryUseCase', () => {
  const categories = {
    create: jest.fn(),
    existsByUserAndName: jest.fn(),
  };
  let useCase: CreateCategoryUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new CreateCategoryUseCase(categories as never);
  });

  it('creates a category when name is unique for the user', async () => {
    categories.existsByUserAndName.mockResolvedValue(false);
    categories.create.mockResolvedValue({
      id: 'cat-1',
      name: 'Food',
      kind: CategoryKind.EXPENSE,
    });

    const result = await useCase.execute({
      userId: 'user-1',
      name: ' Food ',
      kind: CategoryKind.EXPENSE,
    });

    expect(categories.existsByUserAndName).toHaveBeenCalledWith('user-1', 'Food');
    expect(categories.create).toHaveBeenCalledWith({
      userId: 'user-1',
      name: 'Food',
      kind: CategoryKind.EXPENSE,
    });
    expect(result.id).toBe('cat-1');
  });

  it('rejects duplicate category names', async () => {
    categories.existsByUserAndName.mockResolvedValue(true);

    await expect(
      useCase.execute({
        userId: 'user-1',
        name: 'Food',
        kind: CategoryKind.EXPENSE,
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(categories.create).not.toHaveBeenCalled();
  });
});
