// src/shared/errors/AppError.ts

export enum ErrorCode {
  // Auth
  UNAUTHORIZED        = 'UNAUTHORIZED',
  FORBIDDEN           = 'FORBIDDEN',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED       = 'TOKEN_EXPIRED',
  TOKEN_INVALID       = 'TOKEN_INVALID',
  EMAIL_NOT_VERIFIED  = 'EMAIL_NOT_VERIFIED',
  EMAIL_ALREADY_EXISTS= 'EMAIL_ALREADY_EXISTS',

  // Resource
  NOT_FOUND           = 'NOT_FOUND',
  CONFLICT            = 'CONFLICT',

  // Validation
  VALIDATION_ERROR    = 'VALIDATION_ERROR',
  INVALID_INPUT       = 'INVALID_INPUT',

  // Rate limit
  TOO_MANY_REQUESTS   = 'TOO_MANY_REQUESTS',

  // Server
  INTERNAL_ERROR      = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: ErrorCode;
  public readonly details?: unknown;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number,
    errorCode: ErrorCode,
    details?: unknown,
    isOperational = true,
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.isOperational = isOperational;

    // Preserve prototype chain in TypeScript
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }

  // ─── Factory Helpers ──────────────────────────────────────────────────────

  static unauthorized(message = 'Unauthorized', details?: unknown): AppError {
    return new AppError(message, 401, ErrorCode.UNAUTHORIZED, details);
  }

  static forbidden(message = 'Forbidden', details?: unknown): AppError {
    return new AppError(message, 403, ErrorCode.FORBIDDEN, details);
  }

  static notFound(resource: string, id?: string): AppError {
    const message = id ? `${resource} with id '${id}' not found` : `${resource} not found`;
    return new AppError(message, 404, ErrorCode.NOT_FOUND);
  }

  static conflict(message: string, details?: unknown): AppError {
    return new AppError(message, 409, ErrorCode.CONFLICT, details);
  }

  static validationError(message: string, details?: unknown): AppError {
    return new AppError(message, 422, ErrorCode.VALIDATION_ERROR, details);
  }

  static invalidCredentials(): AppError {
    return new AppError('Invalid email or password', 401, ErrorCode.INVALID_CREDENTIALS);
  }

  static tokenExpired(): AppError {
    return new AppError('Token has expired', 401, ErrorCode.TOKEN_EXPIRED);
  }

  static tokenInvalid(): AppError {
    return new AppError('Token is invalid', 401, ErrorCode.TOKEN_INVALID);
  }

  static internal(message = 'Internal server error'): AppError {
    return new AppError(message, 500, ErrorCode.INTERNAL_ERROR, undefined, false);
  }

  toJSON() {
    return {
      error: this.message,
      errorCode: this.errorCode,
      details: this.details,
    };
  }
}
