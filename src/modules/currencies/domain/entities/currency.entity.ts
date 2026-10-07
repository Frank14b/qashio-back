export type CurrencyProps = {
  code: string;
  name: string;
  symbol: string;
  decimalPlaces: number;
};

export class Currency {
  readonly code: string;
  readonly name: string;
  readonly symbol: string;
  readonly decimalPlaces: number;

  constructor(props: CurrencyProps) {
    this.code = props.code;
    this.name = props.name;
    this.symbol = props.symbol;
    this.decimalPlaces = props.decimalPlaces;
  }
}
