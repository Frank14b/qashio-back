import { PartialType } from '@nestjs/swagger';
import { RequireAtLeastOne } from '@/shared/validation/require-at-least-one.decorator';
import { CreateTransactionRequestDto } from './create-transaction-request.dto';

/** Every field optional (at least one required); send `null` for counterparty/narration to clear them. */
@RequireAtLeastOne([
  'accountId',
  'categoryId',
  'type',
  'amount',
  'counterparty',
  'narration',
  'occurredAt',
])
export class UpdateTransactionRequestDto extends PartialType(CreateTransactionRequestDto) {}
