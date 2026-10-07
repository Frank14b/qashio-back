import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { AccountOrmEntity } from '@/modules/accounts/infrastructure/persistence/account.orm-entity';
import { CategoryOrmEntity } from '@/modules/categories/infrastructure/persistence/category.orm-entity';

@Entity({ name: 'transactions' })
@Unique('UQ_transactions_reference', ['reference'])
@Check('CHK_transactions_amount_positive', `"amount" > 0`)
@Check('CHK_transactions_type', `"type" IN ('income', 'expense')`)
@Check('CHK_transactions_status', `"status" IN ('pending', 'completed', 'failed')`)
@Index('IDX_transactions_user_occurred_at', ['userId', 'occurredAt'])
@Index('IDX_transactions_account_occurred_at', ['accountId', 'occurredAt'])
@Index('IDX_transactions_user_category_occurred_at', ['userId', 'categoryId', 'occurredAt'])
export class TransactionOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 32 })
  reference!: string;

  /** Denormalized owner; FK-bound to both the wallet owner and the category owner. */
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'account_id', type: 'uuid' })
  accountId!: string;

  @Column({ name: 'category_id', type: 'uuid' })
  categoryId!: string;

  // Composite FK (account_id, user_id) → accounts(id, user_id): the DB rejects a
  // transaction whose user_id is not the wallet owner.
  @ManyToOne(() => AccountOrmEntity, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn([
    {
      name: 'account_id',
      referencedColumnName: 'id',
      foreignKeyConstraintName: 'FK_transactions_account_user',
    },
    { name: 'user_id', referencedColumnName: 'userId' },
  ])
  account?: AccountOrmEntity;

  @ManyToOne(() => CategoryOrmEntity, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn([
    {
      name: 'category_id',
      referencedColumnName: 'id',
      foreignKeyConstraintName: 'FK_transactions_category_user',
    },
    { name: 'user_id', referencedColumnName: 'userId' },
  ])
  category?: CategoryOrmEntity;

  /** `income` = inflow (+), `expense` = outflow (−). */
  @Column({ type: 'varchar', length: 10 })
  type!: string;

  /** Always > 0; the sign is derived from `type`. */
  @Column({ type: 'numeric', precision: 19, scale: 4 })
  amount!: string;

  @Column({ type: 'varchar', length: 12, default: 'completed' })
  status!: string;

  @Column({ type: 'varchar', length: 160, nullable: true })
  counterparty!: string | null;

  @Column({ type: 'text', nullable: true })
  narration!: string | null;

  @Column({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
