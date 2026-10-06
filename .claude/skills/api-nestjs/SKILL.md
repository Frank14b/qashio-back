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
- **Do not add Kafka** unless the user explicitly asks. Prefer Nest `EventEmitter` and Redis/Bull for async work.
- **Do not modify existing unit tests** (`*.spec.ts`) to make them pass when implementing features or refactors. Prefer writing **new** tests for new behavior. Only change an existing test when the user explicitly asks, or when the public contract intentionally changes and the user approved updating that contract — never silently rewrite assertions to match buggy or new behavior. Changing old tests can hide regressions / silent breaking changes.
- Prefer official NestJS patterns (modules, DI, DTOs, pipes, filters) over inventing frameworks.

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

On transaction create/update: emit a domain/application event; a listener may log activity and check budget usage (EventEmitter first).

## Checklist for new endpoints

1. DTO + validation in `presentation/http/dto`
2. Use case in `application/` depending only on domain ports
3. Port in `domain/ports` + adapter in `infrastructure/`
4. Controller thin; Swagger annotations
5. Register module exports/imports in `app.module.ts` as needed
6. No ESLint runs; style matches Prettier config
