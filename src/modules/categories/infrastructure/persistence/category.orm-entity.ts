import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  Unique,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'categories' })
@Index('UQ_categories_user_name', ['userId', 'name'], { unique: true })
// Target of the composite FK transactions(category_id, user_id).
@Unique('UQ_categories_id_user', ['id', 'userId'])
export class CategoryOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ type: 'varchar', length: 20 })
  kind!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
