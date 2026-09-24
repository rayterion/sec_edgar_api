export interface FieldMapping {
  tags: readonly string[];
  additive: boolean;
}
export const incomeMappings: Record<string, FieldMapping> = {
  revenue: {
    tags: [
      "us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax",
      "us-gaap:Revenues",
      "us-gaap:SalesRevenueNet",
      "ifrs-full:Revenue",
    ],
    additive: true,
  },
  costOfRevenue: {
    tags: [
      "us-gaap:CostOfGoodsAndServicesSold",
      "us-gaap:CostOfRevenue",
      "ifrs-full:CostOfSales",
    ],
    additive: true,
  },
  grossProfit: {
    tags: ["us-gaap:GrossProfit", "ifrs-full:GrossProfit"],
    additive: true,
  },
  operatingIncome: {
    tags: [
      "us-gaap:OperatingIncomeLoss",
      "ifrs-full:ProfitLossFromOperatingActivities",
    ],
    additive: true,
  },
  pretaxIncome: {
    tags: [
      "us-gaap:IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest",
      "us-gaap:IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments",
      "ifrs-full:ProfitLossBeforeTax",
    ],
    additive: true,
  },
  netIncome: {
    tags: ["us-gaap:NetIncomeLoss", "ifrs-full:ProfitLoss"],
    additive: true,
  },
  incomeTaxExpense: {
    tags: [
      "us-gaap:IncomeTaxExpenseBenefit",
      "ifrs-full:IncomeTaxExpenseContinuingOperations",
    ],
    additive: true,
  },
  earningsPerShareDiluted: {
    tags: [
      "us-gaap:EarningsPerShareDiluted",
      "ifrs-full:DilutedEarningsLossPerShare",
    ],
    additive: false,
  },
};
export const balanceMappings: Record<string, FieldMapping> = {
  cash: {
    tags: [
      "us-gaap:CashAndCashEquivalentsAtCarryingValue",
      "ifrs-full:CashAndCashEquivalents",
    ],
    additive: false,
  },
  receivables: {
    tags: [
      "us-gaap:AccountsReceivableNetCurrent",
      "us-gaap:AccountsNotesAndOtherReceivablesNetCurrent",
      "ifrs-full:TradeAndOtherCurrentReceivables",
    ],
    additive: false,
  },
  inventory: {
    tags: ["us-gaap:InventoryNet", "ifrs-full:Inventories"],
    additive: false,
  },
  currentAssets: {
    tags: ["us-gaap:AssetsCurrent", "ifrs-full:CurrentAssets"],
    additive: false,
  },
  totalAssets: {
    tags: ["us-gaap:Assets", "ifrs-full:Assets"],
    additive: false,
  },
  currentLiabilities: {
    tags: ["us-gaap:LiabilitiesCurrent", "ifrs-full:CurrentLiabilities"],
    additive: false,
  },
  longTermDebt: {
    tags: [
      "us-gaap:LongTermDebtNoncurrent",
      "us-gaap:LongTermDebt",
      "ifrs-full:NoncurrentBorrowings",
    ],
    additive: false,
  },
  totalLiabilities: {
    tags: ["us-gaap:Liabilities", "ifrs-full:Liabilities"],
    additive: false,
  },
  equity: {
    tags: ["us-gaap:StockholdersEquity", "ifrs-full:Equity"],
    additive: false,
  },
};
export const cashFlowMappings: Record<string, FieldMapping> = {
  netCashFromOperations: {
    tags: [
      "us-gaap:NetCashProvidedByUsedInOperatingActivities",
      "ifrs-full:CashFlowsFromUsedInOperatingActivities",
    ],
    additive: true,
  },
  netCashFromInvesting: {
    tags: [
      "us-gaap:NetCashProvidedByUsedInInvestingActivities",
      "ifrs-full:CashFlowsFromUsedInInvestingActivities",
    ],
    additive: true,
  },
  netCashFromFinancing: {
    tags: [
      "us-gaap:NetCashProvidedByUsedInFinancingActivities",
      "ifrs-full:CashFlowsFromUsedInFinancingActivities",
    ],
    additive: true,
  },
  capitalExpenditures: {
    tags: [
      "us-gaap:PaymentsToAcquirePropertyPlantAndEquipment",
      "ifrs-full:PurchaseOfPropertyPlantAndEquipment",
    ],
    additive: true,
  },
};
