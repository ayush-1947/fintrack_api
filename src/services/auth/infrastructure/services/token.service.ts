// src/services/auth/infrastructure/services/token.service.ts
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { v4 as uuidv4 } from 'uuid';
import { config } from '@shared/config';
import { AppError } from '@shared/errors/AppError';
import { cache, CacheKeys } from '@infrastructure/redis/redis.client';
import type { AccessTokenPayload, RefreshTokenPayload, UserRole } from '@shared/types';

// ─── Token TTLs ───────────────────────────────────────────────────────────────
const ACCESS_TTL_SECONDS  = 15 * 60;          // 15 minutes
const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

// ─── Token Service ────────────────────────────────────────────────────────────
export class TokenService {
  private readonly accessSecret  = new TextEncoder().encode(config.JWT_ACCESS_SECRET);
  private readonly refreshSecret = new TextEncoder().encode(config.JWT_REFRESH_SECRET);

  // ─── Access Token ───────────────────────────────────────────────────────────

  async signAccessToken(payload: Omit<AccessTokenPayload, 'type'>): Promise<string> {
    return new SignJWT({ ...payload, type: 'access' })
      .setProtectedHeader({ alg: 'HS256' })
      .setJti(uuidv4())
      .setIssuedAt()
      .setExpirationTime(`${ACCESS_TTL_SECONDS}s`)
      .setIssuer(config.APP_NAME)
      .setAudience('fintrack-api')
      .sign(this.accessSecret);
  }

  async verifyAccessToken(token: string): Promise<AccessTokenPayload & JWTPayload> {
    try {
      const { payload } = await jwtVerify(token, this.accessSecret, {
        issuer: config.APP_NAME,
        audience: 'fintrack-api',
      });

      // Check token blacklist (logout / revocation)
      if (payload.jti) {
        const isBlacklisted = await cache.exists(CacheKeys.tokenBlacklist(payload.jti));
        if (isBlacklisted) throw AppError.tokenInvalid();
      }

      return payload as AccessTokenPayload & JWTPayload;
    } catch (err) {
      if (err instanceof AppError) throw err;
      const msg = (err as Error).message ?? '';
      if (msg.includes('expired')) throw AppError.tokenExpired();
      throw AppError.tokenInvalid();
    }
  }

  // ─── Refresh Token ──────────────────────────────────────────────────────────

  async signRefreshToken(payload: Omit<RefreshTokenPayload, 'type'>): Promise<string> {
    return new SignJWT({ ...payload, type: 'refresh' })
      .setProtectedHeader({ alg: 'HS256' })
      .setJti(uuidv4())
      .setIssuedAt()
      .setExpirationTime(`${REFRESH_TTL_SECONDS}s`)
      .setIssuer(config.APP_NAME)
      .sign(this.refreshSecret);
  }

  async verifyRefreshToken(token: string): Promise<RefreshTokenPayload & JWTPayload> {
    try {
      const { payload } = await jwtVerify(token, this.refreshSecret, {
        issuer: config.APP_NAME,
      });
      return payload as RefreshTokenPayload & JWTPayload;
    } catch (err) {
      const msg = (err as Error).message ?? '';
      if (msg.includes('expired')) throw AppError.tokenExpired();
      throw AppError.tokenInvalid();
    }
  }

  // ─── Revocation ─────────────────────────────────────────────────────────────

  async revokeAccessToken(jti: string): Promise<void> {
    // Store JTI in blacklist until token naturally expires
    await cache.set(CacheKeys.tokenBlacklist(jti), '1', ACCESS_TTL_SECONDS);
  }

  // ─── Utilities ──────────────────────────────────────────────────────────────

  getRefreshTTLSeconds(): number {
    return REFRESH_TTL_SECONDS;
  }

  getAccessTTLSeconds(): number {
    return ACCESS_TTL_SECONDS;
  }
}

// Singleton — shared across use-cases
export const tokenService = new TokenService();
