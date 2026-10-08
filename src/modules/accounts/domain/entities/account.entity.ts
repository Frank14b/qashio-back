export type AccountProps = {
  id: string;
  userId: string;
  name: string;
  currencyCode: string;
  /** Decimal string, e.g. `"1500.0000"` */
  openingBalance: string;
  isDefault: boolean;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export class Account {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  readonly currencyCode: string;
  readonly openingBalance: string;
  readonly isDefault: boolean;
  readonly archivedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: AccountProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.name = props.name;
    this.currencyCode = props.currencyCode;
    this.openingBalance = props.openingBalance;
    this.isDefault = props.isDefault;
    this.archivedAt = props.archivedAt;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  get isArchived(): boolean {
    return this.archivedAt != null;
  }
}
