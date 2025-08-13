import { Address } from 'viem';
import { useGetOffers } from '../../mangrove/queries/useGetOffers';
import { useMemo } from 'react';

interface GetBaseQuoteTickIndex0Params {
  kandelAddr: Address;
  base?: Address;
  quote?: Address;
  baseDec?: number;
  quoteDec?: number;
  tickSpacing?: bigint;
  enabled?: boolean;
}

/**
 * Lowest-price ASK tick for this Kandel (aka baseQuoteTickIndex0).
 */
export function useGetBaseQuoteTickIndex0({
  kandelAddr,
  base,
  quote,
  baseDec,
  quoteDec,
  tickSpacing,
}: GetBaseQuoteTickIndex0Params) {
  const asks = useGetOffers({
    base: base,
    quote: quote,
    baseDec,
    quoteDec,
    tickSpacing,
    side: 'ask',
    maker: kandelAddr,
  });

  const baseQuoteTickIndex0 = useMemo(() => {
    if (asks.isLoading || asks.offers === undefined) return;
    if (!asks.offers.length) return null;
    return asks.offers[0].tick;
  }, [asks.isLoading, asks.offers]);

  return {
    baseQuoteTickIndex0,
    isLoading: asks.isLoading,
  };
}
