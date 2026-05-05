/** Raw FMP stable batch quote item (fields vary; we read defensively). */
export type FmpBatchQuote = {
  symbol?: string;
  name?: string;
  price?: number;
  pe?: number;
  marketCap?: number;
  yearHigh?: number;
  yearLow?: number;
  changesPercentage?: number;
};

export type FmpProfile = {
  symbol?: string;
  companyName?: string;
  sector?: string;
  industry?: string;
  mktCap?: number;
  price?: number;
  beta?: number;
};

export type FmpKeyMetricsTtm = {
  peRatioTTM?: number;
  enterpriseValueOverEBITDATTM?: number;
  enterpriseValueOverEBITDATtm?: number;
  marketCapTTM?: number;
};

export type FmpRatiosTtm = {
  operatingProfitMarginTTM?: number;
  priceToEarningsRatioTTM?: number;
};

export type FmpStockPriceChange = {
  symbol?: string;
  /** FMP often returns keys like "1D", "5D", "1M", "3M", "6M", "1Y" */
  [key: string]: string | number | undefined;
};

export type FmpFinancialGrowth = {
  revenueGrowth?: number;
  growthRevenue?: number;
  operatingIncomeGrowth?: number;
};
