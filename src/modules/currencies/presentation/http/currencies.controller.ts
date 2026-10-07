import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ListCurrenciesUseCase } from '../../application/list-currencies.use-case';
import { Currency } from '../../domain/entities/currency.entity';
import { CurrencyResponseDto } from './dto/currency-response.dto';

@ApiTags('currencies')
@Controller('currencies')
export class CurrenciesController {
  constructor(private readonly listCurrencies: ListCurrenciesUseCase) {}

  @Get()
  @ApiOperation({ summary: 'List seeded currencies (ISO 4217 subset)' })
  @ApiOkResponse({ type: CurrencyResponseDto, isArray: true })
  async list(): Promise<CurrencyResponseDto[]> {
    const currencies = await this.listCurrencies.execute();
    return currencies.map((c) => this.toResponse(c));
  }

  private toResponse(currency: Currency): CurrencyResponseDto {
    return {
      code: currency.code,
      name: currency.name,
      symbol: currency.symbol,
      decimalPlaces: currency.decimalPlaces,
    };
  }
}
