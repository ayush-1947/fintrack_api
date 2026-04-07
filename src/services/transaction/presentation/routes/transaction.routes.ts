// src/services/transaction/presentation/routes/transaction.routes.ts
import { Router } from 'express';
import { transactionController } from '../controllers/transaction.controller';
import { authenticate } from '@shared/middleware/auth.middleware';

export const transactionRouter = Router();

// All transaction routes require authentication
transactionRouter.use(authenticate);

transactionRouter.post(  '/',   (req, res, next) => transactionController.create(req, res, next));
transactionRouter.get(   '/',   (req, res, next) => transactionController.list(req, res, next));
transactionRouter.get(   '/:id',(req, res, next) => transactionController.getOne(req, res, next));
transactionRouter.patch( '/:id',(req, res, next) => transactionController.update(req, res, next));
transactionRouter.delete('/:id',(req, res, next) => transactionController.delete(req, res, next));
