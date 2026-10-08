import {
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
import { CurrencyOrmEntity } from '@/modules/currencies/infrastructure/persistence/currency.orm-entity';

@Entity({ name: 'accounts' })
@Index('UQ_accounts_user_default', ['userId'], {
  unique: true,
  where: 'is_default = true',
})
// Target of the composite FK transactions(account_id, user_id) — guarantees a
// transaction's user_id always matches its wallet owner.
@Unique('UQ_accounts_id_user', ['id', 'userId'])
export class AccountOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ name: 'currency_code', type: 'char', length: 3 })
  currencyCode!: string;

  @ManyToOne(() => CurrencyOrmEntity, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'currency_code', referencedColumnName: 'code' })
  currency?: CurrencyOrmEntity;

  /** Balance before the first recorded transaction. May be negative (credit cards). */
  @Column({
    name: 'opening_balance',
    type: 'numeric',
    precision: 19,
    scale: 4,
    default: 0,
  })
  openingBalance!: string;

  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault!: boolean;

  @Column({ name: 'archived_at', type: 'timestamptz', nullable: true })
  archivedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
