import { ApiProperty } from '@nestjs/swagger';
import type { ErrorResponseBody } from './http-exception.filter';

/** OpenAPI shape matching {@link ErrorResponseBody} from HttpExceptionFilter. */
export class ErrorResponseDto implements ErrorResponseBody {
  @ApiProperty({ example: 401 })
  statusCode!: number;

  @ApiProperty({ example: 'Unauthorized' })
  error!: string;

  @ApiProperty({
    description: 'Human-readable message, or validation error list',
    oneOf: [
      { type: 'string', example: 'Invalid credentials' },
      {
        type: 'array',
        items: { type: 'string' },
        example: ['email must be an email'],
      },
    ],
  })
  message!: string | string[];

  @ApiProperty({ example: '/auth/login' })
  path!: string;

  @ApiProperty({ example: '2026-10-06T12:00:00.000Z' })
  timestamp!: string;
}
