// default values for the KandelForm
export const DEFAULT_MIN_PRICE = 1000;
export const DEFAULT_MAX_PRICE = 2000;
export const DEFAULT_STEP = 1;
export const DEFAULT_LEVELS_PER_SIDE = 8;
export const DEFAULT_GAS_REQ_WEI = 300000;

export const TICK_BASE = 1.0001;

export const MAX_OFFER_FETCH_DEPTH = 100;

export const MAX_TICK = 887272;
export const MIN_TICK = -887272;

export const MAX_UINT256 = BigInt(
  '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
);
export const MAX_UINT24 = 16777215;
export const MAX_UINT32 = 4294967295;

export const TRANSACTION_CONFIRMATIONS = 1;

export const TOAST_AUTO_CLOSE_TIME = 3000;
export const DEFAULT_EXPLORER_URL = 'http://localhost:3000';
export const KILO_TO_GAS_UNITS = 1000;

// Simple Query Scope Keys named by the contract function that we are calling ( did not want to overcomplicate the invalidations )
export const QUERY_SCOPE_KEYS = {
  BASE_QUOTE_TICK_OFFSET: 'baseQuoteTickOffset',
  PARAMS: 'params',
  BALANCE_OF: 'balanceOf',
  OFFER_LIST: 'offerList',
  PROVISION: 'provision',
  RESERVE_BALANCES: 'reserveBalances',
  OFFERED_VOLUMES: 'offeredVolumes',
};
