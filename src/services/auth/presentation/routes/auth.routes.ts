// src/services/auth/presentation/routes/auth.routes.ts
import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { authenticate } from '@shared/middleware/auth.middleware';
import { authRateLimiter } from '@shared/middleware/rateLimiter.middleware';

export const authRouter = Router();

// Public routes (with stricter rate limiting)
authRouter.post('/signup',          authRateLimiter, (req, res, next) => authController.signup(req, res, next));
authRouter.post('/login',           authRateLimiter, (req, res, next) => authController.login(req, res, next));
authRouter.post('/refresh',         authRateLimiter, (req, res, next) => authController.refresh(req, res, next));
authRouter.post('/logout',          authenticate,    (req, res, next) => authController.logout(req, res, next));
authRouter.get( '/verify-email',                     (req, res, next) => authController.verifyEmail(req, res, next));
authRouter.post('/forgot-password', authRateLimiter, (req, res, next) => authController.forgotPassword(req, res, next));
authRouter.post('/reset-password',                   (req, res, next) => authController.resetPassword(req, res, next));

// Protected routes
authRouter.get('/me', authenticate, (req, res, next) => authController.me(req, res, next));
