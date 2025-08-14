import {
  getNetworkMajorBaseAssets,
  getNetworkStableCoins,
} from '@/config/networks';
import type { TokenInfo } from '@/hooks/token/useTokensInfo';
import type { Address } from 'viem';

/**
 * Determines the correct base/quote token ordering based on token types and market conventions.
 * Applies priority rules: stable coins become quote tokens, major base assets (ETH, WETH) become base tokens.
 * Falls back to original order if no clear preference can be determined.
 * I also read the docs (https://docs.mangrove.exchange/dev/query-mangrove) but couldn't find the contract function that does this.
 */
export default function determineBaseQuoteDirection(
  tkn0: Address,
  tkn1: Address,
  tokenInfoMap: Map<string, TokenInfo>
): { base: Address; quote: Address } {
  const stableCoins = getNetworkStableCoins();
  const majorBaseAssets = getNetworkMajorBaseAssets();

  const tkn0Info = tokenInfoMap.get(tkn0.toLowerCase());
  const tkn1Info = tokenInfoMap.get(tkn1.toLowerCase());

  if (!tkn0Info || !tkn1Info) {
    return { base: tkn0, quote: tkn1 };
  }

  const tkn0Symbol = tkn0Info.symbol.toUpperCase();
  const tkn1Symbol = tkn1Info.symbol.toUpperCase();

  const tkn0IsStable = stableCoins.some(
    (stable) => stable.toUpperCase() === tkn0Symbol
  );
  const tkn1IsStable = stableCoins.some(
    (stable) => stable.toUpperCase() === tkn1Symbol
  );

  if (tkn0IsStable && !tkn1IsStable) {
    return { base: tkn1, quote: tkn0 };
  } else if (tkn1IsStable && !tkn0IsStable) {
    return { base: tkn0, quote: tkn1 };
  }

  const tkn0IsMajorBase = majorBaseAssets.some(
    (asset) => asset.toUpperCase() === tkn0Symbol
  );
  const tkn1IsMajorBase = majorBaseAssets.some(
    (asset) => asset.toUpperCase() === tkn1Symbol
  );

  if (tkn0IsMajorBase && !tkn1IsMajorBase) {
    return { base: tkn0, quote: tkn1 };
  } else if (tkn1IsMajorBase && !tkn0IsMajorBase) {
    return { base: tkn1, quote: tkn0 };
  }

  return {
    base: tkn0,
    quote: tkn1,
  };
}
