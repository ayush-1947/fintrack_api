// src/services/analytics/presentation/routes/analytics.routes.ts
import { Router } from 'express';
import { analyticsController } from '../controllers/analytics.controller';
import { authenticate, requireRole } from '@shared/middleware/auth.middleware';

export const analyticsRouter = Router();

// All analytics require auth + ANALYST or higher role
analyticsRouter.use(authenticate);
analyticsRouter.use(requireRole('ANALYST', 'ADMIN'));

analyticsRouter.get('/overview',   (req, res, next) => analyticsController.overview(req, res, next));
analyticsRouter.get('/trends',     (req, res, next) => analyticsController.monthlyTrends(req, res, next));
analyticsRouter.get('/categories', (req, res, next) => analyticsController.categoryBreakdown(req, res, next));
analyticsRouter.get('/recent',     (req, res, next) => analyticsController.recentActivity(req, res, next));
