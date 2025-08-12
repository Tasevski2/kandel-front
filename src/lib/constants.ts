// default values for the KandelForm
export const DEFAULT_MIN_PRICE = 1000;
export const DEFAULT_MAX_PRICE = 2000;
export const DEFAULT_STEP = 1;
export const DEFAULT_LEVELS_PER_SIDE = 8;
export const DEFAULT_GAS_REQ_WEI = 300000;

export const TICK_BASE = 1.0001;

// Offer fetching depth - maximum number of offers to fetch
export const MAX_OFFER_FETCH_DEPTH = 100;

// Tick system limits
export const MAX_TICK = 887272;
export const MIN_TICK = -887272;

export const MAX_UINT256 = BigInt(
  '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
);
export const MAX_UINT24 = 16777215;
export const MAX_UINT32 = 4294967295;

// Transaction confirmation settings
export const TRANSACTION_CONFIRMATIONS = 1;
