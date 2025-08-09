'use client';

import { useState, useEffect, useCallback } from 'react';
import { readContract } from '@wagmi/core';
import { readerAbi } from '../abi/reader';
import { erc20Abi } from '../abi/erc20';
import { ADDRESSES } from '../lib/addresses';
import { config } from './useChain';
import { tokenInfoCache, TokenInfo } from './useTokenInfo';
import {
  getNetworkStableCoins,
  getNetworkMajorBaseAssets,
} from '../config/networks';

export interface Market {
  tkn0: `0x${string}`;
  tkn1: `0x${string}`;
  tickSpacing: bigint;
  // Computed properties
  baseToken: `0x${string}`;
  quoteToken: `0x${string}`;
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

// Helper function to determine correct base/quote ordering based on token types
const determineBaseQuoteDirection = (
  tkn0: `0x${string}`,
  tkn1: `0x${string}`,
  tokenInfoMap: Map<string, TokenInfo>
): { base: `0x${string}`; quote: `0x${string}` } => {
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
};

export function useMarkets() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [configs, setConfigs] = useState<MarketConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMarkets = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch open markets with their configurations
      const result = await readContract(config, {
        address: ADDRESSES.mgvReader,
        abi: readerAbi,
        functionName: 'openMarkets',
        args: [true], // withConfig = true
      });

      const [rawMarkets, rawConfigs] = result as [any[], any[]];

      // Fetch complete token info for all markets
      const allTokenAddresses = new Set<`0x${string}`>();
      rawMarkets.forEach((market) => {
        allTokenAddresses.add(market.tkn0);
        allTokenAddresses.add(market.tkn1);
      });

      // Fetch complete token information (symbol, name, decimals) for all tokens
      const tokenInfoMap = new Map<string, TokenInfo>();
      const allTokens = Array.from(allTokenAddresses);

