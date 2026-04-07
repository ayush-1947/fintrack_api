// src/shared/types/index.ts

// ─── Pagination ───────────────────────────────────────────────────────────────
export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// ─── Sorting ─────────────────────────────────────────────────────────────────
export interface SortParams {
  field: string;
  direction: 'asc' | 'desc';
}

// ─── Auth Context ─────────────────────────────────────────────────────────────
export interface AuthContext {
  userId: string;
  email: string;
  role: UserRole;
  sessionId: string;
}

export type UserRole = 'VIEWER' | 'ANALYST' | 'ADMIN';

// ─── API Response ─────────────────────────────────────────────────────────────
export interface ApiResponse<T = undefined> {
  success: boolean;
  message?: string;
  data?: T;
  meta?: Record<string, unknown>;
}

// ─── JWT Payload ──────────────────────────────────────────────────────────────
export interface AccessTokenPayload {
  sub: string;        // userId
  email: string;
  role: UserRole;
  sessionId: string;
  type: 'access';
}

export interface RefreshTokenPayload {
  sub: string;        // userId
  tokenId: string;    // RefreshToken.id in DB
  type: 'refresh';
}

// ─── Events ───────────────────────────────────────────────────────────────────
export interface DomainEvent<T = unknown> {
  eventId: string;
  eventType: string;
  occurredAt: Date;
  payload: T;
  metadata?: Record<string, unknown>;
}

// ─── Repository interfaces ────────────────────────────────────────────────────
export interface BaseRepository<T, ID = string> {
  findById(id: ID): Promise<T | null>;
  save(entity: T): Promise<T>;
  delete(id: ID): Promise<void>;
}
