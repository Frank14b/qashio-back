# Qashio API

NestJS backend for the Qashio expense tracker. It covers wallets, income and expenses, categories, budgets with alerts, and in-app notifications. Postgres is the source of truth. Redis holds OTPs, refresh locks, rate limits and the domain-event queue.

**Design docs:** [Database schema & diagrams v2](./docs/database-v2.md) is the current schema, ERD, Redis keyspace and flow diagrams. [v1](./docs/database-and-auth.md) is the original design, kept for history.

---

## Tech stack

| Area | Choice |
|------|--------|
| Framework | NestJS 11, TypeScript, hexagonal modules (domain / application / infrastructure / presentation) |
| Database | PostgreSQL 15 + TypeORM migrations (`synchronize` off) |
| Redis | ioredis: OTPs, refresh-rotation locks, rate limiting, BullMQ |
| Domain events | **BullMQ** `domain-events` queue: one job per handler, 5 attempts, exponential backoff |
| Money | `numeric(19,4)` columns, decimal strings + `decimal.js` in code |
| Validation | class-validator DTOs; zod for environment variables |
| Observability | nestjs-pino (JSON logs, `X-Request-Id`), `@nestjs/terminus` health, optional Sentry |
| Security | JWT access + rotating refresh tokens, `@nestjs/throttler` (Redis storage), bcrypt |
| Docs | Swagger at `/docs` (not in production) |
| Quality | Jest, ESLint, Prettier, Husky + lint-staged |

---

## Project structure

```text
src/
  main.ts / instrument.ts      # bootstrap; instrument.ts validates env + starts Sentry first
  app.module.ts
  modules/
    auth/                      # register, OTP verify, login, refresh rotation, password reset/change
    users/  accounts/  currencies/  categories/
    transactions/              # CRUD, idempotent create, summary
    budgets/                   # limits per wallet + category + period, threshold alerts
    notifications/             # in-app feed + budget alert emails
    activity-logs/             # @LogActivity audit trail
    health/                    # /health, /health/live
  shared/
    config/                    # zod env schema
    database/                  # TypeORM config, data source, migrations
    events/                    # DomainEventPublisher (BullMQ), @OnDomainEvent, worker
    http/  logging/  money/  rate-limit/  redis/  email/  validation/
```

Each module follows `domain/` (entities, ports, events) → `application/` (use cases, listeners) → `infrastructure/` (TypeORM, Redis adapters) → `presentation/http/` (controllers, DTOs).

---

## Setup

### Prerequisites

- Node.js 22 (matches `Dockerfile.dev`)
- PostgreSQL + Redis (Docker Compose from the repo root, or local installs)

### Environment

```bash
cp .env.example .env
```

Every variable is validated at startup by `src/shared/config/env.ts` (zod). Invalid config stops the process and lists every problem.

| Variable | Default | Notes |
|----------|---------|-------|
| `DATABASE_URL` | — (required) | `postgres://…` |
| `REDIS_URL` or `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` | `localhost:6379` | Shared by OTPs, throttling and BullMQ |
| `JWT_ACCESS_SECRET` | — (required, ≥16; ≥32 in production) | |
| `JWT_ACCESS_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_DAYS` | `15m` / `30` | |
| `EMAIL_OTP_MODE` | `fixed` | `fixed` always issues `123456` (dev only; production requires `live`) |
| `EMAIL_OTP_TTL_SECONDS` | `600` | |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | `localhost:587` | |
| `CORS_ORIGIN` | localhost:3000/3001/4000 | Comma-separated |
| `RATE_LIMIT_PER_MINUTE` | `120` | Global per-IP limit |
| `TRUST_PROXY` | — | Set behind a load balancer so rate limits see the client IP |
| `LOG_LEVEL` | `info` | |
| `RUN_MIGRATIONS` | `true` | Docker entrypoint runs pending migrations |
| `SEED_CURRENCIES` | `true` | Idempotent currency upsert on boot |
| `HEALTH_MEMORY_HEAP_MB` / `HEALTH_MEMORY_RSS_MB` | `512` / `1024` | |
| `SENTRY_ENABLED` / `SENTRY_DSN` / `SENTRY_ENVIRONMENT` / `SENTRY_TRACES_SAMPLE_RATE` | off | DSN required when enabled |

### Local

```bash
npm install
npm run migration:run
npm run start:dev
```

