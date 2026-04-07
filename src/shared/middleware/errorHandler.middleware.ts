// src/shared/middleware/errorHandler.middleware.ts
import type { Request, Response, NextFunction } from 'express';
import { AppError } from '@shared/errors/AppError';
import { createLogger } from '@infrastructure/logger';
import { isProd } from '@shared/config';

const log = createLogger('ErrorHandler');

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // ─── Operational errors (expected, user-facing) ────────────────────────────
  if (err instanceof AppError && err.isOperational) {
    log.warn(
      { statusCode: err.statusCode, errorCode: err.errorCode, path: req.path },
      err.message,
    );

    res.status(err.statusCode).json({
      error:     err.message,
      errorCode: err.errorCode,
      details:   err.details ?? undefined,
    });
    return;
  }

  // ─── Unexpected / programmer errors ───────────────────────────────────────
  log.error({ err, path: req.path, method: req.method }, 'Unhandled error');

  res.status(500).json({
    error:    'An unexpected error occurred',
    errorCode:'INTERNAL_ERROR',
    // Never leak stack traces in production
    ...(isProd ? {} : { stack: err.stack }),
  });
}

// ─── 404 handler ──────────────────────────────────────────────────────────────
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error:     `Route ${req.method} ${req.path} not found`,
    errorCode: 'NOT_FOUND',
  });
}
