// src/services/auth/infrastructure/repositories/user.prisma.repository.ts
import { prisma } from '@infrastructure/database/prisma.client';
import { User } from '../../domain/entities/user.entity';
import type {
  IUserRepository,
  CreateUserInput,
  UpdateUserInput,
} from '../../domain/repositories/user.repository';
import type { UserRole } from '@shared/types';

// ─── Mapper ───────────────────────────────────────────────────────────────────
function toEntity(row: {
  id: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  role: string;
  isEmailVerified: boolean;
  isActive: boolean;
  emailVerifyToken: string | null;
  emailVerifyExpiry: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): User {
  return new User({
    ...row,
    role: row.role as UserRole,
  });
}

// ─── Repository ───────────────────────────────────────────────────────────────
export class UserPrismaRepository implements IUserRepository {
  async findById(id: string): Promise<User | null> {
    const row = await prisma.user.findUnique({ where: { id } });
    return row ? toEntity(row) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = await prisma.user.findUnique({ where: { email } });
    return row ? toEntity(row) : null;
  }

  async findByEmailVerifyToken(token: string): Promise<User | null> {
    const row = await prisma.user.findFirst({
      where: { emailVerifyToken: token },
    });
    return row ? toEntity(row) : null;
  }

  async create(input: CreateUserInput): Promise<User> {
    const row = await prisma.user.create({
      data: {
        email: input.email,
        passwordHash: input.passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        role: input.role ?? 'VIEWER',
        emailVerifyToken: input.emailVerifyToken,
        emailVerifyExpiry: input.emailVerifyExpiry,
      },
    });
    return toEntity(row);
  }

  async update(id: string, input: UpdateUserInput): Promise<User> {
    const row = await prisma.user.update({
      where: { id },
      data: input,
    });
    return toEntity(row);
  }

  async delete(id: string): Promise<void> {
    await prisma.user.delete({ where: { id } });
  }

  async existsByEmail(email: string): Promise<boolean> {
    const count = await prisma.user.count({ where: { email } });
    return count > 0;
  }
}
