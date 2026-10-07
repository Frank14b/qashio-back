# Database schema & user flows

Design for a basic multi-wallet expense tracker: **auth → sessions → accounts (wallets) → transactions**.

Categories (assignment requirement) are included so every transaction has a category. Budgets can plug in later without changing the core graph.

---

## Goals

1. A user can register / log in and hold **refresh sessions**.
2. Signup requires **email OTP verification** before the account is active (`users.is_active`).
3. Password reset and change-password use email OTPs stored in **Redis** (TTL).
4. A user can create one or more **accounts/wallets**, each with its own **currency**.
5. Transactions belong to a **wallet** (and thus inherit that wallet’s currency).
6. Postgres is the source of truth for users/sessions; Redis holds short-lived OTPs (and later cache/queues).

---

## Domain overview

```mermaid
flowchart LR
  User -->|owns| Session
  User -->|owns| Account
  User -->|owns| Category
  User -->|generates| ActivityLog
  Account -->|has| Currency
  Account -->|has many| Transaction
  Category -->|labels| Transaction
```

### Activity logs — yes, it makes sense

An `activity_logs` table is a good fit for this API:

- Audits **who did what** (auth, wallet changes, transaction CRUD)
- Matches the assignment’s “log activity” listener idea without coupling logs to Kafka
- Supports support/debug (“when was this session revoked?”)
- Keep writes **append-only** and preferably async (EventEmitter → log writer) so request latency stays low

Do **not** put huge request/response bodies in logs. Store action + resource ids + small JSON metadata.

**HTTP logging pattern:** decorate handlers with `@LogActivity({ action: ActivityAction.… })`. A global `ActivityLogInterceptor` writes the row after a successful response. `user_id` is optional — resolved from the response path (`userIdFrom`) or from `req.user` after JWT auth. Domain/job side-effects can still call `RecordActivityLogUseCase` directly.

---

## Entity-relationship diagram

```mermaid
erDiagram
  users ||--o{ auth_sessions : has
  users ||--o{ accounts : owns
  users ||--o{ categories : owns
  users ||--o{ activity_logs : generates
  currencies ||--o{ accounts : "priced in"
  accounts ||--o{ transactions : records
  categories ||--o{ transactions : classifies

  users {
    uuid id PK
    string email UK
    string password_hash
    string display_name
    boolean is_active
    timestamptz created_at
    timestamptz updated_at
  }

  auth_sessions {
    uuid id PK
    uuid user_id FK
    string refresh_token_hash
    string user_agent
    string ip_address
    timestamptz expires_at
    timestamptz revoked_at
    timestamptz created_at
  }

  activity_logs {
    uuid id PK
    uuid user_id FK
    string action
    string resource_type
    string resource_id
    json metadata
    string ip_address
    string user_agent
    timestamptz created_at
  }

  currencies {
    char code PK
    string name
    string symbol
    int decimal_places
  }

  accounts {
    uuid id PK
    uuid user_id FK
    string name
    char currency_code FK
    decimal opening_balance
    boolean is_default
    timestamptz archived_at
    timestamptz created_at
    timestamptz updated_at
  }

  categories {
    uuid id PK
    uuid user_id FK
    string name
    string kind
    timestamptz created_at
    timestamptz updated_at
  }

  transactions {
    uuid id PK
    uuid account_id FK
    uuid category_id FK
    uuid user_id FK
    string reference UK
    decimal amount
    string type
    string status
    string counterparty
    timestamptz occurred_at
    string narration
    timestamptz created_at
    timestamptz updated_at
  }
```

---

## Table definitions

### `users`

| Column | Type | Notes |
|--------|------|--------|
| `id` | `uuid` PK | |
| `email` | `citext` / `varchar` UK | Unique, normalized lowercase |
| `password_hash` | `varchar` | Argon2id or bcrypt — never store plaintext |
| `display_name` | `varchar` | |
| `is_active` | `boolean` | `false` until email OTP verified; also used to soft-disable |
| `created_at` / `updated_at` | `timestamptz` | |

### `auth_sessions`

Represents a **refresh-token session** (device/browser login). Access tokens stay short-lived JWTs (not stored).

| Column | Type | Notes |
|--------|------|--------|
| `id` | `uuid` PK | Also usable as `jti` / session id in JWT claims |
| `user_id` | `uuid` FK → `users` | Cascade delete optional; prefer restrict + revoke |
| `refresh_token_hash` | `varchar` | Hash of refresh token only |
| `user_agent` | `varchar` nullable | |
| `ip_address` | `inet` / `varchar` nullable | |
| `expires_at` | `timestamptz` | |
| `revoked_at` | `timestamptz` nullable | Logout / revoke all |
| `created_at` | `timestamptz` | |

