import { UpdateAccountUseCase } from './update-account.use-case';

describe('UpdateAccountUseCase', () => {
  const accounts = {
    findByIdForUser: jest.fn(),
    clearDefaultForUser: jest.fn(),
    update: jest.fn(),
  };
  let useCase: UpdateAccountUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new UpdateAccountUseCase(accounts as never);
  });

  it('archives an account and clears default via repository', async () => {
    accounts.findByIdForUser.mockResolvedValue({
      id: 'acc-1',
      userId: 'user-1',
      isDefault: true,
      archivedAt: null,
      isArchived: false,
    });
    accounts.update.mockResolvedValue({ id: 'acc-1', archivedAt: new Date() });

    await useCase.execute({
      userId: 'user-1',
      accountId: 'acc-1',
      archive: true,
    });

    expect(accounts.update).toHaveBeenCalledWith(
      'acc-1',
      expect.objectContaining({
        archivedAt: expect.any(Date),
      }),
    );
  });

  it('clears previous default when promoting another wallet', async () => {
    accounts.findByIdForUser.mockResolvedValue({
      id: 'acc-2',
      archivedAt: null,
      isArchived: false,
    });
    accounts.update.mockResolvedValue({ id: 'acc-2', isDefault: true });

    await useCase.execute({
      userId: 'user-1',
      accountId: 'acc-2',
      isDefault: true,
    });

    expect(accounts.clearDefaultForUser).toHaveBeenCalledWith('user-1');
    expect(accounts.update).toHaveBeenCalledWith('acc-2', {
      name: undefined,
      isDefault: true,
      archivedAt: undefined,
    });
  });
});
