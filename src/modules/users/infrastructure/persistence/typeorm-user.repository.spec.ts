jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

import { Repository } from 'typeorm';
import { User } from '../../domain/entities/user.entity';
import { TypeOrmUserRepository } from './typeorm-user.repository';
import { UserOrmEntity } from './user.orm-entity';

describe('TypeOrmUserRepository', () => {
  let repo: TypeOrmUserRepository;
  let orm: jest.Mocked<Pick<Repository<UserOrmEntity>, 'findOne' | 'create' | 'save'>>;

  const row: UserOrmEntity = {
    id: 'user-1',
    email: 'jane@example.com',
    passwordHash: 'hash',
    displayName: 'Jane',
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(() => {
    orm = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    repo = new TypeOrmUserRepository(orm as unknown as Repository<UserOrmEntity>);
  });

  it('findByEmail lowercases the lookup and maps to domain', async () => {
    orm.findOne.mockResolvedValue(row);

    const user = await repo.findByEmail('Jane@Example.com');

    expect(orm.findOne).toHaveBeenCalledWith({
      where: { email: 'jane@example.com' },
    });
    expect(user).toBeInstanceOf(User);
    expect(user).toMatchObject({
      id: 'user-1',
      email: 'jane@example.com',
      displayName: 'Jane',
    });
  });

  it('findByEmail returns null when missing', async () => {
    orm.findOne.mockResolvedValue(null);
    await expect(repo.findByEmail('missing@example.com')).resolves.toBeNull();
  });

  it('findById returns mapped user', async () => {
    orm.findOne.mockResolvedValue(row);

    const user = await repo.findById('user-1');

    expect(orm.findOne).toHaveBeenCalledWith({ where: { id: 'user-1' } });
    expect(user?.id).toBe('user-1');
  });

  it('create lowercases email and returns domain user', async () => {
    const created = { ...row, email: 'jane@example.com' };
    orm.create.mockReturnValue(created);
    orm.save.mockResolvedValue(created);

    const user = await repo.create({
      email: 'Jane@Example.com',
      passwordHash: 'hash',
      displayName: 'Jane',
    });

    expect(orm.create).toHaveBeenCalledWith({
      email: 'jane@example.com',
      passwordHash: 'hash',
      displayName: 'Jane',
      isActive: true,
    });
    expect(user).toBeInstanceOf(User);
    expect(user.email).toBe('jane@example.com');
  });
});
