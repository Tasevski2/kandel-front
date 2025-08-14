'use client';

import { useMemo } from 'react';
import { useReadContract } from 'wagmi';
import { Address } from 'viem';
import { readerAbi } from '@/abi/reader';
import { ADDRESSES } from '@/lib/addresses';
import { useTokensInfo, type TokenInfo } from '@/hooks/token/useTokensInfo';
import determineBaseQuoteDirection from '@/lib/determineBaseQuoteDirection';

export interface Market {
  tkn0: Address;
  tkn1: Address;
  tickSpacing: bigint;
  baseTokenInfo: TokenInfo;
  quoteTokenInfo: TokenInfo;
  pairId: string;
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
  const {
    data: marketsData,
    isLoading: isMarketsLoading,
    error: marketsError,
    refetch,
  } = useReadContract({
    address: ADDRESSES.mgvReader,
    abi: readerAbi,
    functionName: 'openMarkets',
    args: [true],
  });

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

    const tokenInfoMap = new Map<string, TokenInfo>();
    Object.entries(tokensInfo).forEach(([address, tokenInfo]) => {
      tokenInfoMap.set(address.toLowerCase(), tokenInfo);
    });

    const processedMarkets: Market[] = rawMarkets
      .map((market, index) => {
        const { base: baseToken, quote: quoteToken } =
          determineBaseQuoteDirection(
            market.tkn0 as Address,
            market.tkn1 as Address,
            tokenInfoMap
          );

        const baseTokenInfo = tokenInfoMap.get(baseToken.toLowerCase());
        const quoteTokenInfo = tokenInfoMap.get(quoteToken.toLowerCase());

        if (!baseTokenInfo || !quoteTokenInfo) {
          return null;
        }

        const pairId = `${baseTokenInfo.symbol}_${quoteTokenInfo.symbol}`;

        const marketConfig = rawConfigs[index];
        const isActive =
          marketConfig?.config01?.active && marketConfig?.config10?.active;

        return {
          tkn0: market.tkn0,
          tkn1: market.tkn1,
          tickSpacing: market.tickSpacing,
          baseTokenInfo,
          quoteTokenInfo,
          pairId,
          isActive,
        };
      })
      .filter((market): market is Market => market !== null);

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

  const getMarketByPairId = useMemo(
    () =>
      (
        pairId: string
      ): {
        market: Market | undefined;
        baseToken: Address | undefined;
        quoteToken: Address | undefined;
      } => {
        let market = markets.find((m) => m.pairId === pairId);

        if (!market && pairId.includes('_')) {
          const [symbol1, symbol2] = pairId.split('_');
          const reversePairId = `${symbol2}_${symbol1}`;
          market = markets.find((m) => m.pairId === reversePairId);
        }

        if (market) {
          return {
            market,
            baseToken: market.baseTokenInfo.address,
            quoteToken: market.quoteTokenInfo.address,
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
