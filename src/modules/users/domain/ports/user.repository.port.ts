import { User } from '../entities/user.entity';

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

export type CreateUserInput = {
  email: string;
  passwordHash: string;
  displayName: string;
  isActive?: boolean;
};

export interface UserRepositoryPort {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  create(input: CreateUserInput): Promise<User>;
  activate(id: string): Promise<User>;
  updatePasswordHash(id: string, passwordHash: string): Promise<User>;
}
