# Qashio API

NestJS backend for the Qashio expense tracker. Exposes REST APIs for transactions, categories, and budgets, with Postgres as the source of truth and Redis for caching / queues.

**Domain design:** see [`docs/`](./docs/) — [database schema & auth flows](./docs/database-and-auth.md).

---

## Tech stack

| Area | Choice |
|------|--------|
| Framework | NestJS 11 |
| Language | TypeScript |
| ORM | TypeORM or Prisma (preferred: TypeORM) |
| Database | PostgreSQL |
| Cache / queues | Redis (Bull/BullMQ for background jobs) |
| Events | NestJS EventEmitter (domain events; Kafka optional later) |
| Validation | class-validator + class-transformer (DTOs) |
| Docs | Swagger / OpenAPI |
| Quality | ESLint, Prettier, Husky, lint-staged, Jest |

---

## Project structure (target)

Nest modular layout — one module per domain:

```text
src/
  main.ts
  app.module.ts
  shared/                    # shared pipes, filters, guards, utils
  transactions/
    transactions.module.ts
    transactions.controller.ts
    transactions.service.ts
    dto/
    entities/
  categories/
    ...
  budgets/
    ...
  # optional later:
  # redis/  cache + queue module
  # events/ listeners for transaction created/updated
```

---

## Setup

### Prerequisites

- Node.js 18+ (22 recommended to match `Dockerfile.dev`)
- npm
- PostgreSQL + Redis (via Docker Compose from repo root, or local installs)

### Environment

Copy and adjust as needed (do not commit real secrets):

```bash
cp .env.example .env
```

Example variables (see `.env.example` for the full list):

```env
PORT=3000
DATABASE_URL=postgresql://postgres:password@localhost:5432/qashio_points
REDIS_HOST=localhost
REDIS_PORT=6379
EMAIL_OTP_MODE=fixed
EMAIL_OTP_TTL_SECONDS=600
RUN_MIGRATIONS=true      # Docker entrypoint applies pending migrations on start
# SEED_CURRENCIES=false  # optional; currencies are upserted on boot by default
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_FROM=noreply@qashio.local
```

