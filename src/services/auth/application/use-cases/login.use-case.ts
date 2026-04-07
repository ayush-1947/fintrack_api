// src/services/auth/application/use-cases/login.use-case.ts
import argon2 from 'argon2';
import { AppError, ErrorCode } from '@shared/errors/AppError';
import { eventBus, Events } from '@infrastructure/events/eventBus';
import { createLogger } from '@infrastructure/logger';
import { tokenService } from '../../infrastructure/services/token.service';
import type { IUserRepository } from '../../domain/repositories/user.repository';
import type { IRefreshTokenRepository } from '../../infrastructure/repositories/refresh-token.repository';
import type { LoginDto, AuthTokensResponse } from '../dtos/auth.dto';
import type { PublicUser } from '../../domain/entities/user.entity';

const log = createLogger('LoginUseCase');

export class LoginUseCase {
  constructor(
    private readonly userRepository:         IUserRepository,
    private readonly refreshTokenRepository: IRefreshTokenRepository,
  ) {}

  async execute(
    dto: LoginDto,
    meta?: { userAgent?: string; ipAddress?: string },
  ): Promise<{ tokens: AuthTokensResponse; user: PublicUser }> {
    // 1. Load user — constant-time even if user not found (prevent timing attacks)
    const user = await this.userRepository.findByEmail(dto.email);

    // Always verify a hash even if user not found, to prevent timing-based user enumeration
    const dummyHash =
      '$argon2id$v=19$m=65536,t=3,p=4$dummydummydummydummydummy$dummydummydummydummydummydummydummydummydummy';
    const passwordToVerify = user ? user.passwordHash : dummyHash;

    const isValid = await argon2.verify(passwordToVerify, dto.password);

    if (!user || !isValid) {
      throw AppError.invalidCredentials();
    }

    // 2. Business rule checks
    if (!user.isActive) {
      throw new AppError('Account is deactivated', 403, ErrorCode.FORBIDDEN);
    }
    if (!user.isEmailVerified) {
      throw new AppError('Please verify your email before logging in', 403, ErrorCode.EMAIL_NOT_VERIFIED);
    }

    // 3. Issue tokens
    const sessionId = crypto.randomUUID();

    const accessToken = await tokenService.signAccessToken({
      sub:       user.id,
      email:     user.email,
      role:      user.role,
      sessionId,
    });

    const refreshTokenString = await tokenService.signRefreshToken({
      sub:     user.id,
      tokenId: crypto.randomUUID(), // DB record ID filled after creation
    });

    // 4. Persist refresh token (enables server-side revocation)
    const expiresAt = new Date(Date.now() + tokenService.getRefreshTTLSeconds() * 1000);
    await this.refreshTokenRepository.create({
      token:     refreshTokenString,
      userId:    user.id,
      expiresAt,
      userAgent: meta?.userAgent,
      ipAddress: meta?.ipAddress,
    });

    // 5. Update last login timestamp (fire-and-forget is fine here)
    void this.userRepository.update(user.id, { lastLoginAt: new Date() });

    // 6. Publish event
    eventBus.publish(Events.USER_LOGGED_IN, {
      userId: user.id,
      ip:     meta?.ipAddress,
    });

    log.info({ userId: user.id }, 'User logged in');

    return {
      tokens: {
        accessToken,
        refreshToken: refreshTokenString,
        expiresIn:    tokenService.getAccessTTLSeconds(),
      },
      user: user.toPublic(),
    };
  }
}
