// src/infrastructure/swagger/swagger.ts
//
// Swagger UI is served at  GET /api-docs
// Raw OpenAPI JSON spec at GET /api-docs.json  (import into Postman / Insomnia)
//
// Helmet is intentionally disabled on /api-docs/* in app.ts so that
// swagger-ui-express can load its bundled assets without CSP violations.

import swaggerUi from 'swagger-ui-express';
import type { Application } from 'express';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { version } = require('../../../package.json') as { version: string };

// ─── OpenAPI Specification (hand-authored — no jsdoc scanning needed) ────────
const spec = {
  openapi: '3.0.3',
  info: {
    title: 'FinTrack API',
    version,
    description: `
## Finance Tracking Platform

Production-grade backend — **Clean Architecture · TypeScript · PostgreSQL · Redis**

---

### 🚀 Quick Start

1. **Register** \`POST /api/v1/auth/signup\`
2. **Verify email** — in dev mode, visit [MailHog](http://localhost:8025) and click the link
3. **Login** \`POST /api/v1/auth/login\` — copy the \`accessToken\` from the response
4. **Authorize** — click the 🔒 **Authorize** button above and paste: \`Bearer <accessToken>\`
5. You're in!

---

### 🔐 Authentication

All protected endpoints require:
\`\`\`
Authorization: Bearer <access_token>
\`\`\`

| Token | Lifetime | How to get |
|-------|----------|-----------|
| Access token  | 15 minutes | \`POST /api/v1/auth/login\` |
| Refresh token | 7 days     | same login response |

Use \`POST /api/v1/auth/refresh\` to get a new pair without logging in again.
**Refresh tokens rotate on every use** — the old token is immediately invalidated.

---

### 👤 RBAC Roles

| Role | Can do |
|------|--------|
| \`VIEWER\` | Read own transactions |
| \`ANALYST\` | Transactions + all analytics endpoints |
| \`ADMIN\` | Everything |

---

### ⚡ Rate Limits

| Scope | Limit |
|-------|-------|
| General API | 100 req / min per IP |
| Auth endpoints | 10 req / min per IP |

---

### ❌ Error Format

Every error returns the same shape:
\`\`\`json
{
  "error":     "Human-readable message",
  "errorCode": "MACHINE_CODE",
  "details":   { "field": ["specific issue"] }
}
\`\`\`
    `,
    contact: { name: 'FinTrack Support', email: 'support@fintrack.io' },
    license: { name: 'MIT' },
  },
  servers: [
    { url: 'http://localhost:3000', description: '🖥  Local development' },
    { url: 'https://api.fintrack.io', description: '🌐 Production' },
  ],
  tags: [
    { name: 'Health',       description: 'Service health probe' },
    { name: 'Auth',         description: 'Registration · Login · Token refresh · Password reset' },
    { name: 'Transactions', description: 'Create, read, update, delete income & expense records' },
    { name: 'Analytics',    description: '📊 Financial analytics — requires **ANALYST** or **ADMIN** role' },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Paste your access token here (without the "Bearer " prefix — the UI adds it automatically)',
      },
    },
    schemas: {
      // ─── Auth ──────────────────────────────────────────────────────────────
      SignupRequest: {
        type: 'object',
        required: ['email', 'password', 'firstName', 'lastName'],
        properties: {
          email:     { type: 'string', format: 'email',   example: 'alice@example.com' },
          password:  { type: 'string', minLength: 8,      example: 'StrongPass1!', description: 'Min 8 chars, must include uppercase, lowercase, and digit' },
          firstName: { type: 'string', minLength: 1, maxLength: 50, example: 'Alice' },
          lastName:  { type: 'string', minLength: 1, maxLength: 50, example: 'Smith' },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email:    { type: 'string', format: 'email', example: 'alice@example.com' },
          password: { type: 'string', example: 'StrongPass1!' },
        },
      },
      RefreshRequest: {
        type: 'object',
        required: ['refreshToken'],
        properties: { refreshToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiJ9...' } },
      },
      ForgotPasswordRequest: {
        type: 'object',
        required: ['email'],
        properties: { email: { type: 'string', format: 'email', example: 'alice@example.com' } },
      },
      ResetPasswordRequest: {
        type: 'object',
        required: ['token', 'password'],
        properties: {
          token:    { type: 'string', format: 'uuid', description: 'Token from the reset email link' },
          password: { type: 'string', minLength: 8, example: 'NewStrongPass1!' },
        },
      },
      AuthTokens: {
        type: 'object',
        properties: {
          accessToken:  { type: 'string', description: 'Short-lived JWT (15 min)' },
          refreshToken: { type: 'string', description: 'Long-lived JWT (7 days) — store securely' },
          expiresIn:    { type: 'integer', example: 900, description: 'Access token lifetime in seconds' },
        },
      },
      User: {
        type: 'object',
        properties: {
          id:              { type: 'string', format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' },
          email:           { type: 'string', format: 'email', example: 'alice@example.com' },
          firstName:       { type: 'string', example: 'Alice' },
          lastName:        { type: 'string', example: 'Smith' },
          role:            { type: 'string', enum: ['VIEWER', 'ANALYST', 'ADMIN'], example: 'VIEWER' },
          isEmailVerified: { type: 'boolean', example: true },
          createdAt:       { type: 'string', format: 'date-time' },
        },
      },
      // ─── Transactions ──────────────────────────────────────────────────────
      TransactionType: { type: 'string', enum: ['INCOME', 'EXPENSE'] },
      TransactionCategory: {
        type: 'string',
        enum: ['SALARY','FREELANCE','INVESTMENT','GIFT','REFUND','FOOD','TRANSPORT','HOUSING','HEALTH','EDUCATION','ENTERTAINMENT','SHOPPING','UTILITIES','INSURANCE','TAXES','OTHER'],
      },
      Transaction: {
        type: 'object',
        properties: {
          id:          { type: 'string', format: 'uuid' },
          userId:      { type: 'string', format: 'uuid' },
          amount:      { type: 'string', example: '1500.00', description: 'Decimal string — use parseFloat() on the client' },
          type:        { '$ref': '#/components/schemas/TransactionType' },
          category:    { '$ref': '#/components/schemas/TransactionCategory' },
          description: { type: 'string', nullable: true, example: 'Monthly salary' },
          tags:        { type: 'array', items: { type: 'string' }, example: ['work', 'recurring'] },
          occurredAt:  { type: 'string', format: 'date-time', example: '2024-03-01T00:00:00.000Z' },
          createdAt:   { type: 'string', format: 'date-time' },
          updatedAt:   { type: 'string', format: 'date-time' },
        },
      },
      CreateTransactionRequest: {
        type: 'object',
        required: ['amount', 'type', 'category', 'occurredAt'],
        properties: {
          amount:      { type: 'number', exclusiveMinimum: 0, multipleOf: 0.01, example: 1500.00 },
          type:        { '$ref': '#/components/schemas/TransactionType' },
          category:    { '$ref': '#/components/schemas/TransactionCategory' },
          description: { type: 'string', maxLength: 500, example: 'Monthly salary' },
          tags:        { type: 'array', items: { type: 'string', maxLength: 30 }, maxItems: 10, example: ['work'] },
          occurredAt:  { type: 'string', format: 'date-time', example: '2024-03-01T00:00:00.000Z' },
        },
      },
      UpdateTransactionRequest: {
        type: 'object',
        description: 'At least one field must be provided',
        properties: {
          amount:      { type: 'number', exclusiveMinimum: 0, multipleOf: 0.01 },
          type:        { '$ref': '#/components/schemas/TransactionType' },
          category:    { '$ref': '#/components/schemas/TransactionCategory' },
          description: { type: 'string', maxLength: 500 },
          tags:        { type: 'array', items: { type: 'string', maxLength: 30 }, maxItems: 10 },
          occurredAt:  { type: 'string', format: 'date-time' },
        },
        minProperties: 1,
      },
      Pagination: {
        type: 'object',
        properties: {
          page:       { type: 'integer', example: 1 },
          limit:      { type: 'integer', example: 20 },
          total:      { type: 'integer', example: 142 },
          totalPages: { type: 'integer', example: 8 },
          hasNext:    { type: 'boolean', example: true },
          hasPrev:    { type: 'boolean', example: false },
        },
      },
      // ─── Analytics ─────────────────────────────────────────────────────────
      OverviewStats: {
        type: 'object',
        properties: {
          totalIncome:      { type: 'number', example: 45000.00 },
          totalExpense:     { type: 'number', example: 32500.00 },
          netBalance:       { type: 'number', example: 12500.00 },
          transactionCount: { type: 'integer', example: 87 },
        },
      },
      MonthlyTrend: {
        type: 'object',
        properties: {
          year:         { type: 'integer', example: 2024 },
          month:        { type: 'integer', example: 3, description: '1 = January, 12 = December' },
          totalIncome:  { type: 'number', example: 5500.00 },
          totalExpense: { type: 'number', example: 3200.00 },
          netBalance:   { type: 'number', example: 2300.00 },
          count:        { type: 'integer', example: 12 },
        },
      },
      CategoryBreakdown: {
        type: 'object',
        properties: {
          category: { type: 'string', example: 'FOOD' },
          total:    { type: 'number', example: 1200.50 },
          count:    { type: 'integer', example: 28 },
          percent:  { type: 'number', example: 25.50, description: 'Share of total (0–100)' },
        },
      },
      // ─── Common ────────────────────────────────────────────────────────────
      SuccessResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'Operation completed successfully' },
        },
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          error:     { type: 'string', example: 'Human-readable message' },
          errorCode: { type: 'string', example: 'VALIDATION_ERROR' },
          details:   { type: 'object', nullable: true, example: { email: ['Invalid email format'] } },
        },
      },
    },
    responses: {
      Unauthorized:    { description: '401 — Missing or invalid Bearer token',     content: { 'application/json': { schema: { '$ref': '#/components/schemas/ErrorResponse' } } } },
      Forbidden:       { description: '403 — Insufficient role permissions',       content: { 'application/json': { schema: { '$ref': '#/components/schemas/ErrorResponse' } } } },
      NotFound:        { description: '404 — Resource not found',                  content: { 'application/json': { schema: { '$ref': '#/components/schemas/ErrorResponse' } } } },
      ValidationError: { description: '422 — Request body failed validation',      content: { 'application/json': { schema: { '$ref': '#/components/schemas/ErrorResponse' } } } },
      TooManyRequests: { description: '429 — Rate limit exceeded, retry later',    content: { 'application/json': { schema: { '$ref': '#/components/schemas/ErrorResponse' } } } },
    },
  },
  paths: {
    // ── Health ─────────────────────────────────────────────────────────────
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check',
        description: 'Returns service status. Used by Docker HEALTHCHECK, Kubernetes readiness probes, and load balancers.',
        operationId: 'getHealth',
        responses: {
          200: {
            description: 'Service is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status:    { type: 'string', example: 'ok' },
                    service:   { type: 'string', example: 'FinTrack' },
                    version:   { type: 'string', example: '1.0.0' },
                    uptime:    { type: 'integer', example: 3600, description: 'Seconds since process start' },
                    timestamp: { type: 'string', format: 'date-time' },
                    docs:      { type: 'string', example: 'http://localhost:3000/api-docs' },
                  },
                },
                example: { status: 'ok', service: 'FinTrack', version: '1.0.0', uptime: 3600, timestamp: '2024-03-01T12:00:00.000Z', docs: 'http://localhost:3000/api-docs' },
              },
            },
          },
        },
      },
    },
    // ── Auth ───────────────────────────────────────────────────────────────
    '/api/v1/auth/signup': {
      post: {
        tags: ['Auth'], summary: 'Register a new account', operationId: 'signup',
        description: 'Creates a new user account and queues a verification email. **The account cannot log in until the email is verified.**\n\nIn development, check MailHog at `http://localhost:8025` for the verification link.',
        requestBody: { required: true, content: { 'application/json': { schema: { '$ref': '#/components/schemas/SignupRequest' } } } },
        responses: {
          201: { description: '✅ Registered — check email to verify', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean', example: true }, data: { type: 'object', properties: { user: { '$ref': '#/components/schemas/User' }, message: { type: 'string', example: 'Account created. Please check your email.' } } } } } } } },
          409: { description: '⚠️ Email already registered', content: { 'application/json': { schema: { '$ref': '#/components/schemas/ErrorResponse' } } } },
          422: { '$ref': '#/components/responses/ValidationError' },
          429: { '$ref': '#/components/responses/TooManyRequests' },
        },
      },
    },
    '/api/v1/auth/login': {
      post: {
        tags: ['Auth'], summary: 'Login', operationId: 'login',
        description: 'Authenticate with email + password. Returns a short-lived **access token** (15 min) and a long-lived **refresh token** (7 days).\n\n> ⚠️ Email must be verified before login is allowed.',
        requestBody: { required: true, content: { 'application/json': { schema: { '$ref': '#/components/schemas/LoginRequest' } } } },
        responses: {
          200: {
            description: '✅ Authenticated',
            content: {
              'application/json': {
                schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object', properties: { tokens: { '$ref': '#/components/schemas/AuthTokens' }, user: { '$ref': '#/components/schemas/User' } } } } },
                example: { success: true, data: { tokens: { accessToken: 'eyJhbGci...', refreshToken: 'eyJhbGci...', expiresIn: 900 }, user: { id: '550e8400...', email: 'alice@example.com', role: 'VIEWER' } } },
              },
            },
          },
          401: { description: '❌ Invalid credentials or email not verified', content: { 'application/json': { schema: { '$ref': '#/components/schemas/ErrorResponse' }, example: { error: 'Invalid email or password', errorCode: 'INVALID_CREDENTIALS' } } } },
          429: { '$ref': '#/components/responses/TooManyRequests' },
        },
      },
    },
    '/api/v1/auth/refresh': {
      post: {
        tags: ['Auth'], summary: 'Refresh tokens', operationId: 'refreshTokens',
        description: 'Exchange a valid refresh token for a new access + refresh token pair.\n\n**Token rotation is enforced:** the submitted refresh token is immediately revoked. If a previously used token is detected, **all sessions for that user are terminated** (replay attack mitigation).',
        requestBody: { required: true, content: { 'application/json': { schema: { '$ref': '#/components/schemas/RefreshRequest' } } } },
        responses: {
          200: { description: '✅ New token pair issued', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object', properties: { tokens: { '$ref': '#/components/schemas/AuthTokens' } } } } } } } },
          401: { description: '❌ Refresh token invalid, expired, or already used', content: { 'application/json': { schema: { '$ref': '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/v1/auth/logout': {
      post: {
        tags: ['Auth'], summary: 'Logout', operationId: 'logout',
        security: [{ BearerAuth: [] }],
        description: 'Revokes the refresh token in the database and blacklists the current access token JTI in Redis. The access token cannot be reused even before it expires.',
        requestBody: { required: true, content: { 'application/json': { schema: { '$ref': '#/components/schemas/RefreshRequest' } } } },
        responses: {
          200: { description: '✅ Logged out', content: { 'application/json': { schema: { '$ref': '#/components/schemas/SuccessResponse' }, example: { success: true, message: 'Logged out successfully' } } } },
          401: { '$ref': '#/components/responses/Unauthorized' },
        },
      },
    },
    '/api/v1/auth/verify-email': {
      get: {
        tags: ['Auth'], summary: 'Verify email address', operationId: 'verifyEmail',
        description: 'Confirms the email using the token sent to the user\'s inbox. Token expires **24 hours** after registration. In dev mode, find the link in MailHog.',
        parameters: [
          { in: 'query', name: 'token', required: true, schema: { type: 'string' }, description: 'Verification token from the email link', example: '550e8400-e29b-41d4-a716-446655440000' },
        ],
        responses: {
          200: { description: '✅ Email verified — user can now login', content: { 'application/json': { schema: { '$ref': '#/components/schemas/SuccessResponse' } } } },
          400: { description: '❌ Token expired', content: { 'application/json': { schema: { '$ref': '#/components/schemas/ErrorResponse' } } } },
          404: { description: '❌ Token not found', content: { 'application/json': { schema: { '$ref': '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/v1/auth/forgot-password': {
      post: {
        tags: ['Auth'], summary: 'Request password reset', operationId: 'forgotPassword',
        description: 'Sends a password reset link to the provided email address. **Always returns 200** — even if the email doesn\'t exist — to prevent email enumeration attacks.',
        requestBody: { required: true, content: { 'application/json': { schema: { '$ref': '#/components/schemas/ForgotPasswordRequest' } } } },
        responses: {
          200: { description: '✅ Reset link sent (if account exists)', content: { 'application/json': { schema: { '$ref': '#/components/schemas/SuccessResponse' }, example: { success: true, message: 'If that email exists, a reset link has been sent.' } } } },
        },
      },
    },
    '/api/v1/auth/reset-password': {
      post: {
        tags: ['Auth'], summary: 'Reset password', operationId: 'resetPassword',
        description: 'Sets a new password using the reset token from the email. On success, **all active sessions are revoked** — the user must login again on all devices.',
        requestBody: { required: true, content: { 'application/json': { schema: { '$ref': '#/components/schemas/ResetPasswordRequest' } } } },
        responses: {
          200: { description: '✅ Password updated — all sessions revoked', content: { 'application/json': { schema: { '$ref': '#/components/schemas/SuccessResponse' } } } },
          401: { description: '❌ Token invalid or expired', content: { 'application/json': { schema: { '$ref': '#/components/schemas/ErrorResponse' } } } },
          422: { '$ref': '#/components/responses/ValidationError' },
        },
      },
    },
    '/api/v1/auth/me': {
      get: {
        tags: ['Auth'], summary: 'Get current user profile', operationId: 'getMe',
        security: [{ BearerAuth: [] }],
        description: 'Returns the authenticated user\'s profile from the access token claim. No DB hit — O(1).',
        responses: {
          200: { description: '✅ Current user', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object', properties: { user: { '$ref': '#/components/schemas/User' } } } } } } } },
          401: { '$ref': '#/components/responses/Unauthorized' },
        },
      },
    },
    // ── Transactions ───────────────────────────────────────────────────────
    '/api/v1/transactions': {
      post: {
        tags: ['Transactions'], summary: 'Create a transaction', operationId: 'createTransaction',
        security: [{ BearerAuth: [] }],
        description: 'Records a new income or expense transaction. Async side-effects: analytics cache is invalidated and a monthly snapshot recompute job is queued.',
        requestBody: { required: true, content: { 'application/json': { schema: { '$ref': '#/components/schemas/CreateTransactionRequest' }, example: { amount: 5500, type: 'INCOME', category: 'SALARY', description: 'March salary', occurredAt: '2024-03-01T00:00:00.000Z' } } } },
        responses: {
          201: { description: '✅ Transaction created', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { '$ref': '#/components/schemas/Transaction' } } } } } },
          401: { '$ref': '#/components/responses/Unauthorized' },
          422: { '$ref': '#/components/responses/ValidationError' },
        },
      },
      get: {
        tags: ['Transactions'], summary: 'List transactions', operationId: 'listTransactions',
        security: [{ BearerAuth: [] }],
        description: 'Returns a paginated, filtered list of the authenticated user\'s transactions. All filters are optional and combinable.',
        parameters: [
          { in: 'query', name: 'type',      schema: { '$ref': '#/components/schemas/TransactionType' },     description: 'Filter by transaction type' },
          { in: 'query', name: 'category',  schema: { '$ref': '#/components/schemas/TransactionCategory' }, description: 'Filter by category' },
          { in: 'query', name: 'dateFrom',  schema: { type: 'string', format: 'date-time' }, example: '2024-01-01T00:00:00.000Z', description: 'Start date (inclusive)' },
          { in: 'query', name: 'dateTo',    schema: { type: 'string', format: 'date-time' }, example: '2024-12-31T23:59:59.999Z', description: 'End date (inclusive)' },
          { in: 'query', name: 'amountMin', schema: { type: 'number', minimum: 0 }, description: 'Minimum amount' },
          { in: 'query', name: 'amountMax', schema: { type: 'number', minimum: 0 }, description: 'Maximum amount' },
          { in: 'query', name: 'search',    schema: { type: 'string', maxLength: 100 }, description: 'Full-text search in description (case-insensitive)' },
          { in: 'query', name: 'page',      schema: { type: 'integer', minimum: 1, default: 1 }, description: 'Page number' },
          { in: 'query', name: 'limit',     schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 }, description: 'Items per page (max 100)' },
          { in: 'query', name: 'sortBy',    schema: { type: 'string', enum: ['occurredAt','amount','createdAt','category'], default: 'occurredAt' }, description: 'Sort field' },
          { in: 'query', name: 'sortDir',   schema: { type: 'string', enum: ['asc','desc'], default: 'desc' }, description: 'Sort direction' },
        ],
        responses: {
          200: { description: '✅ Paginated list', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'array', items: { '$ref': '#/components/schemas/Transaction' } }, pagination: { '$ref': '#/components/schemas/Pagination' } } } } } },
          401: { '$ref': '#/components/responses/Unauthorized' },
          422: { '$ref': '#/components/responses/ValidationError' },
        },
      },
    },
    '/api/v1/transactions/{id}': {
      get: {
        tags: ['Transactions'], summary: 'Get a transaction', operationId: 'getTransaction',
        security: [{ BearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' }, description: 'Transaction ID' }],
        responses: {
          200: { description: '✅ Transaction', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { '$ref': '#/components/schemas/Transaction' } } } } } },
          401: { '$ref': '#/components/responses/Unauthorized' },
          404: { '$ref': '#/components/responses/NotFound' },
        },
      },
      patch: {
        tags: ['Transactions'], summary: 'Update a transaction', operationId: 'updateTransaction',
        security: [{ BearerAuth: [] }],
        description: 'Partially updates a transaction. At least one field must be provided.',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { '$ref': '#/components/schemas/UpdateTransactionRequest' }, example: { amount: 6000, description: 'Salary increase' } } } },
        responses: {
          200: { description: '✅ Updated', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { '$ref': '#/components/schemas/Transaction' } } } } } },
          401: { '$ref': '#/components/responses/Unauthorized' },
          404: { '$ref': '#/components/responses/NotFound' },
          422: { '$ref': '#/components/responses/ValidationError' },
        },
      },
      delete: {
        tags: ['Transactions'], summary: 'Delete a transaction', operationId: 'deleteTransaction',
        security: [{ BearerAuth: [] }],
        description: '**Soft delete** — the record is preserved in the database with `isDeleted: true` for audit purposes. It will not appear in any API responses.',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          200: { description: '✅ Soft-deleted', content: { 'application/json': { schema: { '$ref': '#/components/schemas/SuccessResponse' }, example: { success: true, message: 'Transaction deleted successfully' } } } },
          401: { '$ref': '#/components/responses/Unauthorized' },
          404: { '$ref': '#/components/responses/NotFound' },
        },
      },
    },
    // ── Analytics ──────────────────────────────────────────────────────────
    '/api/v1/analytics/overview': {
      get: {
        tags: ['Analytics'], summary: 'Financial overview', operationId: 'getOverview',
        security: [{ BearerAuth: [] }],
        description: 'Returns total income, total expense, net balance, and transaction count.\n\n**Caching:** results are cached in Redis for 5 minutes. Cache is invalidated on any transaction write.\n\n> 🔒 Requires **ANALYST** or **ADMIN** role',
        parameters: [
          { in: 'query', name: 'dateFrom', schema: { type: 'string', format: 'date-time' }, description: 'Filter start (optional — omit for all-time)' },
          { in: 'query', name: 'dateTo',   schema: { type: 'string', format: 'date-time' }, description: 'Filter end (optional)' },
        ],
        responses: {
          200: { description: '✅ Overview stats', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { '$ref': '#/components/schemas/OverviewStats' } } }, example: { success: true, data: { totalIncome: 45000, totalExpense: 32500, netBalance: 12500, transactionCount: 87 } } } } },
          401: { '$ref': '#/components/responses/Unauthorized' },
          403: { '$ref': '#/components/responses/Forbidden' },
        },
      },
    },
    '/api/v1/analytics/trends': {
      get: {
        tags: ['Analytics'], summary: 'Monthly trends', operationId: 'getMonthlyTrends',
        security: [{ BearerAuth: [] }],
        description: 'Returns 12-month income/expense/balance breakdown for a given year. **All 12 months are always returned** — months with no transactions have zeros.\n\n> 🔒 Requires **ANALYST** or **ADMIN** role',
        parameters: [
          { in: 'query', name: 'year', schema: { type: 'integer', minimum: 2000, maximum: 2100 }, example: 2024, description: 'Year to analyse (defaults to current year)' },
        ],
        responses: {
          200: { description: '✅ 12-month trends array', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'array', minItems: 12, maxItems: 12, items: { '$ref': '#/components/schemas/MonthlyTrend' } } } } } } },
          401: { '$ref': '#/components/responses/Unauthorized' },
          403: { '$ref': '#/components/responses/Forbidden' },
        },
      },
    },
    '/api/v1/analytics/categories': {
      get: {
        tags: ['Analytics'], summary: 'Category breakdown', operationId: 'getCategoryBreakdown',
        security: [{ BearerAuth: [] }],
        description: 'Breakdown of spending (or income) by category, sorted by total descending, with percentage share of the total.\n\n> 🔒 Requires **ANALYST** or **ADMIN** role',
        parameters: [
          { in: 'query', name: 'type',     schema: { type: 'string', enum: ['INCOME','EXPENSE'], default: 'EXPENSE' }, description: 'Which transaction type to analyse' },
          { in: 'query', name: 'dateFrom', schema: { type: 'string', format: 'date-time' }, description: 'Filter start date' },
          { in: 'query', name: 'dateTo',   schema: { type: 'string', format: 'date-time' }, description: 'Filter end date' },
        ],
        responses: {
          200: { description: '✅ Category breakdown', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'array', items: { '$ref': '#/components/schemas/CategoryBreakdown' } } } }, example: { success: true, data: [{ category: 'FOOD', total: 1200, count: 28, percent: 25.5 }, { category: 'HOUSING', total: 1800, count: 1, percent: 38.3 }] } } } },
          401: { '$ref': '#/components/responses/Unauthorized' },
          403: { '$ref': '#/components/responses/Forbidden' },
        },
      },
    },
    '/api/v1/analytics/recent': {
      get: {
        tags: ['Analytics'], summary: 'Recent activity', operationId: 'getRecentActivity',
        security: [{ BearerAuth: [] }],
        description: 'Returns the N most recent transactions (not paginated — for dashboard widgets).\n\n> 🔒 Requires **ANALYST** or **ADMIN** role',
        parameters: [
          { in: 'query', name: 'limit', schema: { type: 'integer', minimum: 1, maximum: 50, default: 10 }, description: 'Number of records (max 50)' },
        ],
        responses: {
          200: { description: '✅ Recent transactions', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'array', items: { '$ref': '#/components/schemas/Transaction' } } } } } } },
          401: { '$ref': '#/components/responses/Unauthorized' },
          403: { '$ref': '#/components/responses/Forbidden' },
        },
      },
    },
  },
};

