// tests/unit/auth/token.service.test.ts
import { TokenService } from '@services/auth/infrastructure/services/token.service';
import { AppError } from '@shared/errors/AppError';

describe('TokenService', () => {
  let service: TokenService;

  beforeEach(() => {
    service = new TokenService();
  });

  // ─── Access Token ────────────────────────────────────────────────────────────
  describe('Access Token', () => {
    const payload = {
      sub:       'user-abc',
      email:     'test@example.com',
      role:      'ANALYST' as const,
      sessionId: 'session-xyz',
    };

    it('should sign and verify an access token', async () => {
      const token   = await service.signAccessToken(payload);
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT structure

      const decoded = await service.verifyAccessToken(token);
      expect(decoded.sub).toBe(payload.sub);
      expect(decoded.email).toBe(payload.email);
      expect(decoded.role).toBe(payload.role);
      expect(decoded.type).toBe('access');
    });

    it('should reject a tampered token', async () => {
      const token   = await service.signAccessToken(payload);
      const tampered = token.slice(0, -5) + 'XXXXX';

      await expect(service.verifyAccessToken(tampered)).rejects.toThrow(AppError);
    });

    it('should reject a refresh token used as access token', async () => {
      const refreshToken = await service.signRefreshToken({
        sub: payload.sub, tokenId: 'tok-1',
      });
      // Different secret — should fail
      await expect(service.verifyAccessToken(refreshToken)).rejects.toThrow(AppError);
    });
  });

  // ─── Refresh Token ───────────────────────────────────────────────────────────
  describe('Refresh Token', () => {
    it('should sign and verify a refresh token', async () => {
      const token   = await service.signRefreshToken({ sub: 'user-1', tokenId: 'db-id-1' });
      const decoded = await service.verifyRefreshToken(token);

      expect(decoded.sub).toBe('user-1');
      expect(decoded.type).toBe('refresh');
    });

    it('should reject an access token used as refresh token', async () => {
      const accessToken = await service.signAccessToken({
        sub: 'user-1', email: 'x@y.com', role: 'VIEWER', sessionId: 's1',
      });
      await expect(service.verifyRefreshToken(accessToken)).rejects.toThrow(AppError);
    });
  });

  // ─── Token revocation ────────────────────────────────────────────────────────
  describe('Revocation', () => {
    it('should blacklist a JTI after revokeAccessToken', async () => {
      const { cache } = await import('@infrastructure/redis/redis.client');
      const token     = await service.signAccessToken({
        sub: 'u1', email: 'a@b.com', role: 'VIEWER', sessionId: 's1',
      });
      const decoded = await service.verifyAccessToken(token);

      await service.revokeAccessToken(decoded.jti!);
      expect(cache.set).toHaveBeenCalledWith(
        expect.stringContaining('blacklist:token:'),
        '1',
        expect.any(Number),
      );
    });
  });

  // ─── TTL Helpers ─────────────────────────────────────────────────────────────
  it('should return correct TTL values', () => {
    expect(service.getAccessTTLSeconds()).toBe(900);          // 15 min
    expect(service.getRefreshTTLSeconds()).toBe(604800);      // 7 days
  });
});
