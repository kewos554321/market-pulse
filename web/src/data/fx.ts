export interface FxPair {
  symbol: string;
  name: string;
}

const CURRENCIES: { code: string; name: string }[] = [
  { code: 'USD', name: 'US Dollar' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'British Pound' },
  { code: 'TWD', name: 'New Taiwan Dollar' },
  { code: 'JPY', name: 'Japanese Yen' },
  { code: 'AUD', name: 'Australian Dollar' },
  { code: 'CHF', name: 'Swiss Franc' },
];

export const FX_PAIRS: FxPair[] = CURRENCIES.flatMap((base) =>
  CURRENCIES
    .filter((quote) => quote.code !== base.code)
    .map((quote) => ({
      symbol: `${base.code}/${quote.code}`,
      name: `${base.name} / ${quote.name}`,
    }))
);
