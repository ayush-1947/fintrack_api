// prisma/seed.ts
// Run with: npx ts-node prisma/seed.ts
// Creates sample users + transactions for local development

import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

const HASH_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
} as const;

async function main() {
  console.log('🌱 Seeding database...');

  // ─── Users ─────────────────────────────────────────────────────────────────
  const adminHash   = await argon2.hash('Admin1234!',   HASH_OPTIONS);
  const analystHash = await argon2.hash('Analyst1234!', HASH_OPTIONS);
  const viewerHash  = await argon2.hash('Viewer1234!',  HASH_OPTIONS);

  const admin = await prisma.user.upsert({
    where:  { email: 'admin@fintrack.io' },
    update: {},
    create: {
      email:           'admin@fintrack.io',
      passwordHash:    adminHash,
      firstName:       'Admin',
      lastName:        'User',
      role:            'ADMIN',
      isEmailVerified: true,
      isActive:        true,
    },
  });

  const analyst = await prisma.user.upsert({
    where:  { email: 'analyst@fintrack.io' },
    update: {},
    create: {
      email:           'analyst@fintrack.io',
      passwordHash:    analystHash,
      firstName:       'Jane',
      lastName:        'Analyst',
      role:            'ANALYST',
      isEmailVerified: true,
      isActive:        true,
    },
  });

  const viewer = await prisma.user.upsert({
    where:  { email: 'viewer@fintrack.io' },
    update: {},
    create: {
      email:           'viewer@fintrack.io',
      passwordHash:    viewerHash,
      firstName:       'Bob',
      lastName:        'Viewer',
      role:            'VIEWER',
      isEmailVerified: true,
      isActive:        true,
    },
  });

  console.log(`✅ Created users: ${admin.email}, ${analyst.email}, ${viewer.email}`);

  // ─── Transactions for analyst (12 months of data) ─────────────────────────
  const categories = {
    income:  ['SALARY', 'FREELANCE', 'INVESTMENT'] as const,
    expense: ['FOOD', 'TRANSPORT', 'HOUSING', 'HEALTH', 'ENTERTAINMENT', 'UTILITIES'] as const,
  };

  const txns = [];
  const year = 2024;

  for (let month = 1; month <= 12; month++) {
    // Monthly salary
    txns.push({
      userId:      analyst.id,
      amount:      5500,
      type:        'INCOME' as const,
      category:    'SALARY' as const,
      description: `Salary — ${year}-${String(month).padStart(2, '0')}`,
      tags:        ['salary', 'monthly'],
      occurredAt:  new Date(year, month - 1, 1),
    });

    // Freelance (some months)
    if (month % 3 === 0) {
      txns.push({
        userId:      analyst.id,
        amount:      Math.round(Math.random() * 2000 + 500),
        type:        'INCOME' as const,
        category:    'FREELANCE' as const,
        description: 'Freelance project payment',
        tags:        ['freelance'],
        occurredAt:  new Date(year, month - 1, 15),
      });
    }

    // Expenses
    const expenseAmounts: Record<string, number> = {
      FOOD:          Math.round(Math.random() * 400 + 300),
      TRANSPORT:     Math.round(Math.random() * 100 + 80),
      HOUSING:       1800,
      HEALTH:        Math.round(Math.random() * 200 + 50),
      ENTERTAINMENT: Math.round(Math.random() * 150 + 50),
      UTILITIES:     Math.round(Math.random() * 100 + 80),
    };

    for (const [cat, amount] of Object.entries(expenseAmounts)) {
      txns.push({
        userId:      analyst.id,
        amount,
        type:        'EXPENSE' as const,
        category:    cat as any,
        description: `${cat} — ${month}/${year}`,
        tags:        [cat.toLowerCase()],
        occurredAt:  new Date(year, month - 1, Math.floor(Math.random() * 25) + 1),
      });
    }
  }

  await prisma.transaction.deleteMany({ where: { userId: analyst.id } });
  await prisma.transaction.createMany({ data: txns });

  console.log(`✅ Created ${txns.length} transactions for analyst@fintrack.io`);
  console.log('\n📋 Seed credentials:');
  console.log('  admin@fintrack.io    / Admin1234!    (ADMIN)');
  console.log('  analyst@fintrack.io  / Analyst1234!  (ANALYST)');
  console.log('  viewer@fintrack.io   / Viewer1234!   (VIEWER)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
