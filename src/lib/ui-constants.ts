// UI text constants grouped by component/feature

export const APP_LABELS = {
  title: "Kandel Position Manager",
  subtitle: "Select a market to view order book and manage your Kandel positions",
} as const;

export const KANDEL_LABELS = {
  yourKandels: "Your Kandels",
  noPositions: "No Kandel positions yet", 
  createNew: "Create New Kandel",
  noPositionsFound: "No Kandel positions found",
} as const;

export const MARKET_LABELS = {
  selectMarket: "Select a market",
  getStarted: "Select a market to get started",
  noMarketsFound: "No markets found",
  selectAbove: "Select a market above to configure your Kandel position",
  marketSelection: "Market Selection",
} as const;

export const ERROR_LABELS = {
  retry: "Retry",
} as const;

export const STATUS_LABELS = {
  marketsAvailable: "markets available",
  totalKandel: "total Kandel",
  totalKandels: "total Kandels",
} as const;