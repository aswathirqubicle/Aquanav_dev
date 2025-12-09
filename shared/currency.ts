// Multi-currency support for the Aquanav ERP system
// Default currency: AED (UAE Dirham)

export interface Currency {
  code: string;
  name: string;
  symbol: string;
  decimals: number;
  rateToAED: number; // Exchange rate relative to AED
}

export const CURRENCIES: Record<string, Currency> = {
  AED: {
    code: 'AED',
    name: 'UAE Dirham',
    symbol: 'د.إ',
    decimals: 2,
    rateToAED: 1.0, // Base currency
  },
  USD: {
    code: 'USD',
    name: 'US Dollar',
    symbol: '$',
    decimals: 2,
    rateToAED: 3.67, // 1 USD = 3.67 AED
  },
  EUR: {
    code: 'EUR',
    name: 'Euro',
    symbol: '€',
    decimals: 2,
    rateToAED: 4.01, // 1 EUR = 4.01 AED
  },
  GBP: {
    code: 'GBP',
    name: 'British Pound',
    symbol: '£',
    decimals: 2,
    rateToAED: 4.65, // 1 GBP = 4.65 AED
  },
  SAR: {
    code: 'SAR',
    name: 'Saudi Riyal',
    symbol: 'ر.س',
    decimals: 2,
    rateToAED: 0.98, // 1 SAR = 0.98 AED
  },
  KWD: {
    code: 'KWD',
    name: 'Kuwaiti Dinar',
    symbol: 'د.ك',
    decimals: 3,
    rateToAED: 12.05, // 1 KWD = 12.05 AED
  },
  QAR: {
    code: 'QAR',
    name: 'Qatari Riyal',
    symbol: 'ر.ق',
    decimals: 2,
    rateToAED: 1.01, // 1 QAR = 1.01 AED
  },
  BHD: {
    code: 'BHD',
    name: 'Bahraini Dinar',
    symbol: 'د.ب',
    decimals: 3,
    rateToAED: 9.74, // 1 BHD = 9.74 AED
  },
  OMR: {
    code: 'OMR',
    name: 'Omani Rial',
    symbol: 'ر.ع.',
    decimals: 3,
    rateToAED: 9.54, // 1 OMR = 9.54 AED
  },
  INR: {
    code: 'INR',
    name: 'Indian Rupee',
    symbol: '₹',
    decimals: 2,
    rateToAED: 0.044, // 1 INR = 0.044 AED
  },
  PKR: {
    code: 'PKR',
    name: 'Pakistani Rupee',
    symbol: '₨',
    decimals: 2,
    rateToAED: 0.013, // 1 PKR = 0.013 AED
  },
  BDT: {
    code: 'BDT',
    name: 'Bangladeshi Taka',
    symbol: '৳',
    decimals: 2,
    rateToAED: 0.031, // 1 BDT = 0.031 AED
  },
  LKR: {
    code: 'LKR',
    name: 'Sri Lankan Rupee',
    symbol: 'Rs',
    decimals: 2,
    rateToAED: 0.012, // 1 LKR = 0.012 AED
  },
  PHP: {
    code: 'PHP',
    name: 'Philippine Peso',
    symbol: '₱',
    decimals: 2,
    rateToAED: 0.066, // 1 PHP = 0.066 AED
  },
  JPY: {
    code: 'JPY',
    name: 'Japanese Yen',
    symbol: '¥',
    decimals: 0,
    rateToAED: 0.025, // 1 JPY = 0.025 AED
  },
  CNY: {
    code: 'CNY',
    name: 'Chinese Yuan',
    symbol: '¥',
    decimals: 2,
    rateToAED: 0.51, // 1 CNY = 0.51 AED
  },
};

export const DEFAULT_CURRENCY = 'AED';

export const GCC_CURRENCIES = ['AED', 'SAR', 'KWD', 'QAR', 'BHD', 'OMR'];
export const MAJOR_CURRENCIES = ['AED', 'USD', 'EUR', 'GBP', 'SAR'];