- `EMAIL_OTP_MODE=fixed` → OTP is always `123456` (local/dev)
- `EMAIL_OTP_MODE=live` → random 6-digit OTP emailed via Nodemailer
- **Schema:** managed by TypeORM migrations only — `synchronize` is always off. See [Migrations](#migrations).
- **Currency seed:** on boot, currencies are upserted by ISO `code` (idempotent). Set `SEED_CURRENCIES=false` to skip; force with `npm run seed`.

### Local

```bash
cd qashio-api
npm install
npm run migration:run # apply pending migrations
npm run seed          # optional explicit currency upsert
npm run start:dev
```

API: [http://localhost:3000](http://localhost:3000)  
Swagger: [http://localhost:3000/docs](http://localhost:3000/docs) (disabled when `NODE_ENV=production`)

### Docker (from repo root)

```bash
docker compose up -d --build qashio-api postgres redis
```

The API entrypoint runs `npm run migration:run` before starting (Postgres has a healthcheck, so it waits for the DB). Set `RUN_MIGRATIONS=false` to skip.

API is mapped to [http://localhost:3000](http://localhost:3000). Swagger: [http://localhost:3000/docs](http://localhost:3000/docs) when not in production.

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run start:dev` | Watch mode |
| `npm run start` | Standard start |
| `npm run start:prod` | Run compiled `dist` |
| `npm run build` | Compile TypeScript |
| `npm run lint` | ESLint (fix) |
| `npm run format` | Prettier write |
| `npm run format:check` | Prettier check |
| `npm test` | Unit tests |
| `npm run test:e2e` | E2E tests |
| `npm run test:cov` | Coverage |
| `npm run seed` | Idempotent currency upsert (ISO codes) |
| `npm run migration:run` | Apply pending migrations |
| `npm run migration:revert` | Revert the last migration |
| `npm run migration:show` | List migrations and whether they ran |
| `npm run migration:generate -- src/shared/database/migrations/<Name>` | Generate a migration from entity changes |
| `npm run migration:create -- src/shared/database/migrations/<Name>` | Empty migration |
| `npm run migration:check` | Fails if entities and migrations are out of sync |
| `npm run migration:run:prod` | Apply migrations from compiled `dist` |

### Migrations

- Files live in `src/shared/database/migrations`; the CLI data source is `src/shared/database/data-source.ts` (shares options with `DatabaseModule` via `typeorm.config.ts`).
- `InitialSchema` is the baseline of the schema previously created by `synchronize`. It is idempotent (`IF NOT EXISTS`, same constraint names), so existing dev databases just record it as applied.
- After changing an `*.orm-entity.ts`, run `migration:generate`, review the SQL, commit it, and keep `migration:check` green.

Pre-commit (Husky + lint-staged) runs ESLint and Prettier on staged files when hooks are installed via `npm install` / `npm run prepare`.

---

## API surface

### Observability & abuse protection

- **Environment validation:** `src/shared/config/env.ts` (zod) validates every variable at startup (`instrument.ts`, before anything loads) and backs `ConfigModule`, so `ConfigService` returns typed values. Invalid config stops the process with a list of every problem. Production guardrails: `EMAIL_OTP_MODE=live`, a unique 32+ char `JWT_ACCESS_SECRET`; `SENTRY_ENABLED=true` requires `SENTRY_DSN`. The migration CLI only checks `DATABASE_URL`.
- **Sentry** (`@sentry/nestjs`, off by default — `SENTRY_ENABLED` + `SENTRY_DSN`): unexpected errors and error-level logs (e.g. failing event listeners) are reported once, tagged `request_id`; expected HTTP errors (4xx, deliberate 5xx such as the health 503) are not. Request/response bodies, cookies and auth headers are never sent.

- **Request id:** every response carries `X-Request-Id` (the caller's value if valid, else a UUID). Logs are structured JSON via `nestjs-pino` (pretty in dev); every line written while handling the request — including async event listeners (budgets, notifications) — has the same `req.id`. Error bodies include `requestId`; activity logs store it in `metadata.requestId`. The web app sends its own id per action (reused on the retry after a token refresh).
- **Rate limits** (`@nestjs/throttler`, Redis storage, per IP): global `RATE_LIMIT_PER_MINUTE` (120); login, register, verify-email, forgot/reset password and change-password 5/min; refresh 30/min; `/health` exempt. Exceeding returns 429. Set `TRUST_PROXY` behind a load balancer.
- **OTP brute force:** each code is discarded after 5 wrong attempts (per email, across IPs).
- **Password reset binding:** `POST /auth/forgot-password` returns an `otpToken` (same shape for unknown emails); `POST /auth/reset-password` requires it with the OTP, so only the client that requested the code can use it. Only the token's hash is stored.
- **Refresh rotation:** a Redis `SET NX` lock per refresh token makes rotation single-flight across requests and instances; the new pair is replayed for 30s to concurrent/late callers with the same old token (parallel calls, other tabs) instead of logging them out.

### Health (public)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health/live` | Liveness — process is up (no dependency checks); use for restarts |
| `GET` | `/health` | Readiness — app, database, Redis, heap and RSS memory. **503** if any is down; body names the failing check |

Memory limits: `HEALTH_MEMORY_HEAP_MB` (default 512), `HEALTH_MEMORY_RSS_MB` (default 1024). `APP_VERSION` is echoed in the `app` check.

**Pipeline usage:** Compose has a healthcheck on `/health`, so `docker compose up -d --wait qashio-api` blocks until the API is ready and exits non-zero if it never becomes healthy. Against a deployed URL: `curl -fsS https://<host>/health` (non-zero exit on 503).

### Auth (existing)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/auth/register` | Register (inactive until OTP) |
| `POST` | `/auth/verify-email` | Activate user + session; emits `user.activated` |
| `POST` | `/auth/login` | Login (verified users) |
| `POST` | `/auth/refresh` / `/auth/logout` | Session rotation / revoke |

### Currencies / accounts / categories / transactions

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/currencies` | No | List seeded currencies |
| `POST` | `/accounts` | Bearer | Create wallet |
| `GET` | `/accounts` | Bearer | List wallets (`?includeArchived=`) |
| `GET` | `/accounts/:id` | Bearer | Get one |
| `PATCH` | `/accounts/:id` | Bearer | Rename / opening balance / set default / archive |
| `POST` | `/categories` | Bearer | Create category |
| `GET` | `/categories` | Bearer | List categories |
| `POST` | `/transactions` | Bearer | Record income / expense (`accountId` optional → default wallet) |
| `GET` | `/transactions` | Bearer | List — `page`, `limit` (≤100), `sortBy`, `sortOrder`, `accountId`, `categoryId`, `type`, `status`, `from`, `to`, `search` |
| `GET` | `/transactions/summary` | Bearer | Completed income / expense / net per currency (`accountId`, `from`, `to`) |
| `GET` | `/transactions/:id` | Bearer | Get one |
| `PUT` | `/transactions/:id` | Bearer | Update (only fields sent change) |
| `DELETE` | `/transactions/:id` | Bearer | Delete (204) |

**Money in / out:** `amount` is always positive; `type` gives the direction — `income` adds to the wallet, `expense` subtracts. Responses include `direction` (`in`/`out`) and `signedAmount`. Wallet `balance` = `openingBalance` + completed income − completed expense (derived, never stored). Amounts are decimal strings formatted to the currency's decimal places.

**Events:** `transaction.created`, `transaction.updated` (previous + current snapshot), `transaction.deleted` via `EventEmitter`.

### Budgets & notifications

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/budgets` | Bearer | Create budgets on a wallet: `accountId`, `categoryIds[]` (expense/both; one budget each, all or none), `amount`, `period` (`weekly` | `monthly` | `yearly`). Currency is the wallet's |
| `GET` | `/budgets` | Bearer | List with current-period `usage` (spent, remaining, percentUsed, status) |
| `GET` | `/budgets/:id` | Bearer | Get one with usage |
| `PATCH` | `/budgets/:id` | Bearer | Change `amount` and/or `period` (scope is fixed) |
| `DELETE` | `/budgets/:id` | Bearer | Delete (204) |
| `GET` | `/notifications` | Bearer | Newest notifications (`limit` ≤ 50, `unreadOnly`) + `unreadCount` |
| `PATCH` | `/notifications/:id/read` | Bearer | Mark one read (idempotent, 204) |
| `POST` | `/notifications/read-all` | Bearer | Mark all read (204) |

**Flow:** transaction events → budgets listener recomputes usage and emits `budget.threshold_reached` when *this* change crosses 80% or 100% (once per crossing, not on every later expense) → notifications listener stores an in-app notification and emails budget alerts. Transaction and account events (`account.created`, `account.updated`) become in-app notifications only. Usage is derived from transactions, never stored; periods follow Postgres `date_trunc` in the DB time zone (ISO weeks start Monday).

**Default categories:** after `POST /auth/verify-email`, Nest `EventEmitter` emits `user.activated`; `UserActivatedListener` creates a sensible default set (Food, Transport, Salary, …) idempotently by name.

### Still planned

| Area | Notes |
|------|-------|

---

## Starter plan

### Done (foundation)

- [x] NestJS scaffold + TypeScript
- [x] Dev Dockerfile + Compose wiring (Postgres, Redis)
- [x] ESLint, Prettier, Husky, lint-staged
- [x] Shared module + TypeORM database bootstrap
- [x] Hexagonal `users`, `auth` (sessions), `activity-logs` modules
- [x] Auth HTTP: register / verify-email / login / refresh / logout + Swagger at `/docs`
- [x] Redis adapter + Nodemailer email port for OTP flows
- [x] Signup email verification OTP; forgot-password + change-password with OTP
- [x] `CurrenciesModule` + idempotent seed (`SEED_CURRENCIES` / `npm run seed`)
- [x] `AccountsModule` (wallets CRUD-ish + JwtAuthGuard)
- [x] `CategoriesModule` (create/list + defaults on `user.activated` via EventEmitter)
- [x] TypeORM migrations (synchronize off; Docker entrypoint runs them)
- [x] Wallet opening balance + derived balance
- [x] `TransactionsModule` (CRUD, unique reference, counterparty, status, filters/sort/pagination, summary, domain events)

### Next — core modules

- [x] `BudgetsModule` (per category / period, derived usage, threshold alerts)
- [x] `NotificationsModule` (in-app feed + email for budget alerts)

### Next — event-driven budget check

- [x] Emit domain event on transaction create/update/delete (Nest `EventEmitter`)
- [x] Listener: check budget usage on transaction events
- [ ] Redis cache for hot reads (categories, budget summary)
- [ ] Optional Bull queue for heavier async work (email batches, multi-instance reliability)

### Later / bonus

- [x] Filtering, sorting, pagination on `GET /transactions`
- [x] Summary/report endpoint (income vs expense by date range)
- [ ] Production Dockerfile (`build` + `start:prod`)

### Out of scope for v1 (by design)

- Kafka — prefer Nest events (+ Redis queues). Document as a production scale-up if needed.

---

## Domain model (assignment)

**Transaction:** `amount`, `category`, `date`, `type` (`income` | `expense`)

**Category:** required on every transaction; users can create and list categories

**Budget:** amount per category over a period (e.g. monthly); expose spending vs limit

---

## Related

- Frontend: `../qashio-frontend-assignment`
- Repo root: `docker-compose.yml` (API + Postgres + Redis + frontend)
