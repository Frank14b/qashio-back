import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { Injectable } from '@nestjs/common';
import { UnitOfWorkPort } from './unit-of-work.port';

/**
 * Repositories read `txHost.tx` (an EntityManager): the active transaction's
 * manager inside `UnitOfWork.run`, the default one everywhere else.
 */
export type TypeOrmTransactionHost = TransactionHost<TransactionalAdapterTypeOrm>;

@Injectable()
export class ClsUnitOfWork implements UnitOfWorkPort {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>) {}

  run<T>(work: () => Promise<T>): Promise<T> {
    return this.txHost.withTransaction(work);
  }
}
