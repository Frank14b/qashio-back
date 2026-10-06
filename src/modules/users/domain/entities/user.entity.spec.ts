import { User } from './user.entity';

describe('User', () => {
  it('assigns constructor props', () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    const updatedAt = new Date('2026-01-02T00:00:00.000Z');

    const user = new User({
      id: 'user-1',
      email: 'jane@example.com',
      passwordHash: 'hash',
      displayName: 'Jane',
      isActive: true,
      createdAt,
      updatedAt,
    });

    expect(user).toEqual({
      id: 'user-1',
      email: 'jane@example.com',
      passwordHash: 'hash',
      displayName: 'Jane',
      isActive: true,
      createdAt,
      updatedAt,
    });
  });
});
