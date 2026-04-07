// tests/unit/auth/user.entity.test.ts
import { User } from '@services/auth/domain/entities/user.entity';
import type { UserRole } from '@shared/types';

function makeUser(role: UserRole = 'VIEWER'): User {
  return new User({
    id:               'u-1',
    email:            'test@example.com',
    passwordHash:     '$argon2id$hash',
    firstName:        'John',
    lastName:         'Doe',
    role,
    isEmailVerified:  true,
    isActive:         true,
    emailVerifyToken: null,
    emailVerifyExpiry:null,
    lastLoginAt:      null,
    createdAt:        new Date(),
    updatedAt:        new Date(),
  });
}

describe('User Entity', () => {
  describe('fullName', () => {
    it('returns concatenated first and last name', () => {
      expect(makeUser().fullName).toBe('John Doe');
    });
  });

  describe('canAccess', () => {
    it('VIEWER can access VIEWER resources', () => {
      expect(makeUser('VIEWER').canAccess('VIEWER')).toBe(true);
    });

    it('VIEWER cannot access ANALYST resources', () => {
      expect(makeUser('VIEWER').canAccess('ANALYST')).toBe(false);
    });

    it('ANALYST can access VIEWER and ANALYST resources', () => {
      expect(makeUser('ANALYST').canAccess('VIEWER')).toBe(true);
      expect(makeUser('ANALYST').canAccess('ANALYST')).toBe(true);
    });

    it('ANALYST cannot access ADMIN resources', () => {
      expect(makeUser('ANALYST').canAccess('ADMIN')).toBe(false);
    });

    it('ADMIN can access all resources', () => {
      expect(makeUser('ADMIN').canAccess('VIEWER')).toBe(true);
      expect(makeUser('ADMIN').canAccess('ANALYST')).toBe(true);
      expect(makeUser('ADMIN').canAccess('ADMIN')).toBe(true);
    });
  });

  describe('toPublic', () => {
    it('strips sensitive fields', () => {
      const pub = makeUser().toPublic();
      expect(pub).not.toHaveProperty('passwordHash');
      expect(pub).not.toHaveProperty('emailVerifyToken');
      expect(pub).toHaveProperty('id');
      expect(pub).toHaveProperty('email');
      expect(pub).toHaveProperty('role');
    });
  });
});
