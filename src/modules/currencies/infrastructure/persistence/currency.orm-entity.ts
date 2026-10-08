import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'currencies' })
export class CurrencyOrmEntity {
  @PrimaryColumn({ type: 'char', length: 3 })
  code!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ type: 'varchar', length: 16 })
  symbol!: string;

  @Column({ name: 'decimal_places', type: 'smallint' })
  decimalPlaces!: number;
}
