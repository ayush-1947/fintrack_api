// src/app.ts
import express, { type Application, type Request, type Response, type NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { config } from '@shared/config';
import { createLogger } from '@infrastructure/logger';
import { apiRateLimiter } from '@shared/middleware/rateLimiter.middleware';
import { errorHandler, notFoundHandler } from '@shared/middleware/errorHandler.middleware';
import { setupSwagger } from '@infrastructure/swagger/swagger';
import { authRouter }        from '@services/auth/presentation/routes/auth.routes';
import { transactionRouter } from '@services/transaction/presentation/routes/transaction.routes';
import { analyticsRouter }   from '@services/analytics/presentation/routes/analytics.routes';

const log = createLogger('App');

export function createApp(): Application {
  const app = express();

  // ─── Trust Proxy (correct IP behind load balancer / Nginx) ────────────────
  app.set('trust proxy', 1);

  // ─── Helmet — disabled on /api-docs so Swagger UI CDN assets load ─────────
  // Swagger UI loads scripts/styles from unpkg.com CDN.
  // We disable Helmet selectively for the docs route only.
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api-docs')) return next();
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc:  ["'self'"],
          styleSrc:   ["'self'", "'unsafe-inline'"],
          imgSrc:     ["'self'", 'data:'],
          objectSrc:  ["'none'"],
          upgradeInsecureRequests: [],
        },
      },
      crossOriginEmbedderPolicy: true,
      hsts: { maxAge: 31536000, includeSubDomains: true },
    })(req, res, next);
  });

  // ─── CORS ──────────────────────────────────────────────────────────────────
  app.use(cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      const allowed = (process.env.CORS_ORIGINS ?? config.APP_URL).split(',');
      if (allowed.includes(origin)) return cb(null, true);
      cb(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));

  // ─── Body Parsing + Compression ────────────────────────────────────────────
  app.use(compression());
  app.use(express.json({ limit: '10kb' }));
  app.use(express.urlencoded({ extended: false, limit: '10kb' }));

  // ─── Request Logging ───────────────────────────────────────────────────────
  if (config.ENABLE_REQUEST_LOGGING) {
    app.use((req: Request, _res: Response, next: NextFunction) => {
      log.info({ method: req.method, path: req.path, ip: req.ip }, 'Incoming request');
      next();
    });
  }

  // ─── Root redirect → Swagger UI ───────────────────────────────────────────
  app.get('/', (_req: Request, res: Response) => {
    res.redirect('/api-docs');
  });

  // ─── Health Check ─────────────────────────────────────────────────────────
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
      status:    'ok',
      service:   config.APP_NAME,
      version:   process.env.npm_package_version ?? '1.0.0',
      uptime:    Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      docs:      `${config.APP_URL}/api-docs`,
    });
  });

  // ─── Swagger Docs (no rate limit, no Helmet on this path) ─────────────────
  setupSwagger(app);

  // ─── Global Rate Limiter (API routes only) ─────────────────────────────────
  app.use('/api', apiRateLimiter);

  // ─── API Routes ────────────────────────────────────────────────────────────
  app.use('/api/v1/auth',         authRouter);
  app.use('/api/v1/transactions', transactionRouter);
  app.use('/api/v1/analytics',    analyticsRouter);

  // ─── Error Handling ───────────────────────────────────────────────────────
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
