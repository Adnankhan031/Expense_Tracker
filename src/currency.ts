export type Grouping = 'indian' | 'international';

export type Currency = {
  code: string;
  symbol: string;
  name: string;
  /** Decimal places shown. Yen and won have none. */
  digits: 0 | 2;
  grouping: Grouping;
};

/**
 * Amounts are always stored as major x 100, whatever the currency. A
 * zero-decimal currency like JPY simply never renders the fractional part, so
 * switching currency later never rescales the stored numbers.
 */
export const CURRENCIES: Currency[] = [
  { code: 'JPY', symbol: '¥', name: 'Japanese yen', digits: 0, grouping: 'international' },
  { code: 'CNY', symbol: '¥', name: 'Chinese yuan', digits: 2, grouping: 'international' },
  { code: 'INR', symbol: '₹', name: 'Indian rupee', digits: 2, grouping: 'indian' },
  { code: 'USD', symbol: '$', name: 'US dollar', digits: 2, grouping: 'international' },
  { code: 'EUR', symbol: '€', name: 'Euro', digits: 2, grouping: 'international' },
  { code: 'GBP', symbol: '£', name: 'British pound', digits: 2, grouping: 'international' },
  { code: 'KRW', symbol: '₩', name: 'Korean won', digits: 0, grouping: 'international' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore dollar', digits: 2, grouping: 'international' },
  { code: 'AED', symbol: 'AED ', name: 'UAE dirham', digits: 2, grouping: 'international' },
  { code: 'AUD', symbol: 'A$', name: 'Australian dollar', digits: 2, grouping: 'international' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian dollar', digits: 2, grouping: 'international' },
  { code: 'CHF', symbol: 'CHF ', name: 'Swiss franc', digits: 2, grouping: 'international' },
];

export const DEFAULT_CURRENCY = 'JPY';

export function currencyByCode(code: string): Currency {
  return CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[0];
}
