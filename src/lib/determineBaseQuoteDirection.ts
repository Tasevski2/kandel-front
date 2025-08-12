import {
  getNetworkMajorBaseAssets,
  getNetworkStableCoins,
} from '@/config/networks';
import type { TokenInfo } from '@/hooks/token/useTokenInfo';
import type { Address } from 'viem';

// Helper function to determine correct base/quote ordering based on token types
export default function determineBaseQuoteDirection(
  tkn0: Address,
  tkn1: Address,
  tokenInfoMap: Map<string, TokenInfo>
): { base: Address; quote: Address } {
  // Get network-specific configurations
  const stableCoins = getNetworkStableCoins();
  const majorBaseAssets = getNetworkMajorBaseAssets();

  // Get token info
  const tkn0Info = tokenInfoMap.get(tkn0.toLowerCase());
  const tkn1Info = tokenInfoMap.get(tkn1.toLowerCase());

  if (!tkn0Info || !tkn1Info) {
    // Fallback if token info not available
    return { base: tkn0, quote: tkn1 };
  }

  // Get token symbols (case-insensitive)
  const tkn0Symbol = tkn0Info.symbol.toUpperCase();
  const tkn1Symbol = tkn1Info.symbol.toUpperCase();

  // Priority 1: Check for stable coins
  const tkn0IsStable = stableCoins.some(
    (stable) => stable.toUpperCase() === tkn0Symbol
  );
  const tkn1IsStable = stableCoins.some(
    (stable) => stable.toUpperCase() === tkn1Symbol
  );

  if (tkn0IsStable && !tkn1IsStable) {
    // tkn0 is stable coin -> tkn0 becomes quote, tkn1 becomes base
    return { base: tkn1, quote: tkn0 };
  } else if (tkn1IsStable && !tkn0IsStable) {
    // tkn1 is stable coin -> tkn1 becomes quote, tkn0 becomes base
    return { base: tkn0, quote: tkn1 };
  }

  // Priority 2: Check for major base assets (ETH, WETH, etc.)
  const tkn0IsMajorBase = majorBaseAssets.some(
    (asset) => asset.toUpperCase() === tkn0Symbol
  );
  const tkn1IsMajorBase = majorBaseAssets.some(
    (asset) => asset.toUpperCase() === tkn1Symbol
  );

  if (tkn0IsMajorBase && !tkn1IsMajorBase) {
    // tkn0 is major base asset -> tkn0 becomes base, tkn1 becomes quote
    return { base: tkn0, quote: tkn1 };
  } else if (tkn1IsMajorBase && !tkn0IsMajorBase) {
    // tkn1 is major base asset -> tkn1 becomes base, tkn0 becomes quote
    return { base: tkn1, quote: tkn0 };
  }

  // Fallback: use tkn0 as base, tkn1 as quote (existing order)
  return {
    base: tkn0,
    quote: tkn1,
  };
}
