// src/shared/utils/async-handler.ts
// Utility for clean async route handler wrapping
import type { Request, Response, NextFunction, RequestHandler } from 'express';

type AsyncFn = (req: Request, res: Response, next: NextFunction) => Promise<void>;

/**
 * Wraps an async Express handler so rejection is forwarded to next()
 * automatically — avoids the try/catch boilerplate in every controller.
 *
 * Usage:
 *   router.get('/path', asyncHandler(myController.method))
 */
export const asyncHandler = (fn: AsyncFn): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