      if (allTokens.length > 0) {
        try {
          const tokenInfoPromises = allTokens.map(async (address) => {
            try {
              // Check cache first
              const cached = tokenInfoCache.get(address.toLowerCase());
              if (cached) {
                return { address: address.toLowerCase(), tokenInfo: cached };
              }

              // Fetch complete token info from blockchain
              const [symbol, name, decimals] = await Promise.all([
                readContract(config, {
                  address,
                  abi: erc20Abi,
                  functionName: 'symbol',
                }),
                readContract(config, {
                  address,
                  abi: erc20Abi,
                  functionName: 'name',
                }),
                readContract(config, {
                  address,
                  abi: erc20Abi,
                  functionName: 'decimals',
                }),
              ]);

              const tokenInfo: TokenInfo = {
                symbol: symbol as string,
                name: name as string,
                decimals: Number(decimals), // Real decimals from blockchain
                address,
              };

              // Cache the complete and correct token info
              tokenInfoCache.set(address.toLowerCase(), tokenInfo);
              return { address: address.toLowerCase(), tokenInfo };
            } catch (error) {
              // Return fallback info but don't cache it
              return {
                address: address.toLowerCase(),
                tokenInfo: {
                  symbol: `${address.slice(0, 6)}...${address.slice(-4)}`,
                  name: 'Unknown Token',
                  decimals: 18, // Fallback only, not cached
                  address,
                } as TokenInfo,
              };
            }
          });

          const tokenInfoResults = await Promise.all(tokenInfoPromises);
          tokenInfoResults.forEach(({ address, tokenInfo }) => {
            tokenInfoMap.set(address, tokenInfo);
          });
        } catch (error) {
          console.error('Failed to fetch token information:', error);
        }
      }
      // Process markets to add computed properties
      const processedMarkets: Market[] = rawMarkets
        .map((market, index) => {
          // Determine correct base/quote token order using token info
          const { base: baseToken, quote: quoteToken } =
            determineBaseQuoteDirection(
              market.tkn0 as `0x${string}`,
              market.tkn1 as `0x${string}`,
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
      setMarkets(processedMarkets);
      setConfigs(processedConfigs);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Failed to fetch markets'
      );
      setMarkets([]);
      setConfigs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Efficient single market fetching using marketConfig
  const getMarketConfig = useCallback(
    async (
      base: `0x${string}`,
      quote: `0x${string}`,
      tickSpacing: bigint
    ): Promise<Market | null> => {
      try {
        const result = await readContract(config, {
          address: ADDRESSES.mgvReader,
          abi: readerAbi,
          functionName: 'marketConfig',
          args: [
            {
              tkn0: base,
              tkn1: quote,
              tickSpacing,
            },
          ],
        });

        const marketConfig = result as any;

        // Fetch token info for base and quote
        const [baseTokenInfo, quoteTokenInfo] = await Promise.all([
          (async () => {
            const cached = tokenInfoCache.get(base.toLowerCase());
            if (cached) return cached;

            const [symbol, name, decimals] = await Promise.all([
              readContract(config, {
                address: base,
                abi: erc20Abi,
                functionName: 'symbol',
              }),
              readContract(config, {
                address: base,
                abi: erc20Abi,
                functionName: 'name',
              }),
              readContract(config, {
                address: base,
                abi: erc20Abi,
                functionName: 'decimals',
              }),
            ]);

            const tokenInfo: TokenInfo = {
              symbol: symbol as string,
              name: name as string,
              decimals: Number(decimals),
              address: base,
            };

            tokenInfoCache.set(base.toLowerCase(), tokenInfo);
            return tokenInfo;
          })(),
          (async () => {
            const cached = tokenInfoCache.get(quote.toLowerCase());
            if (cached) return cached;

            const [symbol, name, decimals] = await Promise.all([
              readContract(config, {
                address: quote,
                abi: erc20Abi,
                functionName: 'symbol',
              }),
              readContract(config, {
                address: quote,
                abi: erc20Abi,
                functionName: 'name',
              }),
              readContract(config, {
                address: quote,
                abi: erc20Abi,
                functionName: 'decimals',
              }),
            ]);

            const tokenInfo: TokenInfo = {
              symbol: symbol as string,
              name: name as string,
              decimals: Number(decimals),
              address: quote,
            };

            tokenInfoCache.set(quote.toLowerCase(), tokenInfo);
            return tokenInfo;
          })(),
        ]);

        const baseToken = base;
        const quoteToken = quote;
        const pairId = `${baseTokenInfo.symbol}_${quoteTokenInfo.symbol}`;
        const isActive =
          marketConfig?.config01?.active ||
          marketConfig?.config10?.active ||
          false;

        return {
          tkn0: base,
          tkn1: quote,
          tickSpacing,
          baseToken,
          quoteToken,
          baseTokenInfo,
          quoteTokenInfo,
          pairId,
          isActive,
        } as Market;
      } catch (error) {
        return null;
      }
    },
    []
  );

  // Cache for frequently accessed markets
  const marketCache = useState(new Map<string, Market>())[0];

  const getCachedMarket = useCallback(
    async (
      base: `0x${string}`,
      quote: `0x${string}`,
      tickSpacing: bigint
    ): Promise<Market | null> => {
      const cacheKey = `${base.toLowerCase()}-${quote.toLowerCase()}-${tickSpacing.toString()}`;

      if (marketCache.has(cacheKey)) {
        return marketCache.get(cacheKey) || null;
      }

      const market = await getMarketConfig(base, quote, tickSpacing);
      if (market) {
        marketCache.set(cacheKey, market);
      }
      return market;
    },
    [getMarketConfig, marketCache]
  );

  // Fetch markets on mount
  useEffect(() => {
    fetchMarkets();
  }, [fetchMarkets]);

  // Helper function to parse pair ID and get market
  const getMarketByPairId = useCallback(
    (
      pairId: string
    ): {
      market: Market | undefined;
      baseToken: `0x${string}` | undefined;
      quoteToken: `0x${string}` | undefined;
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

  return {
    markets,
    configs,
    loading,
    error,
    refetch: fetchMarkets,
    getMarketByPairId,
    getMarketConfig,
    getCachedMarket,
  };
}