Indexes: `(user_id)`, `(expires_at)`, unique on `refresh_token_hash`.

### `activity_logs`

Append-only audit trail of API-domain activity.

| Column | Type | Notes |
|--------|------|--------|
| `id` | `uuid` PK | |
| `user_id` | `uuid` FK → `users` nullable | Optional — null when no authenticated user yet |
| `action` | `varchar` | Values from `ActivityAction` enum (e.g. `auth.login`) |
| `resource_type` | `varchar` nullable | e.g. `user`, `auth_session`, `transaction` |
| `resource_id` | `varchar` nullable | Target id as string |
| `metadata` | `jsonb` nullable | Small structured context only |
| `ip_address` | `varchar` nullable | |
| `user_agent` | `varchar` nullable | |
| `created_at` | `timestamptz` | No `updated_at` — immutable |

Indexes: `(user_id, created_at DESC)`, `(action, created_at DESC)`, `(resource_type, resource_id)`.

### `currencies`

Seeded reference data (ISO 4217 subset).

| Column | Type | Notes |
|--------|------|--------|
| `code` | `char(3)` PK | e.g. `USD`, `EUR`, `XAF` |
| `name` | `varchar` | |
| `symbol` | `varchar` | e.g. `$`, `€` |
| `decimal_places` | `smallint` | Usually `2`; some currencies `0` |

Wallets **do not** convert FX in v1 — each account is single-currency.

### `accounts` (wallets)

| Column | Type | Notes |
|--------|------|--------|
| `id` | `uuid` PK | |
| `user_id` | `uuid` FK → `users` | |
| `name` | `varchar` | e.g. “Cash”, “Revolut EUR” |
| `currency_code` | `char(3)` FK → `currencies` | Fixed for the life of the account (v1) |
| `opening_balance` | `numeric(19, 4)` default `0` | Balance before the first transaction; may be negative; editable via `PATCH /accounts/:id` |
| `is_default` | `boolean` | At most one default per user (partial unique index) |
| `archived_at` | `timestamptz` nullable | Soft archive; hide from pickers |
| `created_at` / `updated_at` | `timestamptz` | |

Unique `(id, user_id)` — target of the composite FK from `transactions`.

**Balance:** no stored `balance` column. It is derived per request (`GET /accounts`, `GET /accounts/:id`):

```text
balance = opening_balance + Σ completed income − Σ completed expense
```

If it ever needs caching, update the cache in the **same DB transaction** as the transaction write — not in an async event listener (a failed or duplicated listener would make it drift).

### `categories`

User-scoped (assignment: create + list).

| Column | Type | Notes |
|--------|------|--------|
| `id` | `uuid` PK | |
| `user_id` | `uuid` FK → `users` | |
| `name` | `varchar` | Unique per user recommended |
| `kind` | `varchar` / enum | `income` \| `expense` \| `both` |
| `created_at` / `updated_at` | `timestamptz` | |

Unique `(user_id, name)` and `(id, user_id)` (target of the composite FK from `transactions`).

### `transactions`

| Column | Type | Notes |
|--------|------|--------|
| `id` | `uuid` PK | |
| `reference` | `varchar(32)` UK | Human-readable, e.g. `TXN-261007-7K3Q9D`; generated server-side, retried on collision |
| `user_id` | `uuid` | Denormalized owner (authz / filters) |
| `account_id` | `uuid` | Wallet; implies currency |
| `category_id` | `uuid` | Required |
| `type` | `varchar(10)` | `income` (money **in**, +) \| `expense` (money **out**, −) |
| `amount` | `numeric(19, 4)` | Always **> 0**; the sign comes from `type`; decimals ≤ currency `decimal_places` |
| `status` | `varchar(12)` default `completed` | `pending` \| `completed` \| `failed`. DB-only for now: the API creates `completed` and does not accept changes. Only `completed` rows count toward balances / summaries |
| `counterparty` | `varchar(160)` nullable | Who was paid / who paid |
| `narration` | `text` nullable | |
| `occurred_at` | `timestamptz` | Business date/time of the entry |
| `created_at` / `updated_at` | `timestamptz` | |

Constraints (DB):

