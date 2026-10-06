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
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_FROM=noreply@qashio.local
```

- `EMAIL_OTP_MODE=fixed` → OTP is always `123456` (local/dev)
- `EMAIL_OTP_MODE=live` → random 6-digit OTP emailed via Nodemailer

### Local

```bash
cd qashio-api
npm install
npm run start:dev
```

API: [http://localhost:3000](http://localhost:3000)

### Docker (from repo root)

```bash
docker compose up -d --build qashio-api postgres redis
```

API is mapped to [http://localhost:3000](http://localhost:3000).

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

Pre-commit (Husky + lint-staged) runs ESLint and Prettier on staged files when hooks are installed via `npm install` / `npm run prepare`.

---

## Planned API surface (minimum)

### Transactions

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/transactions` | Create |
| `GET` | `/transactions` | List (filter / sort / paginate later) |
| `GET` | `/transactions/:id` | Get one |
| `PUT` | `/transactions/:id` | Update |
| `DELETE` | `/transactions/:id` | Delete |

### Categories

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/categories` | Create |
| `GET` | `/categories` | List |

### Budgets (starter goal)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/budgets` | Set budget per category / period |
| `GET` | `/budgets` | List |
| `GET` | `/budgets/:categoryId/usage` | Spending vs budget |

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

### Next — core modules

- [ ] `CategoriesModule` (entity, DTO, CRUD list/create)
- [ ] `TransactionsModule` (entity linked to category, full CRUD)
- [ ] `AccountsModule` (wallets)

### Next — event-driven budget check

- [ ] Emit domain event on transaction create/update (Nest `EventEmitter`)
- [ ] Listener: log activity + recompute / check budget usage
- [ ] Redis cache for hot reads (categories, budget summary)
- [ ] Optional Bull queue for heavier async work

### Later / bonus

- [ ] Filtering, sorting, pagination on `GET /transactions`
- [ ] Summary/report endpoint (income vs expense by date range)
- [ ] JWT route guards for protected resources
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
