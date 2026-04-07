// src/services/auth/presentation/controllers/auth.controller.ts
import type { Request, Response, NextFunction } from 'express';
import { fromZodError } from 'zod-validation-error';
import { AppError } from '@shared/errors/AppError';
import { createLogger } from '@infrastructure/logger';
import {
  SignupDto,
  LoginDto,
  RefreshTokenDto,
  VerifyEmailDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from '../../application/dtos/auth.dto';
import { SignupUseCase } from '../../application/use-cases/signup.use-case';
import {
  LoginUseCase,
  RefreshTokenUseCase,
  LogoutUseCase,
  VerifyEmailUseCase,
  ForgotPasswordUseCase,
  ResetPasswordUseCase,
} from '../../application/use-cases/auth.use-cases';
import { UserPrismaRepository } from '../../infrastructure/repositories/user.prisma.repository';
import { RefreshTokenPrismaRepository } from '../../infrastructure/repositories/refresh-token.repository';

const log = createLogger('AuthController');

// ─── Dependency Wiring ────────────────────────────────────────────────────────
// In a full DI container (InversifyJS / tsyringe) this would be injected.
const userRepo         = new UserPrismaRepository();
const refreshTokenRepo = new RefreshTokenPrismaRepository();

const signupUseCase        = new SignupUseCase(userRepo);
const loginUseCase         = new LoginUseCase(userRepo, refreshTokenRepo);
const refreshTokenUseCase  = new RefreshTokenUseCase(userRepo, refreshTokenRepo);
const logoutUseCase        = new LogoutUseCase(refreshTokenRepo);
const verifyEmailUseCase   = new VerifyEmailUseCase(userRepo);
const forgotPasswordUseCase= new ForgotPasswordUseCase(userRepo);
const resetPasswordUseCase = new ResetPasswordUseCase(userRepo, refreshTokenRepo);

// ─── Controller ───────────────────────────────────────────────────────────────
export class AuthController {
  // POST /auth/signup
  async signup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = SignupDto.safeParse(req.body);
      if (!parsed.success) {
        throw AppError.validationError(
          fromZodError(parsed.error).message,
          parsed.error.flatten().fieldErrors,
        );
      }

      const result = await signupUseCase.execute(parsed.data);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  // POST /auth/login
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = LoginDto.safeParse(req.body);
      if (!parsed.success) {
        throw AppError.validationError(fromZodError(parsed.error).message);
      }

      const { tokens, user } = await loginUseCase.execute(parsed.data, {
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
      });

      res.status(200).json({ success: true, data: { tokens, user } });
    } catch (err) {
      next(err);
    }
  }

  // POST /auth/refresh
  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = RefreshTokenDto.safeParse(req.body);
      if (!parsed.success) throw AppError.validationError('refreshToken is required');

      const tokens = await refreshTokenUseCase.execute(parsed.data.refreshToken, {
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
      });

      res.status(200).json({ success: true, data: { tokens } });
    } catch (err) {
      next(err);
    }
  }

  // POST /auth/logout
  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = RefreshTokenDto.safeParse(req.body);
      if (!parsed.success) throw AppError.validationError('refreshToken is required');

      const jti = (req as any).auth?.jti as string | undefined;
      await logoutUseCase.execute(parsed.data.refreshToken, jti);

      res.status(200).json({ success: true, message: 'Logged out successfully' });
    } catch (err) {
      next(err);
    }
  }

  // GET /auth/verify-email?token=xxx
  async verifyEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = VerifyEmailDto.safeParse(req.query);
      if (!parsed.success) throw AppError.validationError('token is required');

      await verifyEmailUseCase.execute(parsed.data.token);
      res.status(200).json({ success: true, message: 'Email verified successfully' });
    } catch (err) {
      next(err);
    }
  }

  // POST /auth/forgot-password
  async forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = ForgotPasswordDto.safeParse(req.body);
      if (!parsed.success) throw AppError.validationError(fromZodError(parsed.error).message);

      await forgotPasswordUseCase.execute(parsed.data.email);
      // Always same response to prevent email enumeration
      res.status(200).json({ success: true, message: 'If that email exists, a reset link has been sent.' });
    } catch (err) {
      next(err);
    }
  }

  // POST /auth/reset-password
  async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = ResetPasswordDto.safeParse(req.body);
      if (!parsed.success) {
        throw AppError.validationError(
          fromZodError(parsed.error).message,
          parsed.error.flatten().fieldErrors,
        );
      }

      await resetPasswordUseCase.execute(parsed.data.token, parsed.data.password);
      res.status(200).json({ success: true, message: 'Password reset successfully. Please log in.' });
    } catch (err) {
      next(err);
    }
  }

  // GET /auth/me  (protected)
  async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await userRepo.findById((req as any).auth.userId);
      if (!user) throw AppError.unauthorized();

      res.status(200).json({ success: true, data: { user: user.toPublic() } });
    } catch (err) {
      next(err);
    }
  }
}

export const authController = new AuthController();