- `CHK_transactions_amount_positive`: `amount > 0`
- `CHK_transactions_type`, `CHK_transactions_status`: allowed values
- `UQ_transactions_reference`
- `FK_transactions_account_user`: `(account_id, user_id) → accounts(id, user_id)` — a transaction can only point at its owner's wallet
- `FK_transactions_category_user`: `(category_id, user_id) → categories(id, user_id)`
- Both FKs `ON DELETE RESTRICT` (archive wallets instead of deleting them)

Application rules: category `kind` compatible with `type` (`both` fits either); no new entries on archived wallets; moving an entry to a wallet in another currency is rejected.

Indexes: `(user_id, occurred_at)`, `(account_id, occurred_at)`, `(user_id, category_id, occurred_at)` (budget queries).

### `budgets`

| Column | Type | Notes |
|--------|------|--------|
| `id` | `uuid` PK | |
| `user_id` | `uuid` | Owner |
| `category_id` | `uuid` | Composite FK `(category_id, user_id)` → `categories`; expense or both (app rule) |
| `account_id` | `uuid` | Composite FK `(account_id, user_id)` → `accounts`; the budget's currency is the wallet's |
| `amount` | `numeric(19, 4)` | Limit per period, `> 0` |
| `period` | `varchar(10)` | `weekly` | `monthly` | `yearly` |
| `created_at` / `updated_at` | `timestamptz` | |

One budget per scope: unique `(user_id, category_id, account_id, period)`. The API can create budgets for several categories at once (same wallet, limit and period; all or none). **Usage is never stored**: completed expenses in the category on that wallet within the current `date_trunc` period.

### `notifications`

| Column | Type | Notes |
|--------|------|--------|
| `id` | `uuid` PK | |
| `user_id` | `uuid` | Recipient |
| `type` | `varchar(40)` | Source event, e.g. `budget.threshold_reached` |
| `title` / `message` | `varchar(160)` / `text` | Rendered at creation |
| `data` | `jsonb` | Ids to link to (`transactionId`, `budgetId`, `accountId`) |
| `read_at` | `timestamptz` nullable | |
| `created_at` | `timestamptz` | |

Indexes: `(user_id, created_at)`, partial `(user_id) WHERE read_at IS NULL` for the unread badge.

---

## Auth model (access + refresh)

```text
Access token  = short-lived JWT (e.g. 15m) — claims: sub=userId, sid=sessionId
Refresh token = opaque random string — only hash stored in auth_sessions
```

| Action | Effect |
|--------|--------|
| Login / register | Create `auth_sessions` row + return access + refresh |
| API call | Bearer access JWT; guard loads user (+ optional session check) |
| Refresh | Validate refresh hash, rotate token, extend or replace session |
| Logout | Set `revoked_at` on session |
| Logout all | Revoke all sessions for `user_id` |

---

## User flows

### 1. Register, verify email OTP, first wallet

**Chosen flow:** register creates the user as **inactive** (`is_active=false`), emails an OTP (Redis TTL), and does **not** open a session. Login is blocked until `POST /auth/verify-email` succeeds (activates the user and opens a session).

```mermaid
sequenceDiagram
  actor U as User
  participant API as Nest API
  participant DB as Postgres
  participant R as Redis
  participant M as SMTP

  U->>API: POST /auth/register (email, password, displayName)
  API->>DB: INSERT users (is_active=false)
  API->>R: SET otp:email_verify:{email} (TTL)
  API->>M: Send OTP email
  API-->>U: requiresEmailVerification

  U->>API: POST /auth/verify-email (email, otp)
  API->>R: GET+DEL OTP
  API->>DB: SET is_active=true
  API->>DB: INSERT auth_sessions
  API-->>U: accessToken + refreshToken + user

  U->>API: POST /accounts (name, currencyCode) [Bearer]
  API->>DB: INSERT accounts (optional is_default=true)
  API-->>U: account
```

### 1b. Forgot password & change password (OTP)

| Endpoint | Behavior |
|----------|----------|
| `POST /auth/forgot-password` | If active user exists, store reset OTP in Redis and email it (generic response either way) |
| `POST /auth/reset-password` | Verify OTP → update password hash → revoke all sessions |
| `POST /auth/change-password/request` | Verify current password → email change OTP |
| `POST /auth/change-password/confirm` | Verify OTP → update password → revoke all sessions |

**OTP mode:** `EMAIL_OTP_MODE=fixed` always uses `123456` (dev); `live` generates a secure random 6-digit code. TTL: `EMAIL_OTP_TTL_SECONDS`.

### 2. Login & session refresh

