'use client';

import type { Address } from 'viem';
import { useGetOffers } from './useGetOffers';

interface GetOrderBookParams {
  base?: Address;
  quote?: Address;
  baseDec?: number;
  quoteDec?: number;
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
