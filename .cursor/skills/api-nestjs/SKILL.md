---
name: api-nestjs
description: >-
  NestJS hexagonal architecture, module conventions, Prettier style, and agent
  workflow for qashio-api. Use when editing or generating code under qashio-api,
  adding Nest modules/controllers/DTOs/services, TypeORM entities, Redis/queues,
  domain events, Swagger, or when the user mentions hexagonal architecture,
  ports/adapters, transactions, categories, or budgets API work.
---

# Qashio API — NestJS + Hexagonal

## Hard rules (token / workflow)

- **Do not run linting.** Never run `eslint`, `npm run lint`, or lint-fix loops. Pre-commit handles ESLint.
- **Do not run Prettier CLI** unless the user explicitly asks. Write code that already matches `.prettierrc`.
- **Do not add Kafka** unless the user explicitly asks. Domain events go through the BullMQ `domain-events` queue (Redis) — see **Events** in `hexagonal.md`.
- **Do not modify existing unit tests** (`*.spec.ts`) to make them pass when implementing features or refactors. Prefer writing **new** tests for new behavior. Only change an existing test when the user explicitly asks, or when the public contract intentionally changes and the user approved updating that contract — never silently rewrite assertions to match buggy or new behavior. Changing old tests can hide regressions / silent breaking changes.
- **Test only critical features.** Write unit tests where a bug would corrupt data, leak data or lose money: money / decimal math and currency scale, balances and totals, authN/authZ and ownership checks, sessions / OTP, domain rules that guard integrity (category kind vs type, archived wallets, budget thresholds), event payloads other modules depend on, and non-trivial cross-field validators. Do **not** write tests for thin controllers, DTO ↔ response mapping, simple CRUD pass-throughs, module wiring, Swagger, or operational endpoints (e.g. health) — verify those by running the app. One focused spec per critical behavior beats many shallow ones.
- Prefer official NestJS patterns (modules, DI, DTOs, pipes, filters) over inventing frameworks.
- **Check before writing a util.** Before creating any helper/utility (formatting, parsing, validation, money/decimal math, dates, ids, crypto, retries…), first check for (1) a built-in Node.js / Web API (`crypto.randomInt`, `crypto.randomUUID`, `Intl.NumberFormat`, `structuredClone`, `node:util`…), (2) something the framework/deps already ship (class-validator, class-transformer, NestJS pipes, TypeORM, Zod, MUI, date libs), then (3) a well-maintained npm package (e.g. `decimal.js` for money). Only hand-roll it when none fits, and say why in a short comment.
- **Git push branches.** Each push must be on a **feature branch** (`feature/...`) or, for bugs, a **bugfix branch** (`fix/...` or `bugfix/...`). Never push commits directly to `main` / `master` unless the user explicitly requests it. If work is on `main`, create/checkout the appropriate branch before committing and pushing.

## Prettier (match `.prettierrc`)

- `singleQuote: true`
- `trailingComma: "all"`
- Keep diffs style-consistent with neighboring files.

## NestJS conventions

- One Nest `@Module` per domain feature under `src/modules/<feature>/`.
- Controllers stay thin: validate input (DTOs), call application use cases, map HTTP responses.
- Use `class-validator` / `class-transformer` DTOs + global `ValidationPipe`.
- Register providers via Nest DI; depend on **ports (interfaces)**, not concrete infra in application code.
- Document new/changed HTTP endpoints with Swagger decorators when touching controllers.
- Shared cross-cutting code goes in `src/shared/` (filters, pipes, guards, utils) — keep it lean.
- When unsure, follow [NestJS docs](https://docs.nestjs.com) (modules, providers, pipes, exception filters, OpenAPI).

## Validation placement (required)

Split every check by **what it needs to decide**:

| Check | Lives in | Examples |
|-------|----------|----------|
| **Input shape** — decidable from the request alone | Request DTO (`presentation/http/dto`) | required / blank (`@Trim()` + `@IsNotEmpty()`), format, enums, ranges, cross-field rules (`@IsNotBefore('from')`, `@IsExclusiveWith('archive')`), "at least one field" on PATCH/PUT (`@RequireAtLeastOne([...])`) |
| **Business / state rules** — need data or domain state | Use case (`application/`) | not found / not owned, duplicates, archived wallet, category kind vs type, currency scale (needs the currency row), OTP/credentials |

- Never re-check input shape with `throw new BadRequestException(...)` in a use case; the global `ValidationPipe` returns it as a standard 400 and Swagger documents it.
- Use cases may still **canonicalize** values they depend on (`trim()`, currency `toUpperCase()`, email `toLowerCase()`): that is normalization for lookups, not validation.
- Reusable validators live in `src/shared/validation/` (`IsNotBefore`, `IsExclusiveWith`, `RequireAtLeastOne`, `Trim`) and money in `src/shared/money/` (`IsDecimalString`). Reuse them before writing a new one; when nothing fits, build on class-validator's `ValidateBy` / `registerDecorator`.
- Shared query fields go in a base DTO that others extend (e.g. `TransactionSummaryQueryDto` → `ListTransactionsQueryDto`) so a rule is declared once.
- Test DTO rules with `plainToInstance` + `validateSync` (see `src/shared/validation/request-dto-validation.spec.ts`), not through the use case.

## Hexagonal folder map (required layout)

For each feature module:

```text
src/modules/<feature>/
  <feature>.module.ts
  domain/                    # core — no Nest/TypeORM imports
    entities/                # domain entities / value objects
    ports/                   # interfaces (repository, cache, queue, clock…)
  application/               # use cases (orchestration only)
    <use-case>.use-case.ts   # class name: CreateTransactionUseCase
    dto/                     # application-level command/query shapes if needed
  infrastructure/            # adapters
    persistence/             # TypeORM entities, repositories implementing ports
    cache/                   # Redis adapters (optional)
    messaging/               # queue / event publishers (optional)
  presentation/              # driving adapters
    http/
      <feature>.controller.ts
      dto/                   # request/response DTOs for HTTP
```

**Dependency direction:** `presentation` → `application` → `domain` ← `infrastructure`.  
Infrastructure and presentation depend inward; domain never imports Nest, TypeORM, or Redis.

Wire Nest providers in `<feature>.module.ts`: bind port tokens to infrastructure implementations.

For a worked example of ports/adapters in this layout, see [hexagonal.md](hexagonal.md).

## Domain focus (assignment)

Prefer features aligned with the product README:

- **transactions** — CRUD; `amount`, `category`, `date`, `type` (`income` | `expense`)
- **categories** — create + list; required by transactions
- **budgets** — per category / period; spending vs limit

On transaction create/update: emit a domain/application event; `@OnDomainEvent` handlers (budgets, notifications) run as queued jobs with retries.

## Checklist for new endpoints

1. DTO + **all input-shape validation** in `presentation/http/dto` (see Validation placement)
2. Use case in `application/` depending only on domain ports; only business/state checks there
3. Port in `domain/ports` + adapter in `infrastructure/`
4. Controller thin; Swagger annotations
5. Register module exports/imports in `app.module.ts` as needed
6. No ESLint runs; style matches Prettier config
