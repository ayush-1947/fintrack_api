// src/workers/index.ts
import { createWorker, QUEUES, type EmailJobData, type AnalyticsJobData, type AuditJobData } from '@infrastructure/queue';
import { emailService }   from '@services/auth/infrastructure/services/email.service';
import { prisma }         from '@infrastructure/database/prisma.client';
import { createLogger }   from '@infrastructure/logger';

const log = createLogger('Workers');

export function startWorkers(): void {
  // ─── Email Worker ──────────────────────────────────────────────────────────
  createWorker<EmailJobData>(QUEUES.EMAIL, async (job) => {
    const { type, to, payload } = job.data;
    log.info({ jobId: job.id, type, to }, 'Processing email job');

    switch (type) {
      case 'VERIFY_EMAIL':
        await emailService.sendVerificationEmail(to, payload.token, payload.name);
        break;
      case 'PASSWORD_RESET':
        await emailService.sendPasswordResetEmail(to, payload.token, payload.name);
        break;
      case 'WELCOME':
        await emailService.sendWelcomeEmail(to, payload.name);
        break;
      default:
        log.warn({ type }, 'Unknown email job type');
    }
  }, 3); // concurrency: 3 email senders

  // ─── Analytics Worker ──────────────────────────────────────────────────────
  // Recomputes pre-aggregated monthly snapshots asynchronously.
  // This keeps the analytics read path fast while write path stays simple.
  createWorker<AnalyticsJobData>(QUEUES.ANALYTICS, async (job) => {
    const { userId, year, month } = job.data;
    log.info({ jobId: job.id, userId, year, month }, 'Recomputing monthly snapshot');

    const startDate = new Date(year, month - 1, 1);
    const endDate   = new Date(year, month, 0, 23, 59, 59, 999);

    const grouped = await prisma.transaction.groupBy({
      by:    ['type'],
      where: { userId, isDeleted: false, occurredAt: { gte: startDate, lte: endDate } },
      _sum:  { amount: true },
      _count:{ id: true },
    });

    let totalIncome  = 0;
    let totalExpense = 0;
    let count        = 0;

    for (const row of grouped) {
      const val = Number(row._sum.amount ?? 0);
      if (row.type === 'INCOME')  totalIncome  = val;
      if (row.type === 'EXPENSE') totalExpense = val;
      count += row._count.id;
    }

    await prisma.monthlySnapshot.upsert({
      where:  { userId_year_month: { userId, year, month } },
      update: { totalIncome, totalExpense, netBalance: totalIncome - totalExpense, transactionCount: count, computedAt: new Date() },
      create: { userId, year, month, totalIncome, totalExpense, netBalance: totalIncome - totalExpense, transactionCount: count },
    });
  }, 2);

  // ─── Audit Log Worker ──────────────────────────────────────────────────────
  createWorker<AuditJobData>(QUEUES.AUDIT, async (job) => {
    const d = job.data;
    await prisma.auditLog.create({
      data: {
        userId:     d.userId,
        action:     d.action,
        resource:   d.resource,
        resourceId: d.resourceId,
        metadata:   d.metadata as any,
        ipAddress:  d.ipAddress,
        userAgent:  d.userAgent,
      },
    });
  }, 10); // high concurrency — fire-and-forget audit writes

  log.info('All BullMQ workers started');
}
