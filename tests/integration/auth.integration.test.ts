// tests/integration/auth.integration.test.ts
//
// Integration tests hit the real Express app with mocked infra (Redis, queues).
// The database is real (test DB). Run with: npm run test:integration

import request from 'supertest';
import { createApp } from '../../src/app';
import { prisma }    from '@infrastructure/database/prisma.client';
import type { Application } from 'express';

let app: Application;

beforeAll(async () => {
  app = createApp();
  // Clean slate
  await prisma.refreshToken.deleteMany();
  await prisma.passwordReset.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.user.deleteMany();
  await prisma.$disconnect();
});

describe('POST /api/v1/auth/signup', () => {
  const payload = {
    email:     'integration@test.com',
    password:  'StrongPass1!',
    firstName: 'Integration',
    lastName:  'Test',
  };

  it('should create a new user', async () => {
    const res = await request(app)
      .post('/api/v1/auth/signup')
      .send(payload)
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(payload.email);
    expect(res.body.data.user).not.toHaveProperty('passwordHash');
  });

  it('should return 409 if email already exists', async () => {
    const res = await request(app)
      .post('/api/v1/auth/signup')
      .send(payload)
      .expect(409);

    expect(res.body.errorCode).toBe('CONFLICT');
  });

  it('should return 422 with invalid email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/signup')
      .send({ ...payload, email: 'not-an-email' })
      .expect(422);

    expect(res.body.errorCode).toBe('VALIDATION_ERROR');
  });

  it('should return 422 with weak password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/signup')
      .send({ ...payload, email: 'other@test.com', password: 'weak' })
      .expect(422);

    expect(res.body.errorCode).toBe('VALIDATION_ERROR');
  });
});

describe('POST /api/v1/auth/login', () => {
  beforeAll(async () => {
    // Directly set user as email-verified for login tests
    await prisma.user.updateMany({
      where: { email: 'integration@test.com' },
      data:  { isEmailVerified: true },
    });
  });

  it('should return tokens on valid credentials', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'integration@test.com', password: 'StrongPass1!' })
      .expect(200);

    expect(res.body.data.tokens.accessToken).toBeTruthy();
    expect(res.body.data.tokens.refreshToken).toBeTruthy();
    expect(res.body.data.user.email).toBe('integration@test.com');
  });

  it('should return 401 with wrong password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'integration@test.com', password: 'WrongPass1!' })
      .expect(401);

    expect(res.body.errorCode).toBe('INVALID_CREDENTIALS');
  });

  it('should return 401 for non-existent user', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'ghost@test.com', password: 'SomePass1!' })
      .expect(401);

    expect(res.body.errorCode).toBe('INVALID_CREDENTIALS');
  });
});

describe('GET /api/v1/auth/me', () => {
  let accessToken: string;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'integration@test.com', password: 'StrongPass1!' });
    accessToken = res.body.data.tokens.accessToken;
  });

  it('should return current user with valid token', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.data.user.email).toBe('integration@test.com');
  });

  it('should return 401 without token', async () => {
    await request(app).get('/api/v1/auth/me').expect(401);
  });

  it('should return 401 with malformed token', async () => {
    await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer not.a.token')
      .expect(401);
  });
});

describe('GET /health', () => {
  it('should return health status', async () => {
    const res = await request(app).get('/health').expect(200);
    expect(res.body.status).toBe('ok');
  });
});
