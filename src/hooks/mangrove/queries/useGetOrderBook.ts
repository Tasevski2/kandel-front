'use client';

import type { Address } from 'viem';
import { useGetOffers } from './useGetOffers';

interface GetOrderBookParams {
  base?: Address; // BASE token
  quote?: Address; // QUOTE token
  baseDec?: number; // BASE token decimals
  quoteDec?: number; // QUOTE token decimals
  tickSpacing?: bigint;
  maker?: Address | null;
}

export function useGetOrderBook({
  base,
  quote,
  baseDec,
  quoteDec,
  tickSpacing,
  maker,
}: GetOrderBookParams) {
  const asks = useGetOffers({
    base,
    quote,
    baseDec,
    quoteDec,
    tickSpacing,
    side: 'ask',
    maker,
  });

  const bids = useGetOffers({
    base,
    quote,
    baseDec,
    quoteDec,
    tickSpacing,
    side: 'bid',
    maker,
  });

  const refetch = async () => {
    await Promise.all([asks.refetch(), bids.refetch()]);
  };

  return {
    asks: asks.offers,
    bids: bids.offers,
    isLoading: asks.isLoading || bids.isLoading,
    isRefetching: asks.isRefetching || bids.isRefetching,
    refetch,
  };
}
