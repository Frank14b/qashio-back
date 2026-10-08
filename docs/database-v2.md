# Database schema & system model — v2

This is the schema as it runs today, after the migrations below. It was generated from a migrated database (`information_schema` / `pg_indexes`), not written from memory. [v1](./database-and-auth.md) is the original design and is kept for history.

| Migration | Adds |
|-----------|------|
| `1791352800000-InitialSchema` | users, auth_sessions, activity_logs, currencies, accounts, categories (idempotent baseline) |
| `1791353100000-AddTransactionsAndOpeningBalance` | transactions, `accounts.opening_balance` |
| `1791450000000-AddBudgetsAndNotifications` | budgets, notifications |
| `1791540000000-AddTransactionIdempotencyKey` | `transactions.idempotency_key` + per-user unique index |
| `1791600000000-AddOutboxAndNotificationEventId` | `outbox_events` (transactional outbox), `notifications.event_id` (unique) |

---

## What changed since v1

| Area | v1 (design) | v2 (implemented) |
|------|-------------|------------------|
| Transactions | Planned | `reference` (`TXN-YYMMDD-XXXXXX`), `counterparty`, `status`, positive `amount` + `type` |
| Wallet balance | Open question | **Derived**: `opening_balance` + completed income − completed expense. Never stored |
| Ownership | `user_id` on each row | Plus **composite FKs** `(account_id, user_id)` / `(category_id, user_id)`. The DB rejects a transaction or budget that points at another user's wallet or category |
| Budgets | "later" | Per **wallet + category + period**; currency is the wallet's; usage derived with `date_trunc` |
| Notifications | — | In-app feed, filled by domain events; budget alerts are also emailed |
| Duplicate protection | — | `idempotency_key` unique per user + a 2-minute soft duplicate check |
| Events | In-process `EventEmitter` | **Transactional outbox** (`outbox_events`, same DB transaction as the write) relayed to a **BullMQ** queue: one job per handler, 5 attempts, no loss on a crash or Redis outage |
| Redis | OTPs | OTPs + attempt counters, refresh-rotation locks, rate-limit counters, event queue |

---

## System overview

```mermaid
flowchart LR
  subgraph Client
    FE[Next.js web app]
  end
  subgraph API["NestJS API (one process)"]
    HTTP[HTTP controllers<br/>+ use cases]
    PUB[DomainEventPublisher<br/>writes outbox row]
    REL[OutboxRelay<br/>polls every 1 s]
    WRK[domain-events worker<br/>@OnDomainEvent handlers]
  end
  PG[(Postgres<br/>source of truth)]
  RD[(Redis)]
  SMTP[SMTP]
  SEN[Sentry<br/>optional]

  FE -- "REST + Bearer JWT<br/>X-Request-Id, Idempotency-Key" --> HTTP
  HTTP --> PG
  HTTP -- "OTPs, refresh locks,<br/>rate limits" --> RD
  HTTP --> PUB
  PUB -- "same DB transaction<br/>as the write" --> PG
  PG -- "pending outbox rows" --> REL
  REL -- "addBulk: 1 job / handler" --> RD
  RD -- "jobs (retries, backoff)" --> WRK
  WRK --> PG
  WRK -- "budget alerts" --> SMTP
  HTTP -. "errors" .-> SEN
  WRK -. "exhausted jobs" .-> SEN
```

---

## Entity-relationship diagram