API on [http://localhost:3000](http://localhost:3000), Swagger at [http://localhost:3000/docs](http://localhost:3000/docs).

### Docker (from the repo root)

```bash
docker compose up -d --build --wait qashio-api
```

Compose reads its settings from env files, and every value has a local default:

- `./.env` (from the root `.env.example`): Postgres and pgAdmin credentials, `RUN_MIGRATIONS`, host ports.
- `./qashio-api/.env`: the API settings above. Inside the compose network, `DATABASE_URL`, `REDIS_HOST/PORT` and `SMTP_HOST/PORT` are overridden to reach the `postgres`, `redis` and `mailpit` containers.

The entrypoint applies pending migrations before starting (`RUN_MIGRATIONS=false` to skip). Postgres has a healthcheck, and `--wait` blocks until `/health` is green. Mailpit catches every email the API sends (OTP codes, budget alerts) at [http://localhost:8025](http://localhost:8025).

To run the API on the host instead, start only the infrastructure: `docker compose up -d postgres redis mailpit`, then `npm run start:dev` with the default `.env`.

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run start:dev` / `start` / `start:prod` | Watch mode / start / run compiled `dist` |
| `npm run build` | Compile |
| `npm test` / `test:cov` / `test:e2e` | Unit tests / coverage / e2e |
| `npm run lint` / `format` / `format:check` | ESLint / Prettier |
| `npm run seed` | Idempotent currency upsert |
| `npm run migration:run` / `migration:revert` / `migration:show` | Apply / revert last / list |
| `npm run migration:generate -- src/shared/database/migrations/<Name>` | Generate from entity changes |
| `npm run migration:check` | Fails if entities and migrations differ (use in CI) |
| `npm run migration:run:prod` | Apply migrations from compiled `dist` |

**Migrations:** after changing an `*.orm-entity.ts`, run `migration:generate`, review the SQL, commit it, and keep `migration:check` green. `InitialSchema` is idempotent, so databases created by the old `synchronize` simply record it as applied.

---

## API

All routes except auth, `/currencies` and `/health*` need `Authorization: Bearer <access token>`. Errors use one shape: `{ statusCode, error, message, code?, details?, path, timestamp, requestId }`.

### Auth

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/auth/register` | Create an inactive user and email an OTP |
| `POST` | `/auth/verify-email` | Activate, open a session, emit `user.activated` (default wallets + categories) |
| `POST` | `/auth/login` | Access + refresh token |
| `POST` | `/auth/refresh` | Rotate the refresh token (single-flight, see below) |
| `POST` | `/auth/logout` | Revoke the session |
| `POST` | `/auth/forgot-password` | Email a reset OTP and return an `otpToken` (same response for unknown emails) |
| `POST` | `/auth/reset-password` | OTP + `otpToken` + new password; revokes all sessions |
| `POST` | `/auth/change-password/request` / `confirm` | Current password → OTP → new password |

### Wallets, currencies, categories

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/currencies` | Seeded currencies (public) |
| `POST` / `GET` | `/accounts` | Create / list wallets (`?includeArchived=`), with derived `balance` |
| `GET` / `PATCH` | `/accounts/:id` | Get / rename, opening balance, set default, archive. Currency is fixed |
| `POST` / `GET` | `/categories` | Create / list (`kind`: `income`, `expense`, `both`) |

### Transactions

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/transactions` | Record income or expense. **Requires `Idempotency-Key: <uuid>`** |
| `GET` | `/transactions` | `page`, `limit` (≤100), `sortBy`, `sortOrder`, `accountId`, `categoryId`, `type`, `status`, `from`, `to`, `search` |
| `GET` | `/transactions/summary` | Completed income / expense / net per currency |
| `GET` / `PUT` / `DELETE` | `/transactions/:id` | Get / partial update / delete (204) |

- **Money in / out:** `amount` is always positive and `type` gives the direction. Responses add `direction` and `signedAmount`. Wallet balance = opening balance + completed income − completed expense. It is derived, never stored.
- **Retries never double-save:** the client sends one `Idempotency-Key` per user action and reuses it on retry. The key is unique per user in the DB, so even racing requests insert once. A retry returns the original with `Idempotent-Replayed: true`. The same key with a different payload returns `422`; a missing or invalid key returns `400`.
- **Accidental re-entry:** a new key that matches an entry from the last 2 minutes (wallet, type, category, amount, counterparty) returns `409 POSSIBLE_DUPLICATE` with `details.duplicateOf`. Resending with `confirmDuplicate: true` and the same key saves it.

### Budgets & notifications

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/budgets` | `accountId`, `categoryIds[]` (one budget each, all or none), `amount`, `period` (`weekly` / `monthly` / `yearly`). Currency comes from the wallet |
| `GET` | `/budgets`, `/budgets/:id` | With current-period usage: spent, remaining, percentUsed, status |
| `PATCH` / `DELETE` | `/budgets/:id` | Change amount / period; delete (204) |
| `GET` | `/notifications` | Newest first (`limit` ≤ 50, `unreadOnly`) + `unreadCount` |
| `PATCH` | `/notifications/:id/read` | Mark one read (idempotent, 204) |
| `POST` | `/notifications/read-all` | Mark all read (204) |

A budget alert fires when a transaction change **crosses** 80% or 100% of a budget in the current period. Crossing it once raises one alert, not one per later expense. The alert is stored in-app and emailed. Over-budget expenses are never blocked.

### Health (public, not rate limited)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health/live` | Liveness: the process is up |
| `GET` | `/health` | Readiness: app, database, Redis, heap and RSS memory. Returns **503** naming the failing check |

---

## Domain events (transactional outbox + BullMQ)

An event can't be lost between the database and Redis:

1. **Record:** a use case runs its write and `events.emit(...)` inside one `UNIT_OF_WORK` transaction (`nestjs-cls` shares it across repositories). `emit` only inserts a row into `outbox_events`, so the event commits or rolls back with the write.
2. **Relay:** `OutboxRelay` polls every second. It locks pending rows with `FOR UPDATE SKIP LOCKED` (safe with several API instances), enqueues **one BullMQ job per `@OnDomainEvent` handler**, and marks the rows published in the same transaction. If Redis is down, the rows stay pending and the next pass retries.
3. **Handle:** a worker in the same process runs each job. Handlers are the `@OnDomainEvent(EVENT)` methods found at boot with Nest's `DiscoveryService`.

| Event | Handlers |
|-------|----------|
| `user.activated` | default wallets, default categories |
| `account.created` / `account.updated` | notifications |
| `transaction.created` / `.updated` / `.deleted` | budget threshold check, notifications |
| `budget.threshold_reached` | notifications (in-app + email) |

- **Retries:** 5 attempts per handler job, with exponential backoff (2s, 4s, 8s, 16s). A failing handler doesn't re-run the others for the same event.
- **Durability:** a committed event stays in Postgres until relayed, and its jobs stay in Redis until handled, so neither an API crash nor a Redis outage loses it. Completed jobs are kept 24 h. Jobs that fail all 5 attempts are kept 7 days and logged at error level, which also reports them to Sentry. Published outbox rows are deleted after 7 days.
- **No duplicates on replay:** job ids are `{eventId}.{handler}`, so relaying a row twice (crash after enqueue, before marking it published) is ignored by BullMQ. Handlers also receive `{ eventId }`: notifications are unique per event (`notifications.event_id`), so a redelivered event is stored and emailed once; budget alerts carry a dedupe key, so a retried budget check records one alert.
- **Handler rules:** throw on failure (never catch-and-log, because that disables retries), be safe to run twice (use `context.eventId`), and keep payloads JSON-safe. Listener class names must be unique, because the handler id is `ClassName.method`.
- **Emitter rule:** `await events.emit(...)` inside the same `unitOfWork.run(...)` as the write it describes.
- **Redis for production:** BullMQ needs `maxmemory-policy noeviction`. Enable AOF (`appendonly yes`) so queued jobs survive a Redis restart; the root `docker-compose.yml` does both.
- **One Redis per environment:** every API process that shares a Redis also shares the `domain-events` queue, and runs the other processes' jobs against its own database. Give each environment its own Redis, or its own Redis DB number (`REDIS_URL=redis://host:6379/<n>`).

---

## Security & observability

- **Request id:** every response has `X-Request-Id` (the caller's id if it's safe, else a UUID). It appears in every log line for that request, in error bodies, in `activity_logs.metadata.requestId` and as a Sentry tag.
- **Rate limits** (per IP, Redis-backed, so shared across instances): global `RATE_LIMIT_PER_MINUTE`; login, register, verify-email, forgot/reset and change password at 5/min; refresh at 30/min. Exceeding a limit returns 429.
- **OTPs** are stored hashed with a TTL and discarded after 5 wrong attempts. A password reset only works for the client holding the `otpToken` from forgot-password.
- **Refresh rotation:** a Redis `SET NX PX` lock per token makes rotation single-flight across requests and instances. Concurrent or late callers with the same old token get the same new pair for 30 s instead of being logged out.
- **Sentry** (off unless `SENTRY_ENABLED=true`): unexpected errors and error-level logs are reported once. Expected 4xx are not. Bodies, cookies and auth headers are never sent.
- **Env guardrails in production:** `EMAIL_OTP_MODE=live` and a unique JWT secret of 32+ characters are required.

---

## Testing

Unit tests cover the critical paths only: money and validation, auth (OTP binding, refresh concurrency), transaction rules and idempotency, budget thresholds, notifications and the event queue. Use cases are tested against mocked ports; the event-queue spec uses Nest's real `DiscoveryService`.

```bash
npm test
```

---

## Related

- Frontend: `../qashio-frontend-assignment`
- Repo root: `docker-compose.yml` (API, Postgres, Redis, frontend, pgAdmin)
