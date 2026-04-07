// src/services/auth/application/use-cases/auth.use-cases.ts
import argon2 from 'argon2';
import { AppError } from '@shared/errors/AppError';
import { createLogger } from '@infrastructure/logger';
import { tokenService } from '../../infrastructure/services/token.service';
import { eventBus, Events } from '@infrastructure/events/eventBus';
import { getQueue, QUEUES } from '@infrastructure/queue';
import type { EmailJobData } from '@infrastructure/queue';
import type { IUserRepository } from '../../domain/repositories/user.repository';
import type { IRefreshTokenRepository } from '../../infrastructure/repositories/refresh-token.repository';
import type { AuthTokensResponse } from '../dtos/auth.dto';

const log = createLogger('AuthUseCases');

// ─── Refresh Token ────────────────────────────────────────────────────────────
export class RefreshTokenUseCase {
  constructor(
    private readonly userRepository:         IUserRepository,
    private readonly refreshTokenRepository: IRefreshTokenRepository,
  ) {}

  async execute(rawRefreshToken: string, meta?: { userAgent?: string; ipAddress?: string }): Promise<AuthTokensResponse> {
    const payload = await tokenService.verifyRefreshToken(rawRefreshToken);

    const storedToken = await this.refreshTokenRepository.findByToken(rawRefreshToken);
    if (!storedToken || storedToken.isRevoked || storedToken.expiresAt < new Date()) {
      if (storedToken) {
        await this.refreshTokenRepository.revokeAllForUser(storedToken.userId);
        log.warn({ userId: storedToken.userId }, 'Refresh token reuse detected');
      }
      throw AppError.tokenInvalid();
    }

    const user = await this.userRepository.findById(payload.sub);
    if (!user || !user.isActive) throw AppError.unauthorized();

    await this.refreshTokenRepository.revoke(storedToken.id);

    const sessionId       = crypto.randomUUID();
    const accessToken     = await tokenService.signAccessToken({ sub: user.id, email: user.email, role: user.role, sessionId });
    const newRefreshToken = await tokenService.signRefreshToken({ sub: user.id, tokenId: crypto.randomUUID() });

    const expiresAt = new Date(Date.now() + tokenService.getRefreshTTLSeconds() * 1000);
    await this.refreshTokenRepository.create({ token: newRefreshToken, userId: user.id, expiresAt, userAgent: meta?.userAgent, ipAddress: meta?.ipAddress });

    log.info({ userId: user.id }, 'Tokens refreshed');
    return { accessToken, refreshToken: newRefreshToken, expiresIn: tokenService.getAccessTTLSeconds() };
  }
}

// ─── Logout ───────────────────────────────────────────────────────────────────
export class LogoutUseCase {
  constructor(private readonly refreshTokenRepository: IRefreshTokenRepository) {}

  async execute(refreshToken: string, accessTokenJti?: string): Promise<void> {
    const stored = await this.refreshTokenRepository.findByToken(refreshToken);
    if (stored && !stored.isRevoked) await this.refreshTokenRepository.revoke(stored.id);
    if (accessTokenJti) await tokenService.revokeAccessToken(accessTokenJti);
  }
}

// ─── Verify Email ─────────────────────────────────────────────────────────────
export class VerifyEmailUseCase {
  constructor(private readonly userRepository: IUserRepository) {}

  async execute(token: string): Promise<void> {
    const user = await this.userRepository.findByEmailVerifyToken(token);
    if (!user) throw AppError.notFound('Email verification token');
    if (user.isEmailVerified) return;

    if (user.emailVerifyExpiry && user.emailVerifyExpiry < new Date()) {
      throw new AppError('Verification token has expired. Request a new one.', 400, 'TOKEN_EXPIRED' as never);
    }

    await this.userRepository.update(user.id, { isEmailVerified: true, emailVerifyToken: null, emailVerifyExpiry: null });
  }
}

// ─── Forgot Password ──────────────────────────────────────────────────────────
export class ForgotPasswordUseCase {
  constructor(private readonly userRepository: IUserRepository) {}

  async execute(email: string): Promise<void> {
    const { prisma } = await import('@infrastructure/database/prisma.client');
    const user = await this.userRepository.findByEmail(email);
    if (!user) return; // silent — prevent email enumeration

    const token     = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.passwordReset.create({ data: { token, userId: user.id, expiresAt } });

    await getQueue<EmailJobData>(QUEUES.EMAIL).add('send-password-reset', {
      type: 'PASSWORD_RESET', to: user.email, payload: { name: user.firstName, token },
    });
  }
}

// ─── Reset Password ───────────────────────────────────────────────────────────
export class ResetPasswordUseCase {
  constructor(
    private readonly userRepository:         IUserRepository,
    private readonly refreshTokenRepository: IRefreshTokenRepository,
  ) {}

  async execute(token: string, newPassword: string): Promise<void> {
    const { prisma } = await import('@infrastructure/database/prisma.client');
    const record = await prisma.passwordReset.findUnique({ where: { token } });

    if (!record || record.isUsed || record.expiresAt < new Date()) throw AppError.tokenInvalid();

    const passwordHash = await argon2.hash(newPassword, { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 4 });

    await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      prisma.passwordReset.update({ where: { id: record.id }, data: { isUsed: true } }),
    ]);

    await this.refreshTokenRepository.revokeAllForUser(record.userId);
    eventBus.publish(Events.USER_PASSWORD_RESET, { userId: record.userId });
    log.info({ userId: record.userId }, 'Password reset');
  }
}

// Re-export LoginUseCase so controller can import from one place
export { LoginUseCase } from './login.use-case';
