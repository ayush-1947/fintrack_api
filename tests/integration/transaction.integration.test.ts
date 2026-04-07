// tests/integration/transaction.integration.test.ts
import request from 'supertest';
import { createApp } from '../../src/app';
import { prisma }    from '@infrastructure/database/prisma.client';
import type { Application } from 'express';

let app: Application;
let accessToken: string;
let userId: string;

const USER = {
  email:     'txn_user@test.com',
  password:  'StrongPass1!',
  firstName: 'Txn',
  lastName:  'User',
};

const TRANSACTION_PAYLOAD = {
  amount:      1500.00,
  type:        'INCOME',
  category:    'SALARY',
  description: 'Monthly salary',
  occurredAt:  '2024-03-01T00:00:00.000Z',
};

beforeAll(async () => {
  app = createApp();
  await prisma.transaction.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany({ where: { email: USER.email } });

  // Register + verify + login
  const signupRes = await request(app).post('/api/v1/auth/signup').send(USER);
  userId = signupRes.body.data.user.id;
  await prisma.user.update({ where: { id: userId }, data: { isEmailVerified: true } });

  const loginRes = await request(app).post('/api/v1/auth/login').send({
    email: USER.email, password: USER.password,
  });
  accessToken = loginRes.body.data.tokens.accessToken;
});

afterAll(async () => {
  await prisma.transaction.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  await prisma.$disconnect();
});

describe('POST /api/v1/transactions', () => {
  it('should create a transaction', async () => {
    const res = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(TRANSACTION_PAYLOAD)
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.type).toBe('INCOME');
    expect(parseFloat(res.body.data.amount)).toBe(1500.00);
  });

  it('should return 422 for negative amount', async () => {
    const res = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ ...TRANSACTION_PAYLOAD, amount: -100 })
      .expect(422);

    expect(res.body.errorCode).toBe('VALIDATION_ERROR');
  });

  it('should return 401 without auth token', async () => {
    await request(app).post('/api/v1/transactions').send(TRANSACTION_PAYLOAD).expect(401);
  });
});

describe('GET /api/v1/transactions', () => {
  it('should list transactions with pagination', async () => {
    const res = await request(app)
      .get('/api/v1/transactions?page=1&limit=10')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.pagination).toMatchObject({
      page:  1,
      limit: 10,
    });
  });

  it('should filter by type', async () => {
    const res = await request(app)
      .get('/api/v1/transactions?type=INCOME')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.data.every((t: any) => t.type === 'INCOME')).toBe(true);
  });

  it('should filter by category', async () => {
    const res = await request(app)
      .get('/api/v1/transactions?category=SALARY')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.data.every((t: any) => t.category === 'SALARY')).toBe(true);
  });
});

describe('PATCH /api/v1/transactions/:id', () => {
  let txId: string;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(TRANSACTION_PAYLOAD);
    txId = res.body.data.id;
  });

  it('should update a transaction', async () => {
    const res = await request(app)
      .patch(`/api/v1/transactions/${txId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ description: 'Updated description', amount: 2000 })
      .expect(200);

    expect(parseFloat(res.body.data.amount)).toBe(2000);
    expect(res.body.data.description).toBe('Updated description');
  });

  it('should return 404 for non-existent transaction', async () => {
    await request(app)
      .patch('/api/v1/transactions/non-existent-id')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ amount: 100 })
      .expect(404);
  });
});

describe('DELETE /api/v1/transactions/:id', () => {
  let txId: string;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(TRANSACTION_PAYLOAD);
    txId = res.body.data.id;
  });

  it('should soft-delete a transaction', async () => {
    await request(app)
      .delete(`/api/v1/transactions/${txId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    // Should no longer appear in listing
    const listRes = await request(app)
      .get(`/api/v1/transactions?search=Monthly salary`)
      .set('Authorization', `Bearer ${accessToken}`);

    const found = listRes.body.data.find((t: any) => t.id === txId);
    expect(found).toBeUndefined();
  });
});
