# Hexagonal mapping for Qashio Nest modules

## Responsibilities

| Layer | Owns | Must not |
|-------|------|----------|
| `domain` | Entities, value objects, port interfaces, domain errors | Import `@nestjs/*`, TypeORM, Redis, Axios |
| `application` | Use cases, orchestration, transaction boundaries (app-level) | Talk to HTTP or ORM APIs directly |
| `infrastructure` | TypeORM repos, Redis cache, Bull producers, external APIs | Contain business rules |
| `presentation` | Controllers, HTTP DTOs, status codes, Swagger | Contain business rules or SQL |

## Port example

```ts
// domain/ports/transaction.repository.port.ts
export const TRANSACTION_REPOSITORY = Symbol('TRANSACTION_REPOSITORY');

export interface TransactionRepositoryPort {
  save(input: NewTransaction): Promise<Transaction>;
  findById(id: string): Promise<Transaction | null>;
  findMany(query: ListTransactionsQuery): Promise<Paged<Transaction>>;
}
```

```ts
// infrastructure/persistence/typeorm-transaction.repository.ts
@Injectable()
export class TypeOrmTransactionRepository implements TransactionRepositoryPort {
  constructor(@InjectRepository(TransactionOrmEntity) private readonly repo: Repository<...>) {}
  // implement port methods — map ORM <-> domain
}
```

```ts
// <feature>.module.ts
{
  provide: TRANSACTION_REPOSITORY,
  useClass: TypeOrmTransactionRepository,
}
```

```ts
// application/create-transaction.use-case.ts
@Injectable()
export class CreateTransactionUseCase {
  constructor(
    @Inject(TRANSACTION_REPOSITORY)
    private readonly transactions: TransactionRepositoryPort,
    @Inject(DOMAIN_EVENT_PUBLISHER)
    private readonly events: DomainEventPublisherPort,
  ) {}
}
```

Name application classes `*UseCase` (`*.use-case.ts`). Keep `*Service` for infrastructure adapters (JWT, hasher, external APIs).

## Events

- Emit from **application** through `DOMAIN_EVENT_PUBLISHER` — never inject `Queue`/`EventEmitter2` into use cases.
- **Transactional outbox:** `await this.events.emit(...)` inside the same `this.unitOfWork.run(...)` (`UNIT_OF_WORK` port) as the write it describes. `emit` only inserts an `outbox_events` row, so the event commits or rolls back with the write. Never emit outside the unit of work of a write, and never call Redis/BullMQ directly for events.
- Repositories that take part in a unit of work read their TypeORM repository from the transaction host (`@InjectTransactionHost()` + `this.txHost.tx.getRepository(Entity)`), not `@InjectRepository`.
- A failed statement aborts its Postgres transaction: retry loops (e.g. on a unique-violation collision) must wrap the whole `unitOfWork.run`, not run inside it.
- `OutboxRelay` moves committed rows to the `domain-events` BullMQ queue, **one job per handler** (job id `{eventId}.{handler}`, so re-relaying is a no-op): 5 attempts, exponential backoff, failed jobs kept 7 days.
- Unit tests pass `inlineUnitOfWork` (`src/test-utils/unit-of-work.ts`) for the `UNIT_OF_WORK` constructor argument.
- Handlers are provider methods decorated with `@OnDomainEvent(EVENT)` (in `application/listeners`, registered in the module). Handler id = `ClassName.method`, so listener class names must be unique across modules.
- Handlers must **throw on failure** (no try/catch-and-log: that silently disables retries) and be **safe to run twice** (a retry can follow a partial success). Use the second argument, `context.eventId`, to deduplicate side effects (e.g. unique `notifications.event_id`, or `emit(..., { dedupeKey })` for events a handler raises).
- Payloads must be JSON-safe: ISO strings for dates, decimal strings for money.

## Testing preference

- Unit-test application use cases with mocked ports.
- Controller tests (if any) mock application services only.
- Prefer **new** `*.spec.ts` for new behavior; do not rewrite existing unit tests to greenlight new or buggy code (see Hard rules in [SKILL.md](SKILL.md)).
