// src/services/auth/domain/repositories/user.repository.ts
import type { User } from '../entities/user.entity';
import type { UserRole } from '@shared/types';

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  role?: UserRole;
  emailVerifyToken?: string;
  emailVerifyExpiry?: Date;
}

export interface UpdateUserInput {
  firstName?: string;
  lastName?: string;
  role?: UserRole;
  isEmailVerified?: boolean;
  emailVerifyToken?: string | null;
  emailVerifyExpiry?: Date | null;
  lastLoginAt?: Date;
  isActive?: boolean;
}

export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByEmailVerifyToken(token: string): Promise<User | null>;
  create(input: CreateUserInput): Promise<User>;
  update(id: string, input: UpdateUserInput): Promise<User>;
  delete(id: string): Promise<void>;
  existsByEmail(email: string): Promise<boolean>;
}
