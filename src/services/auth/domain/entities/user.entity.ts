// src/services/auth/domain/entities/user.entity.ts
import type { UserRole } from '@shared/types';

export interface UserProps {
  id: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isEmailVerified: boolean;
  isActive: boolean;
  emailVerifyToken?: string | null;
  emailVerifyExpiry?: Date | null;
  lastLoginAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class User {
  readonly id!: string;
  readonly email!: string;
  readonly passwordHash!: string;
  readonly firstName!: string;
  readonly lastName!: string;
  readonly role!: UserRole;
  readonly isEmailVerified!: boolean;
  readonly isActive!: boolean;
  readonly emailVerifyToken?: string | null;
  readonly emailVerifyExpiry?: Date | null;
  readonly lastLoginAt?: Date | null;
  readonly createdAt!: Date;
  readonly updatedAt!: Date;

  constructor(props: UserProps) {
    Object.assign(this, props);
  }

  get fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }

  canAccess(requiredRole: UserRole): boolean {
    const hierarchy: Record<UserRole, number> = {
      VIEWER: 0,
      ANALYST: 1,
      ADMIN: 2,
    };
    return hierarchy[this.role] >= hierarchy[requiredRole];
  }

  toPublic(): PublicUser {
    return {
      id: this.id,
      email: this.email,
      firstName: this.firstName,
      lastName: this.lastName,
      role: this.role,
      isEmailVerified: this.isEmailVerified,
      createdAt: this.createdAt,
    };
  }
}

export interface PublicUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isEmailVerified: boolean;
  createdAt: Date;
}
