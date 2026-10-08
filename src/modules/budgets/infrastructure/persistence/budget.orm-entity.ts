import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AccountOrmEntity } from '@/modules/accounts/infrastructure/persistence/account.orm-entity';
import { CategoryOrmEntity } from '@/modules/categories/infrastructure/persistence/category.orm-entity';

@Entity({ name: 'budgets' })
// One budget per category, wallet and period.
@Index('UQ_budgets_scope', ['userId', 'categoryId', 'accountId', 'period'], { unique: true })
@Check('CHK_budgets_amount_positive', `"amount" > 0`)
@Check('CHK_budgets_period', `"period" IN ('weekly', 'monthly', 'yearly')`)
export class BudgetOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'category_id', type: 'uuid' })
  categoryId!: string;

  @Column({ name: 'account_id', type: 'uuid' })
  accountId!: string;

  // Same ownership guarantee as transactions: category/wallet must belong to user_id.
  @ManyToOne(() => CategoryOrmEntity, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn([
    {
      name: 'category_id',
      referencedColumnName: 'id',
      foreignKeyConstraintName: 'FK_budgets_category_user',
    },
    { name: 'user_id', referencedColumnName: 'userId' },
  ])
  category?: CategoryOrmEntity;

  @ManyToOne(() => AccountOrmEntity, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn([
    {
      name: 'account_id',
      referencedColumnName: 'id',
      foreignKeyConstraintName: 'FK_budgets_account_user',
    },
    { name: 'user_id', referencedColumnName: 'userId' },
  ])
  account?: AccountOrmEntity;

  @Column({ type: 'numeric', precision: 19, scale: 4 })
  amount!: string;

  @Column({ type: 'varchar', length: 10 })
  period!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
