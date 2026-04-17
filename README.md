# FinTrack Backend

> **Production-grade Finance Tracking Platform** — Clean Architecture · Microservices-ready · Distributed Systems

[![CI/CD](https://github.com/your-org/fintrack/actions/workflows/ci.yml/badge.svg)](https://github.com/your-org/fintrack/actions)
[![Coverage](https://codecov.io/gh/your-org/fintrack/badge.svg)](https://codecov.io/gh/your-org/fintrack)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Clean Architecture Breakdown](#2-clean-architecture-breakdown)
3. [Service Interaction Diagram](#3-service-interaction-diagram)
4. [Database Schema](#4-database-schema)
5. [Auth Flow](#5-auth-flow)
6. [Request Lifecycle](#6-request-lifecycle)
7. [Caching Layer](#7-caching-layer)
8. [Event-Driven Flow](#8-event-driven-flow)
9. [CAP Theorem Tradeoffs](#9-cap-theorem-tradeoffs)
10. [Tech Stack Justification](#10-tech-stack-justification)
11. [RBAC Model](#11-rbac-model)
12. [API Documentation](#12-api-documentation)
13. [Setup Instructions](#13-setup-instructions)
14. [Microservices Evolution Plan](#14-microservices-evolution-plan)
15. [Scaling Strategy](#15-scaling-strategy)

---

## 1. Architecture Overview

```mermaid
graph TB
  subgraph Clients
    WEB[Web App]
    MOB[Mobile App]
    API_CLIENT[API Clients]
  end

  subgraph Edge
    LB[Load Balancer / Nginx]
    CDN[CDN]
  end

  subgraph FinTrack Backend
    direction TB
    subgraph REST_API[REST API Layer :3000]
      AUTH_R[Auth Routes]
      TXN_R[Transaction Routes]
      ANA_R[Analytics Routes]
    end

    subgraph gRPC_Layer[Internal gRPC :50051-50053]
      AUTH_G[Auth gRPC Server]
    end

    subgraph Application
      UC_AUTH[Auth Use Cases]
      UC_TXN[Transaction Use Cases]
      UC_ANA[Analytics Use Cases]
    end

    subgraph Domain
      ENT[Entities]
      REPO_I[Repository Interfaces]
    end

    subgraph Infrastructure
      PG[(PostgreSQL)]
      REDIS[(Redis)]
      QUEUE[BullMQ Workers]
      EVTBUS[Event Bus]
      SMTP[SMTP / Email]
    end
  end

  WEB & MOB & API_CLIENT --> LB
  LB --> REST_API
  REST_API --> Application
  Application --> Domain
  Domain --> Infrastructure
  gRPC_Layer --> Application
```

---

## 2. Clean Architecture Breakdown

The entire system follows **Uncle Bob's Clean Architecture** — dependency arrows always point inward.

```mermaid
graph LR
  subgraph OUTER[Frameworks & Drivers]
    EXPRESS[Express.js]
    PRISMA[Prisma ORM]
    REDIS_CLIENT[ioredis]
    BULLMQ[BullMQ]
    GRPC[gRPC]
  end

  subgraph INTERFACE[Interface Adapters]
    CONTROLLERS[Controllers]
    ROUTES[Routes]
    REPOS_IMPL[Repository Implementations]
    SERVICES_IMPL[Service Implementations]
  end

  subgraph APP[Application Layer]
    USE_CASES[Use Cases]
    DTOS[DTOs / Zod Schemas]
  end

  subgraph DOMAIN[Domain - Core]
    ENTITIES[Entities]
    REPO_IFACE[Repository Interfaces]
    DOMAIN_SVC[Domain Services]
  end

  OUTER --> INTERFACE
  INTERFACE --> APP
  APP --> DOMAIN

  style DOMAIN fill:#4F46E5,color:#fff
  style APP    fill:#7C3AED,color:#fff
  style INTERFACE fill:#9333EA,color:#fff
  style OUTER fill:#1e1e2e,color:#cdd6f4
```

### Layer Responsibilities

| Layer | Location | Responsibility |
|-------|----------|---------------|
| **Domain** | `src/services/*/domain/` | Entities, business rules, repository interfaces. Zero external dependencies. |
| **Application** | `src/services/*/application/` | Use cases, orchestration, DTOs. Depends only on Domain. |
| **Infrastructure** | `src/services/*/infrastructure/` | Prisma repos, token service, email. Implements Domain interfaces. |
| **Presentation** | `src/services/*/presentation/` | Express controllers, routes, validation. Calls Application. |
| **Shared Infrastructure** | `src/infrastructure/` | Redis, BullMQ, logger, gRPC. Cross-cutting concerns. |

---

## 3. Service Interaction Diagram

```mermaid
sequenceDiagram
  participant C  as Client
  participant API as REST API
  participant AUTH as Auth Service
  participant TXN  as Transaction Service
  participant ANA  as Analytics Service
  participant REDIS as Redis Cache
  participant PG    as PostgreSQL
  participant QUEUE as BullMQ
  participant EVT   as Event Bus

  Note over API,EVT: All internal — same process today, separate processes tomorrow

  C->>API: POST /transactions (Bearer token)
  API->>AUTH: verifyAccessToken() [in-process / gRPC]
  AUTH->>REDIS: Check token blacklist
  REDIS-->>AUTH: Not blacklisted
  AUTH-->>API: AuthContext {userId, role}

  API->>TXN: createTransaction(userId, dto)
  TXN->>PG: INSERT transaction
  PG-->>TXN: Transaction record
  TXN->>REDIS: invalidate analytics cache
  TXN->>EVT: publish TRANSACTION_CREATED

  EVT->>QUEUE: enqueue analytics recompute job
  EVT->>QUEUE: enqueue audit log job

  TXN-->>API: Transaction entity
  API-->>C: 201 { data: transaction }

  Note over QUEUE,PG: Background (async)
  QUEUE->>ANA: recompute monthly snapshot
  ANA->>PG: groupBy aggregation
  ANA->>PG: upsert MonthlySnapshot
```

---

## 4. Database Schema

```mermaid
erDiagram
  users {
    uuid        id             PK
    varchar     email          UK
    varchar     password_hash
    varchar     first_name
    varchar     last_name
    enum        role           "VIEWER|ANALYST|ADMIN"
    boolean     is_email_verified
    varchar     email_verify_token
    timestamptz email_verify_expiry
    boolean     is_active
    timestamptz last_login_at
    timestamptz created_at
    timestamptz updated_at
  }

  refresh_tokens {
    uuid        id         PK
    varchar     token      UK
    uuid        user_id    FK
    varchar     user_agent
    varchar     ip_address
    boolean     is_revoked
    timestamptz expires_at
    timestamptz created_at
  }

  password_resets {
    uuid        id         PK
    varchar     token      UK
    uuid        user_id    FK
    boolean     is_used
    timestamptz expires_at
    timestamptz created_at
  }

  transactions {
    uuid        id          PK
    uuid        user_id     FK
    decimal     amount      "15,2"
    enum        type        "INCOME|EXPENSE"
    enum        category
    varchar     description
    text_array  tags
    timestamptz occurred_at
    boolean     is_deleted
    timestamptz created_at
    timestamptz updated_at
  }

  monthly_snapshots {
    uuid        id              PK
    uuid        user_id         FK
    int         year
    int         month
    decimal     total_income
    decimal     total_expense
    decimal     net_balance
    int         transaction_count
    timestamptz computed_at
  }

  audit_logs {
    uuid        id          PK
    uuid        user_id     FK
    varchar     action
    varchar     resource
    uuid        resource_id
    jsonb       metadata
    varchar     ip_address
    timestamptz created_at
  }

  users            ||--o{ refresh_tokens     : "has"
  users            ||--o{ password_resets    : "requests"
  users            ||--o{ transactions       : "owns"
  users            ||--o{ monthly_snapshots  : "has"
  users            ||--o{ audit_logs         : "generates"
```

### Indexing Strategy

| Table | Index | Rationale |
|-------|-------|-----------|
| `users` | `email` (unique) | Login lookup |
| `transactions` | `(user_id, occurred_at DESC)` | Date-range filtered lists |
| `transactions` | `(user_id, type)` | Type-filtered analytics |
| `transactions` | `(user_id, category)` | Category breakdown queries |
| `transactions` | `(user_id, is_deleted, occurred_at)` | Soft-delete aware list |
| `refresh_tokens` | `token` (unique), `user_id` | Token lookup + mass revocation |
| `monthly_snapshots` | `(user_id, year, month)` (unique) | Snapshot upsert |

---

## 5. Auth Flow

```mermaid
sequenceDiagram
  participant U as User
  participant API
  participant DB as PostgreSQL
  participant REDIS
  participant EMAIL as Email Queue

  rect rgb(30,30,60)
    Note over U,EMAIL: Registration Flow
    U->>API: POST /auth/signup
    API->>API: Validate DTO (Zod)
    API->>DB: Check email uniqueness
    API->>API: Hash password (Argon2id)
    API->>DB: INSERT user (unverified)
    API->>EMAIL: Queue VERIFY_EMAIL job
    API-->>U: 201 { user, message }
    EMAIL-->>U: Email with verify link
    U->>API: GET /auth/verify-email?token=xxx
    API->>DB: Mark isEmailVerified=true
    API-->>U: 200 Email verified
  end

  rect rgb(20,40,30)
    Note over U,REDIS: Login + Token Rotation
    U->>API: POST /auth/login
    API->>DB: findByEmail
    API->>API: argon2.verify(hash, password)
    API->>API: Sign Access Token (15m, HS256)
    API->>API: Sign Refresh Token (7d, HS256)
    API->>DB: INSERT refresh_token
    API-->>U: { accessToken, refreshToken }

    U->>API: POST /auth/refresh
    API->>API: Verify refresh JWT signature
    API->>DB: Find token (check isRevoked)
    API->>DB: Revoke old token
    API->>API: Issue new access + refresh tokens
    API->>DB: INSERT new refresh_token
    API-->>U: New token pair (rotation)
  end

  rect rgb(40,20,20)
    Note over U,REDIS: Logout + Revocation
    U->>API: POST /auth/logout
    API->>DB: Revoke refresh token
    API->>REDIS: Blacklist access token JTI (TTL=15m)
    API-->>U: 200 Logged out
  end
```

---

## 6. Request Lifecycle

```mermaid
flowchart TD
  REQ[Incoming Request] --> HELMET[Helmet Security Headers]
  HELMET --> CORS[CORS Check]
  CORS --> COMPRESS[Compression]
  COMPRESS --> PARSE[Body Parser 10kb limit]
  PARSE --> RATE[Rate Limiter Redis-backed]
  RATE -->|Allowed| AUTH_MW[Auth Middleware]
  RATE -->|Blocked| R429[429 Too Many Requests]
  AUTH_MW -->|Invalid token| R401[401 Unauthorized]
  AUTH_MW -->|Valid| RBAC[RBAC requireRole]
  RBAC -->|Insufficient role| R403[403 Forbidden]
  RBAC -->|Authorized| VALIDATE[Zod DTO Validation]
  VALIDATE -->|Invalid| R422[422 Validation Error]
  VALIDATE -->|Valid| USE_CASE[Use Case]
  USE_CASE --> REPO[Repository]
  REPO --> PG[(PostgreSQL)]
  USE_CASE --> CACHE{Cache Hit?}
  CACHE -->|Yes| CACHED[Return cached]
  CACHE -->|No| QUERY[Query DB]
  USE_CASE --> EVT[Publish Domain Event]
  USE_CASE --> RES[200/201 Response]
  USE_CASE -->|AppError| ERR_HANDLER[Error Handler]
  ERR_HANDLER --> ERROR_RES[4xx/5xx JSON]
```

---

## 7. Caching Layer

```mermaid
graph LR
  subgraph Redis
    direction TB
    BL["blacklist:token:{jti}\nTTL = 15m"]
    OV["analytics:overview:{userId}\nTTL = 5m"]
    MT["analytics:monthly:{userId}:{year}\nTTL = 5m"]
    CB["analytics:category:{userId}:{period}\nTTL = 5m"]
    RL["ratelimit:auth:{ip}\nTTL = sliding window"]
  end

  AUTH_MW -->|check| BL
  LOGOUT -->|write| BL
  ANALYTICS_UC -->|read/write| OV
  ANALYTICS_UC -->|read/write| MT
  ANALYTICS_UC -->|read/write| CB
  TXN_WRITE["Transaction Write\n(create/update/delete)"] -->|invalidate| OV
  TXN_WRITE -->|invalidate| MT & CB
  AUTH_ENDPOINTS -->|check| RL
```

### Cache Invalidation Strategy

- **Write-through on mutation** — any transaction change immediately purges all analytics keys for that user via `delPattern('analytics:*:${userId}:*')`.
- **TTL-based expiry** — 5-minute TTL as a safety net; slightly stale analytics are acceptable.
- **Bounded keys** — cache keys are always user-scoped, preventing cross-user data leakage.

---

## 8. Event-Driven Flow

```mermaid
graph TD
  TXN_CREATE[Transaction Created] -->|publish| EVTBUS[Event Bus\nIn-process → Kafka in prod]
  TXN_UPDATE[Transaction Updated] -->|publish| EVTBUS
  TXN_DELETE[Transaction Deleted] -->|publish| EVTBUS
  USER_REG[User Registered]       -->|publish| EVTBUS
  USER_LOGIN[User Logged In]      -->|publish| EVTBUS

  EVTBUS -->|subscribe| H1[Analytics Handler\nEnqueue snapshot recompute]
  EVTBUS -->|subscribe| H2[Audit Handler\nEnqueue audit log write]
  EVTBUS -->|subscribe| H3[Email Handler\nEnqueue welcome email]

  H1 --> QUEUE_ANA[analytics-compute queue]
  H2 --> QUEUE_AUD[audit-log queue]
  H3 --> QUEUE_EML[email queue]

  QUEUE_ANA -->|Worker| ANA_W[Analytics Worker\nRecomputes MonthlySnapshot]
  QUEUE_AUD -->|Worker| AUD_W[Audit Worker\nWrites AuditLog]
  QUEUE_EML -->|Worker| EML_W[Email Worker\nSends via SMTP]

  ANA_W -->|upsert| PG[(PostgreSQL)]
  AUD_W -->|insert| PG
  EML_W -->|send| SMTP[SMTP Server]
```

> **Production note:** The in-process EventEmitter is a drop-in shim for Kafka/RabbitMQ. When splitting into microservices, replace `eventBus.publish()` with a Kafka producer and `eventBus.subscribe()` with a consumer group. The use-case and worker code doesn't change.

---

## 9. CAP Theorem Tradeoffs

This is the most important architectural decision section.

### System Profile: **CP with tunable A**

```
        Consistency
              ▲
              │
      FinTrack│ (Primary)
              │
              │
Availability ◄────────────► Partition Tolerance
```

### Decisions & Justifications

| Component | Choice | Rationale |
|-----------|--------|-----------|
| **PostgreSQL (primary)** | **CP** — Consistency + Partition Tolerance | Financial data MUST be consistent. A stale balance is a bug. We trade availability: if the primary is unreachable, writes fail rather than accepting potentially duplicate/conflicting transactions. |
| **PostgreSQL (read replicas)** | **AP** for reads | Analytics/reporting queries route to replicas. Slightly stale analytics (seconds) are acceptable. This gives availability for reads while keeping write consistency. |
| **Redis (cache)** | **AP** — Availability + Partition Tolerance | Cache is a performance layer, not the source of truth. If Redis is unavailable, we fall through to PostgreSQL. 5-minute TTL means stale data is bounded. |
| **Redis (token blacklist)** | **CP** — treated as CP | If Redis is down during logout, we fail-open (don't blacklist). Short access token TTL (15m) is the safety net. This is a deliberate, documented tradeoff. |
| **BullMQ (job queue)** | **AP** — eventual consistency | Email delivery and analytics snapshots are eventually consistent. A failed analytics job retries; a delayed email is acceptable. |
| **Event Bus** | **AP** | Events are fire-and-forget. If an event handler fails, BullMQ retries (3 attempts, exponential backoff). |

### What This Means Operationally

```
Scenario: PostgreSQL primary goes down
→ Write requests FAIL with 503 (we chose C over A)
→ Read requests SERVE from replica/cache (AP for reads)
→ Recovery: failover to replica, resume writes
→ Risk: ~30-60s downtime during failover

Scenario: Redis goes down
→ Rate limiting falls back to in-memory (per-instance, not distributed)
→ Analytics served from PostgreSQL directly (slower but correct)
→ Token blacklist unavailable → recently logged-out tokens valid until expiry (max 15m)
→ Recovery: Redis reconnects, cache warms up organically

Scenario: BullMQ Redis down
→ New jobs fail to enqueue
→ In-flight jobs complete (workers have their own connection)
→ Emails queue up; analytics snapshots slightly stale
→ No data loss: events can be replayed from audit log
```

---

## 10. Tech Stack Justification

| Technology | Why Chosen | Alternative Considered |
|-----------|------------|----------------------|
| **TypeScript** | Type safety catches entire classes of bugs at compile time. Essential for a financial system. | JavaScript — rejected (no type safety) |
| **Express.js** | Minimal, battle-tested, huge ecosystem. Easy to extend with middleware. | Fastify (slightly faster), NestJS (too opinionated for clean arch) |
| **PostgreSQL** | ACID compliance is non-negotiable for financial data. JSON support for metadata. Excellent indexing. | MySQL (weaker JSON), MongoDB (no ACID by default) |
| **Prisma ORM** | Type-safe queries, excellent migrations, schema-as-code. The TS DX is unmatched. | TypeORM (verbose, decorator hell), Drizzle (newer, less mature) |
| **Redis** | Sub-millisecond latency for cache + rate limiting. First-class BullMQ support. | Memcached (no persistence), DynamoDB (higher latency, cost) |
| **BullMQ** | Reliable job queues with retries, priorities, delays. Redis-backed — same infra. | Celery (Python), SQS (AWS lock-in), Agenda (MongoDB, slower) |
| **Argon2id** | OWASP-recommended password hashing. Winner of Password Hashing Competition. Memory-hard = GPU-resistant. | bcrypt (older, not memory-hard), scrypt (less ergonomic) |
| **jose** | Standards-compliant JOSE/JWT library. Actively maintained, TypeScript-first. | jsonwebtoken (older, callback API), passport-jwt (too much magic) |
| **Zod** | Schema-first validation with inferred TypeScript types. One source of truth. | Joi (no TS inference), class-validator (decorator hell) |
| **Pino** | Fastest Node.js structured logger. JSON output. Near-zero overhead. | Winston (slower), Bunyan (unmaintained) |
| **gRPC** | Efficient binary protocol for internal services. Strong contracts via protobufs. | REST (more overhead), GraphQL (overkill for internal) |

---

## 11. RBAC Model

```mermaid
graph TD
  subgraph Roles
    VIEWER[VIEWER\nread-only]
    ANALYST[ANALYST\nread + analytics]
    ADMIN[ADMIN\nfull access]
  end

  subgraph Permissions
    P1[GET /transactions]
    P2[POST /transactions]
    P3[PATCH /transactions/:id]
    P4[DELETE /transactions/:id]
    P5[GET /analytics/*]
    P6[Admin operations]
  end

  VIEWER  --> P1
  ANALYST --> P1 & P2 & P3 & P4 & P5
  ADMIN   --> P1 & P2 & P3 & P4 & P5 & P6

  style ADMIN   fill:#DC2626,color:#fff
  style ANALYST fill:#D97706,color:#fff
  style VIEWER  fill:#2563EB,color:#fff
```

---

## 12. API Documentation

### Base URL
```
https://api.fintrack.io/api/v1
```

### Authentication
All protected endpoints require:
```
Authorization: Bearer <access_token>
```

---

### Auth Endpoints

#### `POST /auth/signup`
Register a new user account.

**Request:**
```json
{
  "email":     "alice@example.com",
  "password":  "StrongPass1!",
  "firstName": "Alice",
  "lastName":  "Smith"
}
```

**Response `201`:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id":        "uuid",
      "email":     "alice@example.com",
      "firstName": "Alice",
      "lastName":  "Smith",
      "role":      "VIEWER"
    },
    "message": "Account created. Please check your email to verify your account."
  }
}
```

---

#### `POST /auth/login`
**Request:**
```json
{ "email": "alice@example.com", "password": "StrongPass1!" }
```
**Response `200`:**
```json
{
  "success": true,
  "data": {
    "tokens": {
      "accessToken":  "eyJ...",
      "refreshToken": "eyJ...",
      "expiresIn":    900
    },
    "user": { "id": "uuid", "email": "alice@example.com", "role": "VIEWER" }
  }
}
```

---

#### `POST /auth/refresh`
**Request:** `{ "refreshToken": "eyJ..." }`
**Response `200`:** New token pair (old refresh token is invalidated — rotation)

#### `POST /auth/logout` 
**Request:** `{ "refreshToken": "eyJ..." }`

#### `GET /auth/verify-email?token=xxx`

#### `POST /auth/forgot-password`
**Request:** `{ "email": "alice@example.com" }`
Always returns `200` to prevent email enumeration.

#### `POST /auth/reset-password`
**Request:** `{ "token": "uuid", "password": "NewPass1!" }`

#### `GET /auth/me` 
Returns the authenticated user's profile.

---

### Transaction Endpoints ( Auth Required)

#### `POST /transactions`
```json
{
  "amount":      1500.00,
  "type":        "INCOME",
  "category":    "SALARY",
  "description": "Monthly salary",
  "tags":        ["work", "monthly"],
  "occurredAt":  "2024-03-01T00:00:00.000Z"
}
```

**Categories:** `SALARY | FREELANCE | INVESTMENT | GIFT | REFUND | FOOD | TRANSPORT | HOUSING | HEALTH | EDUCATION | ENTERTAINMENT | SHOPPING | UTILITIES | INSURANCE | TAXES | OTHER`

#### `GET /transactions`
**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `type` | `INCOME\|EXPENSE` | Filter by type |
| `category` | enum | Filter by category |
| `dateFrom` | ISO date | Start date (inclusive) |
| `dateTo` | ISO date | End date (inclusive) |
| `amountMin` | number | Minimum amount |
| `amountMax` | number | Maximum amount |
| `search` | string | Search in description |
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (1-100, default: 20) |
| `sortBy` | `occurredAt\|amount\|createdAt\|category` | Sort field |
| `sortDir` | `asc\|desc` | Sort direction |

**Response `200`:**
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1, "limit": 20, "total": 142,
    "totalPages": 8, "hasNext": true, "hasPrev": false
  }
}
```

#### `GET /transactions/:id` · `PATCH /transactions/:id` · `DELETE /transactions/:id`

---

### Analytics Endpoints ( Auth Required, ANALYST+ role)

#### `GET /analytics/overview`
**Query:** `?dateFrom=2024-01-01&dateTo=2024-12-31` (optional)
```json
{
  "success": true,
  "data": {
    "totalIncome":      45000.00,
    "totalExpense":     32500.00,
    "netBalance":       12500.00,
    "transactionCount": 87
  }
}
```

#### `GET /analytics/trends?year=2024`
Returns 12-month breakdown (all months, zeros for empty).

#### `GET /analytics/categories?type=EXPENSE&dateFrom=2024-01-01`
```json
{
  "success": true,
  "data": [
    { "category": "FOOD",      "total": 8200, "count": 45, "percent": 25.23 },
    { "category": "TRANSPORT", "total": 3100, "count": 18, "percent": 9.54  }
  ]
}
```

#### `GET /analytics/recent?limit=10`
Returns the 10 most recent transactions.

---

### Error Format
All errors follow this consistent structure:
```json
{
  "error":     "Human-readable message",
  "errorCode": "MACHINE_READABLE_CODE",
  "details":   { "field": ["validation error"] }
}
```

**Error Codes:** `UNAUTHORIZED · FORBIDDEN · INVALID_CREDENTIALS · TOKEN_EXPIRED · TOKEN_INVALID · EMAIL_NOT_VERIFIED · EMAIL_ALREADY_EXISTS · NOT_FOUND · CONFLICT · VALIDATION_ERROR · TOO_MANY_REQUESTS · INTERNAL_ERROR`

---

## 13. Setup Instructions

### Prerequisites
- Node.js 20+
- Docker & Docker Compose
- PostgreSQL 16+ (or use Docker)
- Redis 7+ (or use Docker)

### Quick Start (Docker — recommended)

```bash
# 1. Clone and configure
git clone https://github.com/your-org/fintrack.git
cd fintrack
cp .env.example .env
# Edit .env with your secrets

# 2. Start all infrastructure
docker compose --profile dev up -d

# 3. Run database migrations
docker compose exec api npx prisma migrate deploy

# 4. Done! API is live at http://localhost:3000
curl http://localhost:3000/health
```

### Local Development

```bash
# Install dependencies
npm install

# Generate Prisma client
npm run prisma:generate

# Start dev infrastructure (postgres + redis + mailhog)
docker compose up postgres redis mailhog -d

# Run migrations
npm run prisma:migrate

# Start dev server with hot-reload
npm run dev

# Open Prisma Studio
npm run prisma:studio
```

### Running Tests

```bash
# Unit tests only (no DB/Redis needed)
npm run test:unit

# Integration tests (requires docker services running)
npm run test:integration

# All tests with coverage report
npm run test:coverage
```

### Environment Variables

See [`.env.example`](.env.example) for the full list. Key variables:

```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/fintrack_db
REDIS_HOST=localhost
JWT_ACCESS_SECRET=<32+ random chars>
JWT_REFRESH_SECRET=<32+ random chars>
SMTP_HOST=localhost  # Use MailHog for local dev
```

---

## 14. Microservices Evolution Plan

The codebase is **microservices-ready** today. Each "service" in `src/services/` maps to a future independent deployable.

```mermaid
graph LR
  subgraph TODAY[Monolith Today]
    direction TB
    M[Single Node.js Process\nsrc/services/auth\nsrc/services/transaction\nsrc/services/analytics]
  end

  subgraph PHASE1[Phase 1 — Extract Auth]
    AUTH_SVC[Auth Service\nPort :3001\nOwns: users, tokens]
    MAIN_SVC[Main Service\nPort :3000\nTransaction + Analytics]
    AUTH_SVC <-->|gRPC :50051| MAIN_SVC
  end

  subgraph PHASE2[Phase 2 — Full Split]
    A[Auth Service :3001]
    T[Transaction Service :3002]
    AN[Analytics Service :3003]
    GW[API Gateway\nnginx / Kong]
    KB[Kafka Broker]
    GW --> A & T & AN
    T -->|events| KB
    KB -->|consume| AN
  end

  TODAY -->|"Step 1\n(config change only)"| PHASE1
  PHASE1 -->|"Step 2\n(add gateway + kafka)"| PHASE2
```

### Migration Steps

**Step 1 — Extract Auth Service (minimal change)**
- Move `src/services/auth/` to a new repository
- Wire the existing gRPC server (`auth.grpc.server.ts`) as the entry point
- Replace `tokenService` calls in Transaction middleware with gRPC client calls
- Zero changes to business logic

**Step 2 — Replace EventBus with Kafka**
- `eventBus.publish()` → Kafka producer (same interface)
- `eventBus.subscribe()` → Kafka consumer group (same interface)
- Worker processes become standalone Kafka consumers

**Step 3 — Add API Gateway**
- Route `/auth/*` to Auth Service
- Route `/transactions/*` to Transaction Service
- Route `/analytics/*` to Analytics Service
- Gateway handles JWT verification (avoids per-service auth overhead)

---

## 15. Scaling Strategy

### Horizontal Scaling

```mermaid
graph TB
  LB[Load Balancer\nNginx / AWS ALB]
  LB --> API1[API Instance 1]
  LB --> API2[API Instance 2]
  LB --> API3[API Instance 3]

  API1 & API2 & API3 --> PG_PRIMARY[PostgreSQL Primary\nWrites]
  API1 & API2 & API3 --> PG_REPLICA1[Read Replica 1\nReads]
  API1 & API2 & API3 --> PG_REPLICA2[Read Replica 2\nReads]

  API1 & API2 & API3 --> REDIS_CLUSTER[Redis Cluster\nCache + Rate Limit]

  REDIS_CLUSTER --> R1[Redis Primary]
  REDIS_CLUSTER --> R2[Redis Replica]

  API1 & API2 & API3 --> WORKER_POOL[BullMQ Worker Pool]
```

### Scaling Checklist

| Concern | Solution | Notes |
|---------|----------|-------|
| **Stateless API** |  No in-memory state | Sessions in Redis, not process memory |
| **Horizontal API scaling** | Add instances behind LB | JWT verification is local — no session server needed |
| **Database read load** | Add PostgreSQL read replicas | Route analytics queries to replicas |
| **Database write load** | Connection pooling (PgBouncer) | Prevent connection exhaustion |
| **Cache load** | Redis Cluster or Redis Sentinel | Automatic failover |
| **Job processing** | Scale BullMQ workers independently | CPU-bound workers separate from API |
| **Analytics bottleneck** | Pre-aggregate with MonthlySnapshot | Background worker keeps snapshots fresh |
| **Rate limiting** | Redis-backed (distributed) | Consistent across all API instances |
| **Cold traffic spikes** | Kubernetes HPA + readiness probes | Auto-scale API tier on CPU/RPS metrics |

### Database Connection Pooling

For 10+ API instances, use **PgBouncer** in transaction mode:

```
App instances (10) → PgBouncer (pooler) → PostgreSQL (1 primary)
                     Max pool: 50 DB conns
                     Each app: 10 conns → 100 total → pooled to 50
```

### Performance Benchmarks (targets)

| Endpoint | p50 | p99 | Notes |
|----------|-----|-----|-------|
| `GET /transactions` (cached) | <5ms | <20ms | Redis cache hit |
| `GET /transactions` (uncached) | <30ms | <100ms | DB query + index |
| `GET /analytics/overview` (cached) | <3ms | <10ms | Redis cache hit |
| `GET /analytics/overview` (uncached) | <50ms | <200ms | groupBy aggregation |
| `POST /transactions` | <50ms | <150ms | Write + cache invalidation |
| `POST /auth/login` | <100ms | <300ms | Argon2id verify (intentionally slow) |

> **Argon2id is intentionally slow** for login (64MiB memory, 3 iterations). This is the correct security-performance tradeoff — it makes brute force attacks computationally expensive. Don't optimize it away.

---

## Security Hardening Checklist

- [x] Argon2id password hashing (OWASP recommended)
- [x] JWT short-lived access tokens (15m)
- [x] Refresh token rotation (reuse detection → mass revocation)
- [x] Token blacklist on logout (Redis)
- [x] Helmet.js security headers
- [x] CORS with explicit origin whitelist
- [x] Body size limit (10kb) — prevents payload attacks
- [x] Redis-backed distributed rate limiting
- [x] Strict input validation (Zod) on all endpoints
- [x] SQL injection prevention (Prisma parameterized queries)
- [x] Soft deletes (audit trail preservation)
- [x] Sensitive field redaction in logs (passwords, tokens)
- [x] Non-root Docker container user
- [x] Email enumeration prevention (same response for forgot-password)
- [x] Timing-attack safe login (always run hash verification)
- [x] HSTS headers for HTTPS enforcement

---

## License

MIT — see [LICENSE](LICENSE)
