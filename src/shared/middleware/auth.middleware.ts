// src/shared/middleware/auth.middleware.ts
import type { Request, Response, NextFunction } from 'express';
import { AppError } from '@shared/errors/AppError';
import { tokenService } from '@services/auth/infrastructure/services/token.service';
import type { UserRole, AuthContext } from '@shared/types';

// Augment Express Request with auth context
declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext & { jti?: string };
    }
  }
}

// ─── Authenticate ─────────────────────────────────────────────────────────────
export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw AppError.unauthorized('Missing or malformed Authorization header');
    }

    const token   = authHeader.slice(7);
    const payload = await tokenService.verifyAccessToken(token);

    req.auth = {
      userId:    payload.sub,
      email:     payload.email as string,
      role:      payload.role as UserRole,
      sessionId: payload.sessionId as string,
      jti:       payload.jti,
    };

    next();
  } catch (err) {
    next(err);
  }
}

// ─── RBAC ─────────────────────────────────────────────────────────────────────
export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) {
      return next(AppError.unauthorized());
    }

    const hierarchy: Record<UserRole, number> = {
      VIEWER: 0,
      ANALYST: 1,
      ADMIN: 2,
    };

    const userLevel     = hierarchy[req.auth.role];
    const requiredLevel = Math.min(...roles.map((r) => hierarchy[r]));

    if (userLevel < requiredLevel) {
      return next(AppError.forbidden(`Requires role: ${roles.join(' or ')}`));
    }

    next();
  };
}

// ─── Ownership Guard ──────────────────────────────────────────────────────────
// Ensures users can only access their own resources unless they are ADMIN
export function requireOwnership(userIdExtractor: (req: Request) => string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) return next(AppError.unauthorized());

    const resourceOwnerId = userIdExtractor(req);
    const isOwner  = req.auth.userId === resourceOwnerId;
    const isAdmin  = req.auth.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      return next(AppError.forbidden('You do not have access to this resource'));
    }

    next();
  };
}
