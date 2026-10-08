import { CategoryKind } from '../category-kind';

export type CategoryProps = {
  id: string;
  userId: string;
  name: string;
  kind: CategoryKind;
  createdAt: Date;
  updatedAt: Date;
};

export class Category {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  readonly kind: CategoryKind;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: CategoryProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.name = props.name;
    this.kind = props.kind;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }
}
