import { NotificationType } from '../notification-type';

/** Ids the client uses to link a notification to its resource. */
export type NotificationData = {
  transactionId?: string;
  budgetId?: string;
  accountId?: string;
};

export type NotificationProps = {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data: NotificationData;
  readAt: Date | null;
  createdAt: Date;
};

export class Notification {
  readonly id: string;
  readonly userId: string;
  readonly type: NotificationType;
  readonly title: string;
  readonly message: string;
  readonly data: NotificationData;
  readonly readAt: Date | null;
  readonly createdAt: Date;

  constructor(props: NotificationProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.type = props.type;
    this.title = props.title;
    this.message = props.message;
    this.data = props.data;
    this.readAt = props.readAt;
    this.createdAt = props.createdAt;
  }
}
