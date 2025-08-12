// Error messages for KandelForm component
export const VALIDATION_ERRORS = {
  // Loading states
  LOADING_TOKENS: 'Loading token information, please wait...',
  TOKEN_DATA_LOADING:
    'Token data is still loading. Please wait a moment and try again.',

  // Required fields
  REQUIRED_FIELDS: 'Please fill in all required fields',
  REQUIRED_AMOUNTS: (baseSymbol: string, quoteSymbol: string) =>
    `Please enter ${baseSymbol} and ${quoteSymbol} amounts`,

  // Price validation
  MIN_PRICE_INVALID: 'Min price must be a valid number',
  MAX_PRICE_INVALID: 'Max price must be a valid number',
  MIN_PRICE_POSITIVE: 'Min price must be greater than 0',
  MAX_PRICE_GREATER: 'Max price must be greater than min price',

  // Levels validation
  LEVELS_MUST_BE_NUMBER: 'Levels per side must be a number',
  LEVELS_POSITIVE: 'Number of price levels must be at least 1.',

  // Parameter validation
  GAS_TOO_HIGH:
    'Gas requirement is too high. Please use a lower value (maximum: 16,777,215).',
  STEP_TOO_LARGE:
    'Step size is too large. Please use a value: 1 <= step size < price points.',
  TOO_MANY_LEVELS:
    'Too many price levels requested. Please reduce the number of levels.',

  // Amount validation
  ZERO_AMOUNTS:
    'Cannot create Kandel with both bid and ask amounts being zero. ' +
    'Either add funds via "Deposit entered amounts into Kandel inventory" or ensure the Kandel has existing inventory.',

  // Reserve validation
  INSUFFICIENT_RESERVES: (levels: number) =>
    `Not enough tokens in reserve for ${levels} price levels. `,
  ENABLE_DEPOSIT_SUGGESTION:
    'Enable "Deposit entered amounts into Kandel inventory" to add more funds.',

  // Min volume errors (dynamic based on token info)
  BASE_BELOW_MINIMUM: (perLevel: string, symbol: string, required: string) =>
    `Base amount per level (${perLevel} ${symbol}) is below minimum required for asks (${required} ${symbol})`,
  QUOTE_BELOW_MINIMUM: (perLevel: string, symbol: string, required: string) =>
    `Quote amount per level (${perLevel} ${symbol}) is below minimum required for bids (${required} ${symbol})`,
};

export const TRANSACTION_ERRORS = {
  // Generic
  DEFAULT: 'Transaction failed. Please try again.',
  CANCELLED: 'Transaction was cancelled.',

  // Specific error patterns
  INSUFFICIENT_FUNDS:
    'Insufficient funds to complete the transaction. Please check your wallet balance.',
  LOW_GAS:
    'Transaction failed due to low gas. Please try again with higher gas settings.',
  PROVISION_INSUFFICIENT:
    'The required ETH provision amount was insufficient. Please try with a higher provision.',
};

// Error pattern matching for transaction errors
export const ERROR_PATTERNS = {
  INSUFFICIENT: ['insufficient funds', 'insufficient balance'],
  USER_REJECTION: ['user rejected', 'user denied'],
  GAS_ISSUES: ['gas', 'too low'],
  PROVISION: ['provision'],
  SLIPPAGE: ['slippage', 'price'],
};
