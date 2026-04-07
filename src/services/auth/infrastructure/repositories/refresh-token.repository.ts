// src/services/auth/infrastructure/repositories/refresh-token.repository.ts
import { prisma } from '@infrastructure/database/prisma.client';
import { v4 as uuidv4 } from 'uuid';

export interface RefreshTokenRecord {
  id: string;
  token: string;
  userId: string;
  userAgent?: string | null;
  ipAddress?: string | null;
  isRevoked: boolean;
  expiresAt: Date;
  createdAt: Date;
}

export interface IRefreshTokenRepository {
  create(input: {
    token: string;
    userId: string;
    expiresAt: Date;
    userAgent?: string;
    ipAddress?: string;
  }): Promise<RefreshTokenRecord>;
  findByToken(token: string): Promise<RefreshTokenRecord | null>;
  findById(id: string): Promise<RefreshTokenRecord | null>;
  revoke(id: string): Promise<void>;
  revokeAllForUser(userId: string): Promise<void>;
  deleteExpired(): Promise<number>;
}

export class RefreshTokenPrismaRepository implements IRefreshTokenRepository {
  async create(input: {
    token: string;
    userId: string;
    expiresAt: Date;
    userAgent?: string;
    ipAddress?: string;
  }): Promise<RefreshTokenRecord> {
    return prisma.refreshToken.create({
      data: {
        id: uuidv4(),
        token: input.token,
        userId: input.userId,
        expiresAt: input.expiresAt,
        userAgent: input.userAgent,
        ipAddress: input.ipAddress,
      },
    });
  }

  async findByToken(token: string): Promise<RefreshTokenRecord | null> {
    return prisma.refreshToken.findUnique({ where: { token } });
  }

  async findById(id: string): Promise<RefreshTokenRecord | null> {
    return prisma.refreshToken.findUnique({ where: { id } });
  }

  async revoke(id: string): Promise<void> {
    await prisma.refreshToken.update({
      where: { id },
      data: { isRevoked: true },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true },
    });
  }

  async deleteExpired(): Promise<number> {
    const result = await prisma.refreshToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return result.count;
  }
}