```mermaid
erDiagram
  users ||--o{ auth_sessions : "has (logical)"
  users ||--o{ accounts : "owns (logical)"
  users ||--o{ categories : "owns (logical)"
  users ||--o{ notifications : "receives (logical)"
  users |o--o{ activity_logs : "generates (logical)"
  currencies ||--o{ accounts : "priced in (FK)"
  accounts ||--o{ transactions : "records (FK account_id,user_id)"
  categories ||--o{ transactions : "classifies (FK category_id,user_id)"
  accounts ||--o{ budgets : "scopes (FK account_id,user_id)"
  categories ||--o{ budgets : "limits (FK category_id,user_id)"

  users {
    uuid id PK
    varchar_320 email UK
    varchar_255 password_hash
    varchar_120 display_name
    boolean is_active "false until email OTP verified"
    timestamptz created_at
    timestamptz updated_at
  }
  auth_sessions {
    uuid id PK
    uuid user_id
    varchar_255 refresh_token_hash UK "SHA-256 of opaque token"
    varchar_512 user_agent
    varchar_64 ip_address
    timestamptz expires_at
    timestamptz revoked_at
    timestamptz created_at
  }
  activity_logs {
    uuid id PK
    uuid user_id "nullable"
    varchar_120 action
    varchar_80 resource_type
    varchar_80 resource_id
    jsonb metadata "includes requestId"
    varchar_64 ip_address
    varchar_512 user_agent
    timestamptz created_at
  }
  currencies {
    char_3 code PK
    varchar_120 name
    varchar_16 symbol
    smallint decimal_places
  }
  accounts {
    uuid id PK
    uuid user_id "UK(id,user_id)"
    varchar_120 name
    char_3 currency_code FK
    numeric_19_4 opening_balance
    boolean is_default "one per user (partial UK)"
    timestamptz archived_at
    timestamptz created_at
    timestamptz updated_at
  }
  categories {
    uuid id PK
    uuid user_id "UK(id,user_id), UK(user_id,name)"
    varchar_120 name
    varchar_20 kind "income | expense | both"
    timestamptz created_at
    timestamptz updated_at
  }
  transactions {
    uuid id PK
    varchar_32 reference UK
    uuid user_id
    uuid account_id FK
    uuid category_id FK
    varchar_10 type "income | expense"
    numeric_19_4 amount "> 0"
    varchar_12 status "pending | completed | failed"
    varchar_160 counterparty
    text narration
    timestamptz occurred_at
    uuid idempotency_key "UK(user_id, key) when set"
    timestamptz created_at
    timestamptz updated_at
  }
  budgets {
    uuid id PK
    uuid user_id
    uuid account_id FK
    uuid category_id FK
    numeric_19_4 amount "> 0"
    varchar_10 period "weekly | monthly | yearly"
    timestamptz created_at
    timestamptz updated_at
  }
  notifications {
    uuid id PK
    uuid user_id
    varchar_40 type "event name"
    varchar_160 title
    text message
    jsonb data
    uuid event_id "UK when set: one per source event"
    timestamptz read_at
    timestamptz created_at
  }
  outbox_events {
    uuid id PK "also the event id"
    varchar_80 event
    jsonb payload
    varchar_200 dedupe_key "UK when set"
    timestamptz created_at
    timestamptz published_at "NULL = pending"
  }
```