```mermaid
sequenceDiagram
  actor U as User
  participant API as Nest API
  participant DB as Postgres

  U->>API: POST /auth/login
  API->>DB: Verify password_hash
  API->>DB: INSERT auth_sessions
  API-->>U: accessToken + refreshToken

  U->>API: POST /auth/refresh (refreshToken)
  API->>DB: Match hash, not revoked, not expired
  API->>DB: Rotate refresh_token_hash
  API-->>U: new accessToken + refreshToken

  U->>API: POST /auth/logout
  API->>DB: SET revoked_at = now()
  API-->>U: 204
```

### 3. Transaction on a wallet

```mermaid
sequenceDiagram
  actor U as User
  participant API as Nest API
  participant DB as Postgres

  U->>API: POST /transactions (accountId, categoryId, amount, type, occurredAt)
  API->>API: Authz: account.user_id === jwt.sub
  API->>DB: INSERT transactions
  API->>API: Emit transaction.created (budget check later)
  API-->>U: transaction

  Note over U,DB: Currency comes from accounts.currency_code — not sent on the transaction body
```

### 4. High-level product journey

```mermaid
flowchart TD
  A[Register / Login] --> B[Session created]
  B --> C{Has wallet?}
  C -->|No| D[Create account + currency]
  C -->|Yes| E[Select wallet]
  D --> E
  E --> F[Create / list categories]
  F --> G[Add income or expense]
  G --> H[List / filter transactions per wallet]
  H --> I[Optional: budgets vs spending]
```

---

## Suggested API surface (auth + wallets + transactions)

| Area | Methods |
|------|---------|
| Auth | `POST /auth/register`, `POST /auth/verify-email`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `POST /auth/forgot-password`, `POST /auth/reset-password`, `POST /auth/change-password/request`, `POST /auth/change-password/confirm` |
| Accounts | `POST /accounts`, `GET /accounts`, `GET /accounts/:id`, `PATCH /accounts/:id` |
| Currencies | `GET /currencies` (seeded) |
| Categories | `POST /categories`, `GET /categories` |
| Transactions | Full CRUD scoped by account / user |

All account/category/transaction routes require a valid access token. Frontend `middleware.ts` can gate pages; API remains the source of truth for authz.

---

## Implementation notes (Nest / hexagonal)

Align with `src/modules/<feature>/` ports & adapters:

| Module | Owns |
|--------|------|
| `auth` | users lookup for login, sessions port, JWT |
| `users` | profile (thin) |
| `accounts` | wallets + currency binding |
| `categories` | user categories |
| `transactions` | entries + events |

Recommended first build order:

1. Migrations + seed currencies  
2. Auth (register/login/refresh/logout)  
3. Accounts  
4. Categories  
5. Transactions  
6. Budgets + listeners  

---

## Out of scope for this schema (v1)

- FX conversion / multi-currency single wallet  
- Transfers between wallets (can be two transactions later)  
- OAuth / social login  
- Storing access tokens server-side  
- Kafka  

---

## Implemented decisions (accounts / currencies / categories / transactions)

1. **Default wallets** — on verify-email, Nest `EventEmitter` event `user.activated` triggers accounts `UserActivatedListener` → `CreateDefaultAccountsUseCase` inserts starter wallets idempotently by name (`Cash` default USD, `Bank`, `Credit Card`). Users can rename / change default / archive later via `PATCH /accounts/:id`. Manual `POST /accounts` still works; first manually created wallet becomes `is_default` if none is set and `isDefault` is omitted.
2. **Currency change** — forbidden after create (column fixed; no PATCH for `currencyCode`).
3. **Refresh rotation** — always rotate on refresh (auth module).
4. **Currency seed** — idempotent upsert by `code` on boot (default on; `SEED_CURRENCIES=false` to skip); also `npm run seed`.
5. **Default categories** — same `user.activated` event; categories `UserActivatedListener` inserts defaults idempotently (skip names the user already has). Prefer EventEmitter over Bull for this small in-process write; use Bull later for heavy/retryable/multi-instance jobs.
6. **Migrations** — `synchronize` is off; schema changes ship as TypeORM migrations in `src/shared/database/migrations` (baseline `InitialSchema` is idempotent for DBs created by the old sync). Docker entrypoint runs `npm run migration:run` before the app starts (`RUN_MIGRATIONS=false` to skip).
7. **Money** — `numeric(19, 4)` in Postgres, decimal strings in TypeScript (`decimal.js` for math, class-validator `IsDecimal` on input); responses are formatted to the currency's `decimal_places`.
8. **Transaction events** — `transaction.created`, `transaction.updated` (`previous` + `current`), `transaction.deleted`; payloads are plain snapshots for budget/activity listeners.
