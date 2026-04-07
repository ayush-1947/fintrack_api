// tests/unit/auth/signup.use-case.test.ts
import { SignupUseCase } from '@services/auth/application/use-cases/signup.use-case';
import type { IUserRepository } from '@services/auth/domain/repositories/user.repository';
import { AppError } from '@shared/errors/AppError';
import { User } from '@services/auth/domain/entities/user.entity';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeUser(overrides: Partial<ConstructorParameters<typeof User>[0]> = {}): User {
  return new User({
    id:               'user-123',
    email:            'alice@example.com',
    passwordHash:     '$argon2id$test',
    firstName:        'Alice',
    lastName:         'Smith',
    role:             'VIEWER',
    isEmailVerified:  false,
    isActive:         true,
    emailVerifyToken: 'verify-token-abc',
    emailVerifyExpiry:new Date(Date.now() + 86400000),
    lastLoginAt:      null,
    createdAt:        new Date(),
    updatedAt:        new Date(),
    ...overrides,
  });
}

function makeMockRepo(overrides: Partial<IUserRepository> = {}): IUserRepository {
  return {
    findById:              jest.fn().mockResolvedValue(null),
    findByEmail:           jest.fn().mockResolvedValue(null),
    findByEmailVerifyToken:jest.fn().mockResolvedValue(null),
    existsByEmail:         jest.fn().mockResolvedValue(false),
    create:                jest.fn().mockResolvedValue(makeUser()),
    update:                jest.fn(),
    delete:                jest.fn(),
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────
describe('SignupUseCase', () => {
  const validDto = {
    email:     'alice@example.com',
    password:  'StrongPass1!',
    firstName: 'Alice',
    lastName:  'Smith',
  };

  it('should register a new user successfully', async () => {
    const repo    = makeMockRepo();
    const useCase = new SignupUseCase(repo);

    const result = await useCase.execute(validDto);

    expect(repo.existsByEmail).toHaveBeenCalledWith('alice@example.com');
    expect(repo.create).toHaveBeenCalledTimes(1);
    expect(result.user.email).toBe('alice@example.com');
    expect(result.message).toMatch(/verify/i);
  });

  it('should throw CONFLICT if email already exists', async () => {
    const repo    = makeMockRepo({ existsByEmail: jest.fn().mockResolvedValue(true) });
    const useCase = new SignupUseCase(repo);

    await expect(useCase.execute(validDto)).rejects.toThrow(AppError);
    await expect(useCase.execute(validDto)).rejects.toMatchObject({
      statusCode: 409,
      errorCode:  'CONFLICT',
    });
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('should never store the plain-text password', async () => {
    const repo    = makeMockRepo();
    const useCase = new SignupUseCase(repo);
    await useCase.execute(validDto);

    const createCall = (repo.create as jest.Mock).mock.calls[0][0];
    expect(createCall.passwordHash).not.toBe(validDto.password);
    expect(createCall.passwordHash).toMatch(/^\$argon2/);
  });

  it('should set email verify token with a future expiry', async () => {
    const repo    = makeMockRepo();
    const useCase = new SignupUseCase(repo);
    await useCase.execute(validDto);

    const createCall = (repo.create as jest.Mock).mock.calls[0][0];
    expect(createCall.emailVerifyToken).toBeTruthy();
    expect(createCall.emailVerifyExpiry).toBeInstanceOf(Date);
    expect(createCall.emailVerifyExpiry.getTime()).toBeGreaterThan(Date.now());
  });
});