"(FK)" means a database foreign key; "(logical)" means the column holds a user id but **no FK is declared** (see [Known gaps](#known-gaps)).

---

## Tables

### `transactions`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `reference` | varchar(32), unique | `TXN-YYMMDD-XXXXXX` (UTC date, Crockford base32). On a collision a new one is generated and the insert retried |
| `user_id` | uuid | Owner. Part of both composite FKs |
| `account_id` | uuid | FK `(account_id, user_id)` → `accounts(id, user_id)`, `ON DELETE RESTRICT` |
| `category_id` | uuid | FK `(category_id, user_id)` → `categories(id, user_id)`, `ON DELETE RESTRICT` |
| `type` | varchar(10) | CHECK `income` / `expense`. Gives the direction |
| `amount` | numeric(19,4) | CHECK `> 0`. The sign comes from `type` |
| `status` | varchar(12) | CHECK `pending` / `completed` / `failed`. Default `completed`, and only `completed` counts toward balances and budgets |
| `counterparty` | varchar(160) | Payer / payee |
| `narration` | text | |
| `occurred_at` | timestamptz | When the money moved; used for periods and filters |
| `idempotency_key` | uuid, null | `Idempotency-Key` of the create request. NULL for older rows |

Indexes: `(user_id, occurred_at)`, `(account_id, occurred_at)`, `(user_id, category_id, occurred_at)`, plus a partial unique index `(user_id, idempotency_key) WHERE idempotency_key IS NOT NULL`.

### `budgets`

One spending limit per **wallet + category + period**, enforced by `UQ_budgets_scope (user_id, category_id, account_id, period)`. Composite FKs keep the wallet and the category owned by the same user. CHECKs: `amount > 0`, `period IN (weekly, monthly, yearly)`. The UI can create several budgets in one call (one per selected category), and the insert is atomic.

### `notifications`

In-app feed. `type` is the source event (`transaction.created`, `budget.threshold_reached`, …) and `data` holds ids or amounts for the UI. `event_id` is the outbox id of that event; its partial unique index means a redelivered event can't create a second notification (or send a second alert email). Indexes: `(user_id, created_at)` for the feed, and a partial `(user_id) WHERE read_at IS NULL` for the unread badge.

### `outbox_events`

Transactional outbox. Each domain event is inserted in the **same DB transaction** as the change that raised it, so it exists if and only if that change committed. `OutboxRelay` reads rows with `published_at IS NULL` (partial index `IDX_outbox_events_pending`), enqueues them on BullMQ and sets `published_at`. `id` is the event id handlers receive, and it is part of every job id. `dedupe_key` (partial unique) lets an emitter that may run twice, such as a retried budget check, record an event once. Published rows are deleted after 7 days.

### `accounts` (wallets)

`currency_code` FK → `currencies(code)`. It is fixed after creation, and every amount on the wallet uses that currency. `opening_balance` numeric(19,4) is editable. A partial unique `(user_id) WHERE is_default` allows one default wallet per user, and `UQ (id, user_id)` is the target of the composite FKs. Archiving (`archived_at`) blocks new transactions but keeps history.

### `categories`

`kind` is `income`, `expense` or `both`. A transaction's `type` must be compatible with it (checked in the application). `UQ (user_id, name)` stops duplicates; `UQ (id, user_id)` is the target of the composite FKs.

### `users`, `auth_sessions`, `activity_logs`, `currencies`

These are unchanged from v1. The refresh token is stored only as a hash (unique). Sessions are revoked by setting `revoked_at`. Activity logs are append-only and written by the `@LogActivity` interceptor, with `metadata.requestId` linking each row to the request logs. Currencies are seeded idempotently on boot.

---

## Derived values (never stored)

```sql
-- Wallet balance
balance = accounts.opening_balance
        + SUM(amount) FILTER (WHERE type = 'income'  AND status = 'completed')
        - SUM(amount) FILTER (WHERE type = 'expense' AND status = 'completed')

-- Budget usage in the current period
period_start = date_trunc('week' | 'month' | 'year', now())      -- DB time zone, ISO weeks
spent        = SUM(t.amount) WHERE t.account_id = b.account_id
                                AND t.category_id = b.category_id
                                AND t.type = 'expense' AND t.status = 'completed'
                                AND t.occurred_at >= period_start
                                AND t.occurred_at <  period_start + interval '1 <unit>'
```

Storing either value would mean keeping a cached copy correct across every create, edit and delete. Deriving them keeps one source of truth, and the existing indexes keep the queries cheap at this scale.

---

## Integrity rules at a glance

| Rule | Enforced by |
|------|-------------|
| A transaction or budget can't point at another user's wallet or category | Composite FKs `(account_id, user_id)` and `(category_id, user_id)` |
| Wallets and categories in use can't be deleted | `ON DELETE RESTRICT` |
| Amounts are positive | CHECK `amount > 0` (transactions, budgets) |
| Enum-like columns hold valid values | CHECKs on `transactions.type`, `transactions.status`, `budgets.period` |
| One default wallet per user | Partial unique index |
| One budget per wallet + category + period | `UQ_budgets_scope` |
| A create retried with the same key never inserts twice | Partial unique `(user_id, idempotency_key)` |
| Transaction references are unique | `UQ_transactions_reference` |
| A domain event exists only if its write committed | Outbox row inserted in the same transaction |
| A redelivered event creates one notification | Partial unique `notifications.event_id` |
| Category name is unique per user | `UQ_categories_user_name` |
| Money precision | `numeric(19,4)`; the API rejects input with more decimals than the wallet's currency |

### Known gaps

- **No FK from `user_id` to `users(id)`** on `accounts`, `categories`, `auth_sessions`, `notifications`, `activity_logs` (or on `transactions` / `budgets`, which inherit ownership through the composite FKs). The application always scopes by the JWT user, so this hasn't caused bugs. A v3 migration should still add `FK … REFERENCES users(id)`, with `ON DELETE CASCADE` for sessions and notifications and `RESTRICT` for financial rows. `activity_logs` should stay without an FK, since it is an audit trail and must outlive deletes.
- **`categories.kind` has no CHECK**. Only the application validates it.

---

## Redis keyspace

Postgres holds everything durable. Redis holds short-lived or coordination state, plus the event queue.

| Key | Type / TTL | Purpose |
|-----|-----------|---------|
| `otp:{purpose}:{email}` | string, `EMAIL_OTP_TTL_SECONDS` | Hashed OTP (`email_verify`, `password_reset`, `password_change`) |
| `otp-meta:{purpose}:{email}` | hash, same TTL | `attempts` (max 5) and the `otpToken` hash that ties a reset to the client that requested it |
| `refresh:lock:{tokenHash}` | `SET NX PX 5000` | One rotation per refresh token at a time |
| `refresh:result:{tokenHash}` | string, 30 s | Replays the rotated pair to concurrent / late callers that used the same token |
| throttler keys | counters, 60 s | `@nestjs/throttler` (global, strict auth 5/min, refresh 30/min) |
| `bull:domain-events:*` | BullMQ | Waiting, delayed (backoff), completed (24 h) and failed (7 days) event jobs. Job id `{eventId}.{handler}` |

---

## Flows

### 1. Create a transaction (idempotency + soft duplicate check)

```mermaid
sequenceDiagram
  actor U as User
  participant FE as Web app
  participant API as API
  participant DB as Postgres
  participant Q as Redis queue

  U->>FE: Submit expense
  FE->>FE: key = same UUID for the same form payload
  FE->>API: POST /transactions + Idempotency-Key
  API->>DB: SELECT by (user_id, idempotency_key)
  alt key already used
    alt same payload
      API-->>FE: 201 original transaction (Idempotent-Replayed: true)
    else different payload
      API-->>FE: 422 key reused for different data
    end
  else new key
    API->>DB: Look-alike created < 2 min ago? (wallet, type, category, amount, counterparty)
    alt look-alike and no confirmDuplicate
      API-->>FE: 409 POSSIBLE_DUPLICATE + details.duplicateOf
      FE->>U: "Looks like TXN-… — save anyway?"
      U->>FE: Save anyway
      FE->>API: POST again: same key, confirmDuplicate: true
    end
    API->>DB: One DB transaction: INSERT transaction (unique user_id + key) + outbox row
    alt concurrent request with the same key won
      DB-->>API: unique violation
      API->>DB: SELECT winner
      API-->>FE: 201 winner (Idempotent-Replayed: true)
    else inserted
      API-->>FE: 201 transaction
      Note over DB,Q: OutboxRelay (within ~1 s): pending row → 1 job per handler
    end
  end
```

### 2. Domain events: outbox → BullMQ

```mermaid
flowchart TD
  UC[Use case: write + emit<br/>in one DB transaction] -->|INSERT outbox_events| OB[(Postgres: outbox_events<br/>published_at NULL)]
  OB -->|"every 1 s: FOR UPDATE SKIP LOCKED"| REL[OutboxRelay]
  REL -->|handlersFor event| REG[(Handler registry<br/>found at boot via DiscoveryService)]
  REL -->|"addBulk, jobId = eventId.handler<br/>then set published_at"| Q[(Redis: domain-events queue)]
  Q --> J1[job: budgets<br/>TransactionEventsListener.onCreated]
  Q --> J2[job: notifications<br/>DomainEventsListener.onTransactionCreated]
  J1 --> RUN{handler throws?}
  J2 --> RUN
  RUN -- no --> DONE[completed, kept 24 h]
  RUN -- yes, attempts < 5 --> RETRY[delayed: 2s → 4s → 8s → 16s] --> RUN
  RUN -- yes, 5th attempt --> FAIL[failed set, kept 7 days<br/>error log → Sentry]
```

- Each handler is its own job, so a failing notification never re-runs the budget check for the same event.
- **No lost events:** the outbox row commits with the write. If the API dies or Redis is down before relaying, the row stays pending and is relayed on the next pass or after a restart. If the API stops mid-retry, the jobs are still in Redis and the next instance continues them. (Both verified with the API killed: each notification was delivered exactly once.)
- **No duplicates:** a row relayed twice yields the same job ids, which BullMQ ignores. A job that runs twice (a BullMQ retry or stalled-job recovery) is absorbed by the handlers: notifications are unique per `event_id`, budget alerts use a dedupe key, and default wallets and categories only insert what's missing.
- Handlers rethrow so that retries happen.
- **Delivery latency:** up to ~1 s (the relay poll interval).

| Event | Emitted by | Handlers |
|-------|-----------|----------|
| `user.activated` | verify email | `DefaultAccountsListener.handle`, `DefaultCategoriesListener.handle` |
| `account.created` / `account.updated` | accounts | notifications |
| `transaction.created` / `.updated` / `.deleted` | transactions | budgets (threshold check), notifications |
| `budget.threshold_reached` | budgets | notifications (in-app + email) |

### 3. Budget alert

```mermaid
sequenceDiagram
  participant W as Worker
  participant B as Budgets handler
  participant DB as Postgres
  participant N as Notifications handler
  participant M as SMTP

  W->>B: transaction.created (snapshot)
  B->>DB: Budgets for (wallet, category) + usage in current period
  B->>B: usage before vs after this change crosses 80% or 100%?
  alt crossed
    B->>W: emit budget.threshold_reached (new job)
    W->>N: budget.threshold_reached
    N->>DB: INSERT notification
    N->>M: Email (best effort)
  else not crossed
    B-->>W: done (no alert on every later expense)
  end
```

Alerts fire when a change *crosses* a threshold (the delta between before and after), so edits and deletes are handled too. Over-budget expenses are never blocked: the transaction already happened.

### 4. Refresh token rotation (concurrent calls)

```mermaid
sequenceDiagram
  participant T1 as Tab 1
  participant T2 as Tab 2
  participant API as API
  participant R as Redis
  participant DB as Postgres

  par same refresh token
    T1->>API: POST /auth/refresh
    T2->>API: POST /auth/refresh
  end
  API->>R: SET refresh:lock:{hash} NX PX 5000 (T1 wins)
  API->>DB: Rotate session hash
  API->>R: SET refresh:result:{hash} (30 s)
  API-->>T1: new pair
  API->>R: T2 lock denied → poll refresh:result
  API-->>T2: same new pair (no second rotation, no false "reuse")
```

### 5. Forgot password (OTP bound to the requesting client)

```mermaid
sequenceDiagram
  actor U as User
  participant FE as Web app
  participant API as API
  participant R as Redis
  participant M as SMTP

  U->>FE: Forgot password (email)
  FE->>API: POST /auth/forgot-password
  API->>R: SET otp:password_reset:{email} (hashed) + otp-meta (otpToken hash)
  API->>M: Email OTP (only if the user exists)
  API-->>FE: otpToken (returned even for unknown emails)
  FE->>FE: Keep otpToken in sessionStorage
  U->>FE: Enter OTP + new password
  FE->>API: POST /auth/reset-password (email, otp, otpToken, password)
  API->>R: Check otpToken hash, attempts < 5, OTP (timing-safe)
  API-->>FE: 200, password updated, all sessions revoked
```

---

## Request tracing

Every request carries `X-Request-Id`. The client sends one, or the API generates one. That id appears in the pino logs, in error bodies (`requestId`), in `activity_logs.metadata.requestId` and as a Sentry tag.
