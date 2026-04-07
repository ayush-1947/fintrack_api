// src/shared/middleware/requestLogger.middleware.ts
import type { Request, Response, NextFunction } from 'express';
import { createLogger } from '@infrastructure/logger';

const log = createLogger('HTTP');

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error'
                : res.statusCode >= 400 ? 'warn'
                : 'info';

    log[level]({
      method:     req.method,
      path:       req.path,
      statusCode: res.statusCode,
      duration,
      ip:         req.ip,
      userAgent:  req.headers['user-agent'],
      userId:     req.auth?.userId,
    }, `${req.method} ${req.path} ${res.statusCode} — ${duration}ms`);
  });

  next();
}
