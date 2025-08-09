import { defineChain } from 'viem';
import { base } from 'viem/chains';

// Anvil local testnet configuration
export const anvil = defineChain({
  id: 31337,
  name: 'Anvil',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_ANVIL_RPC_URL || 'http://127.0.0.1:8545'],
    },
  },
});

// Base mainnet configuration
export const baseMainnet = {
  ...base,
  rpcUrls: {
    default: {
      http: [
        process.env.NEXT_PUBLIC_BASE_RPC_URL || '',
        'https://base-rpc.publicnode.com',
      ],
    },
  },
};

// Environment-based network selection
export function getActiveNetwork() {
  const environment = process.env.NEXT_PUBLIC_ENVIRONMENT || 'dev';

  switch (environment) {
    case 'prod':
      return baseMainnet;
    case 'dev':
    default:
      return anvil;
  }
}

// Get network name for display
export function getNetworkName() {
  const environment = process.env.NEXT_PUBLIC_ENVIRONMENT || 'dev';

  switch (environment) {
    case 'prod':
      return 'Base';
    case 'dev':
    default:
      return 'Anvil (Local)';
  }
}

// Check if we're in production (Base mainnet)
export function isProduction() {
  return process.env.NEXT_PUBLIC_ENVIRONMENT === 'prod';
}

// Check if we're in development (Anvil)
export function isDevelopment() {
  return process.env.NEXT_PUBLIC_ENVIRONMENT !== 'prod';
}

// Network-specific token configurations
export const NETWORK_TOKEN_CONFIG = {
  anvil: {
    stableCoins: ['USDC'],
    majorBaseAssets: ['WETH'],
  },
  base: {
    stableCoins: ['USDC', 'EURC'],
    majorBaseAssets: ['WETH'],
  },
} as const;

// Get stable coins for current network
export function getNetworkStableCoins(): readonly string[] {
  const environment = process.env.NEXT_PUBLIC_ENVIRONMENT || 'dev';

  switch (environment) {
    case 'prod':
      return NETWORK_TOKEN_CONFIG.base.stableCoins;
    case 'dev':
    default:
      return NETWORK_TOKEN_CONFIG.anvil.stableCoins;
  }
}

// Get major base assets for current network
export function getNetworkMajorBaseAssets(): readonly string[] {
  const environment = process.env.NEXT_PUBLIC_ENVIRONMENT || 'dev';

  switch (environment) {
    case 'prod':
      return NETWORK_TOKEN_CONFIG.base.majorBaseAssets;
    case 'dev':
    default:
      return NETWORK_TOKEN_CONFIG.anvil.majorBaseAssets;
  }
}
