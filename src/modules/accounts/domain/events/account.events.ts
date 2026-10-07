export const ACCOUNT_CREATED_EVENT = 'account.created';
export const ACCOUNT_UPDATED_EVENT = 'account.updated';

export type AccountCreatedPayload = {
  accountId: string;
  userId: string;
  name: string;
  currencyCode: string;
  openingBalance: string;
};

/** Only the fields that actually changed are present in `changes`. */
export type AccountUpdatedPayload = {
  accountId: string;
  userId: string;
  name: string;
  currencyCode: string;
  changes: {
    name?: { from: string; to: string };
    isDefault?: boolean;
    archived?: boolean;
    openingBalance?: { from: string; to: string };
  };
};
