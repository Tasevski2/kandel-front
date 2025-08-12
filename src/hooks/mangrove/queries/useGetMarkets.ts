'use client';

import { useMemo } from 'react';
import { useReadContract } from 'wagmi';
import { Address } from 'viem';
import { readerAbi } from '@/abi/reader';
import { ADDRESSES } from '@/lib/addresses';
import { useTokensInfo, type TokenInfo } from '@/hooks/token/useTokenInfo';
import determineBaseQuoteDirection from '@/lib/determineBaseQuoteDirection';

export interface Market {
  tkn0: Address;
  tkn1: Address;
  tickSpacing: bigint;
  // Computed properties
  baseToken: Address;
  quoteToken: Address;
  baseTokenInfo: TokenInfo;
  quoteTokenInfo: TokenInfo;
  pairId: string; // e.g., "WETH_USDC"
  isActive: boolean;
}

export interface MarketConfig {
  config01: {
    active: boolean;
    fee: bigint;
    density: bigint;
  };
  config10: {
    active: boolean;
    fee: bigint;
    density: bigint;
  };
}

export function useGetMarkets() {
  // Fetch open markets with their configurations using modern wagmi pattern
  const {
    data: marketsData,
    isLoading: isMarketsLoading,
    error: marketsError,
    refetch,
  } = useReadContract({
    address: ADDRESSES.mgvReader,
    abi: readerAbi,
    functionName: 'openMarkets',
    args: [true], // withConfig = true
  });

  // Extract all unique token addresses from markets data
  const allTokenAddresses = useMemo(() => {
    if (!marketsData) return [];

    const [rawMarkets] = marketsData as [any[], any[]];
    const tokenAddressSet = new Set<Address>();
    
    rawMarkets.forEach((market) => {
      tokenAddressSet.add(market.tkn0);
      tokenAddressSet.add(market.tkn1);
    });
    
    return Array.from(tokenAddressSet);
  }, [marketsData]);

  // Fetch token information using existing hook with wagmi caching
  const {
    tokensInfo,
    isLoading: isTokensLoading,
    error: tokensError,
  } = useTokensInfo(allTokenAddresses);

  // Process markets data with token information
  const { markets, configs } = useMemo(() => {
    if (!marketsData) {
      return { markets: [], configs: [] };
    }

    const [rawMarkets, rawConfigs] = marketsData as [any[], any[]];

    // Create token info map for efficient lookup
    const tokenInfoMap = new Map<string, TokenInfo>();
    Object.entries(tokensInfo).forEach(([address, tokenInfo]) => {
      tokenInfoMap.set(address.toLowerCase(), tokenInfo);
    });

    // Process markets to add computed properties
    const processedMarkets: Market[] = rawMarkets
      .map((market, index) => {
        // Determine correct base/quote token order using token info
        const { base: baseToken, quote: quoteToken } = determineBaseQuoteDirection(
          market.tkn0 as Address,
          market.tkn1 as Address,
          tokenInfoMap
        );

        // Get token info for base and quote
        const baseTokenInfo = tokenInfoMap.get(baseToken.toLowerCase());
        const quoteTokenInfo = tokenInfoMap.get(quoteToken.toLowerCase());

        // Skip market if we don't have token info
        if (!baseTokenInfo || !quoteTokenInfo) {
          return null;
        }

        // Create a pair identifier using symbols
        const pairId = `${baseTokenInfo.symbol}_${quoteTokenInfo.symbol}`;

        // Check if market is active (either direction)
        const marketConfig = rawConfigs[index];
        const isActive =
          marketConfig?.config01?.active && marketConfig?.config10?.active;

        return {
          tkn0: market.tkn0,
          tkn1: market.tkn1,
          tickSpacing: market.tickSpacing,
          baseToken,
          quoteToken,
          baseTokenInfo,
          quoteTokenInfo,
          pairId,
          isActive,
        };
      })
      .filter((market): market is Market => market !== null);

    // Process configs
    const processedConfigs: MarketConfig[] = rawConfigs.map((config) => ({
      config01: {
        active: config.config01?.active || false,
        fee: config.config01?.fee || BigInt(0),
        density: config.config01?.density || BigInt(0),
      },
      config10: {
        active: config.config10?.active || false,
        fee: config.config10?.fee || BigInt(0),
        density: config.config10?.density || BigInt(0),
      },
    }));

    return { markets: processedMarkets, configs: processedConfigs };
  }, [marketsData, tokensInfo]);

  // Helper function to parse pair ID and get market
  const getMarketByPairId = useMemo(
    () =>
      (pairId: string): {
        market: Market | undefined;
        baseToken: Address | undefined;
        quoteToken: Address | undefined;
      } => {
        // First try exact match
        let market = markets.find((m) => m.pairId === pairId);

        // If not found, try reverse order (USDC_WETH vs WETH_USDC)
        if (!market && pairId.includes('_')) {
          const [symbol1, symbol2] = pairId.split('_');
          const reversePairId = `${symbol2}_${symbol1}`;
          market = markets.find((m) => m.pairId === reversePairId);
        }

        if (market) {
          return {
            market,
            baseToken: market.baseToken,
            quoteToken: market.quoteToken,
          };
        }

        return {
          market: undefined,
          baseToken: undefined,
          quoteToken: undefined,
        };
      },
    [markets]
  );

  // Combine loading states and errors
  const isLoading = isMarketsLoading || isTokensLoading;
  const error = marketsError?.message || tokensError || null;

  return {
    markets,
    configs,
    isLoading,
    error,
    refetch,
    getMarketByPairId,
  };
}