// Currency conversion utilities
export class CurrencyConverter {
  static convertToAED(amount: number, fromCurrency: string): number {
    const currency = CURRENCIES[fromCurrency];
    if (!currency) {
      throw new Error(`Currency ${fromCurrency} not supported`);
    }
    return amount * currency.rateToAED;
  }

  static convertFromAED(amount: number, toCurrency: string): number {
    const currency = CURRENCIES[toCurrency];
    if (!currency) {
      throw new Error(`Currency ${toCurrency} not supported`);
    }
    return amount / currency.rateToAED;
  }

  static convert(amount: number, fromCurrency: string, toCurrency: string): number {
    if (fromCurrency === toCurrency) {
      return amount;
    }
    
    // Convert to AED first, then to target currency
    const aedAmount = this.convertToAED(amount, fromCurrency);
    return this.convertFromAED(aedAmount, toCurrency);
  }

  static formatAmount(amount: number, currency: string): string {
    const currencyInfo = CURRENCIES[currency];
    if (!currencyInfo) {
      return `${amount.toFixed(2)} ${currency}`;
    }

    const formatted = amount.toLocaleString('en-US', {
      minimumFractionDigits: currencyInfo.decimals,
      maximumFractionDigits: currencyInfo.decimals,
    });

    return `${currencyInfo.symbol} ${formatted}`;
  }

  static getDisplayName(currency: string): string {
    const currencyInfo = CURRENCIES[currency];
    return currencyInfo ? `${currencyInfo.code} (${currencyInfo.name})` : currency;
  }

  static isValidCurrency(currency: string): boolean {
    return currency in CURRENCIES;
  }

  static getSupportedCurrencies(): Currency[] {
    return Object.values(CURRENCIES);
  }

  static getGCCCurrencies(): Currency[] {
    return GCC_CURRENCIES.map(code => CURRENCIES[code]);
  }

  static getMajorCurrencies(): Currency[] {
    return MAJOR_CURRENCIES.map(code => CURRENCIES[code]);
  }
}

// Exchange rate management (for future API integration)
export interface ExchangeRateUpdate {
  currency: string;
  rateToAED: number;
  lastUpdated: Date;
  source: string;
}

export class ExchangeRateManager {
  private static rates: Map<string, ExchangeRateUpdate> = new Map();

  static updateRate(currency: string, rateToAED: number, source: string = 'manual'): void {
    this.rates.set(currency, {
      currency,
      rateToAED,
      lastUpdated: new Date(),
      source,
    });
  }

  static getRate(currency: string): number {
    const customRate = this.rates.get(currency);
    if (customRate) {
      return customRate.rateToAED;
    }
    
    const defaultRate = CURRENCIES[currency]?.rateToAED;
    if (!defaultRate) {
      throw new Error(`Currency ${currency} not supported`);
    }
    
    return defaultRate;
  }

  static getLastUpdate(currency: string): Date | null {
    const rate = this.rates.get(currency);
    return rate ? rate.lastUpdated : null;
  }

  static getAllRates(): ExchangeRateUpdate[] {
    return Array.from(this.rates.values());
  }
}

// Currency selection helpers for forms
export const currencySelectOptions = Object.values(CURRENCIES).map(currency => ({
  value: currency.code,
  label: `${currency.code} (${currency.name})`,
  symbol: currency.symbol,
}));

export const gccCurrencyOptions = GCC_CURRENCIES.map(code => ({
  value: code,
  label: `${CURRENCIES[code].code} (${CURRENCIES[code].name})`,
  symbol: CURRENCIES[code].symbol,
}));

export const majorCurrencyOptions = MAJOR_CURRENCIES.map(code => ({
  value: code,
  label: `${CURRENCIES[code].code} (${CURRENCIES[code].name})`,
  symbol: CURRENCIES[code].symbol,
}));