// ─── Swagger UI Setup ─────────────────────────────────────────────────────────
export function setupSwagger(app: Application): void {
  // Raw JSON spec — import this URL directly into Postman or Insomnia
  app.get('/api-docs.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(spec);
  });

  // Interactive Swagger UI — no Helmet on this path (set in app.ts)
  app.use('/api-docs', swaggerUi.serve);
  app.get('/api-docs', swaggerUi.setup(spec, {
    customSiteTitle: 'FinTrack API Docs',
    customfavIcon: 'https://www.svgrepo.com/show/374024/replit.svg',
    customCss: `
      body { margin: 0; }
      .swagger-ui .topbar { background: #0f0f1a; padding: 8px 20px; }
      .swagger-ui .topbar .download-url-wrapper { display: none; }
      .swagger-ui .info .title { color: #4F46E5; font-size: 2.2rem; font-weight: 800; }
      .swagger-ui .info .description { font-size: 0.95rem; line-height: 1.6; }
      .swagger-ui .scheme-container { background: #f8fafc; padding: 12px 20px; border-bottom: 1px solid #e2e8f0; }
      .swagger-ui .opblock-tag { font-size: 1.15rem; font-weight: 700; border-bottom: 2px solid #4F46E5; padding-bottom: 6px; margin-bottom: 10px; }
      .swagger-ui .opblock.opblock-post   { border-color: #4F46E5; background: rgba(79,70,229,0.04); }
      .swagger-ui .opblock.opblock-get    { border-color: #059669; background: rgba(5,150,105,0.04); }
      .swagger-ui .opblock.opblock-patch  { border-color: #D97706; background: rgba(217,119,6,0.04); }
      .swagger-ui .opblock.opblock-delete { border-color: #DC2626; background: rgba(220,38,38,0.04); }
      .swagger-ui .opblock-summary-method { min-width: 80px; text-align: center; border-radius: 4px; font-weight: 700; }
      .swagger-ui .btn.authorize { background: #4F46E5; border-color: #4F46E5; color: #fff; border-radius: 6px; font-weight: 600; }
      .swagger-ui .btn.authorize:hover { background: #4338CA; }
      .swagger-ui .btn.authorize svg { fill: #fff; }
      .swagger-ui .response-col_status { font-weight: 700; }
      .swagger-ui table thead tr td, .swagger-ui table thead tr th { font-weight: 700; background: #f1f5f9; }
    `,
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      docExpansion: 'list',
      defaultModelsExpandDepth: 2,
      defaultModelExpandDepth: 2,
      tryItOutEnabled: true,
      requestSnippetsEnabled: true,
      tagsSorter: 'alpha',
    },
  }));
}
