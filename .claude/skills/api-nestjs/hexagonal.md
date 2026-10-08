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

- Emit from **application** after a successful write (e.g. `transaction.created`) through `DOMAIN_EVENT_PUBLISHER` — never inject `Queue`/`EventEmitter2` into use cases.
- The publisher (`src/shared/events`) enqueues **one BullMQ job per handler** on the `domain-events` queue: 5 attempts, exponential backoff, failed jobs kept 7 days. Jobs live in Redis, so they survive an API restart.
- Handlers are provider methods decorated with `@OnDomainEvent(EVENT)` (in `application/listeners`, registered in the module). Handler id = `ClassName.method`, so listener class names must be unique across modules.
- Handlers must **throw on failure** (no try/catch-and-log: that silently disables retries) and be **safe to run twice** (a retry can follow a partial success).
- Payloads must be JSON-safe: ISO strings for dates, decimal strings for money.

## Testing preference

- Unit-test application use cases with mocked ports.
- Controller tests (if any) mock application services only.
- Prefer **new** `*.spec.ts` for new behavior; do not rewrite existing unit tests to greenlight new or buggy code (see Hard rules in [SKILL.md](SKILL.md)).
