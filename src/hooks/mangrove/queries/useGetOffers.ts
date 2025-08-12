'use client';

import { useMemo } from 'react';
import { useReadContract } from 'wagmi';
import { formatUnits, type Address } from 'viem';
import { readerAbi } from '@/abi/reader';
import { MAX_OFFER_FETCH_DEPTH, QUERY_SCOPE_KEYS } from '@/lib/constants';
import { ADDRESSES } from '@/lib/addresses';
import { tickToPrice } from '@/lib/pricing';

export type OfferSide = 'ask' | 'bid';

export type Offer = {
  id: bigint;
  tick: bigint;
  gives: bigint;
  gasprice: bigint;
  gasreq: bigint;
  maker: Address;
  price: number;
  size: number;
  value: number;
  side: 'ask' | 'bid';
};

type OLKey = {
  outbound_tkn: Address;
  inbound_tkn: Address;
  tickSpacing: bigint;
};

interface GetOffersParams {
  base?: Address;
  quote?: Address;
  baseDec?: number; // BASE token decimals
  quoteDec?: number; // QUOTE token decimals
  tickSpacing?: bigint;
  side: OfferSide;
  maker?: Address | null; // if we do not want to filter by maker then we pass null, because at initialization the maker can be undefined
  enabled?: boolean;
}

export function useGetOffers({
  base,
  baseDec,
  quote,
  quoteDec,
  tickSpacing,
  side,
  maker,
}: GetOffersParams) {
  const enabled = Boolean(
    base &&
      quote &&
      tickSpacing &&
      baseDec !== undefined &&
      quoteDec !== undefined &&
      maker !== undefined
  );

  const olKey = useMemo<OLKey | null>(() => {
    if (!enabled) return null;
    return side === 'ask'
      ? { outbound_tkn: base!, inbound_tkn: quote!, tickSpacing: tickSpacing! }
      : { outbound_tkn: quote!, inbound_tkn: base!, tickSpacing: tickSpacing! };
  }, [enabled, side, base, quote, tickSpacing]);

  const { data, isLoading, refetch, isRefetching } = useReadContract({
    address: ADDRESSES.mgvReader,
    abi: readerAbi,
    functionName: 'offerList',
    args:
      enabled && !!olKey
        ? [olKey, BigInt(0), BigInt(MAX_OFFER_FETCH_DEPTH)]
        : undefined,
    scopeKey: QUERY_SCOPE_KEYS.OFFER_LIST,
    query: {
      enabled: enabled && !!olKey,
    },
  });
  const makerFilter = maker?.toLowerCase();

  const offers: Offer[] | undefined = useMemo(() => {
    if (!data) return;

    const ids = data[1];
    const offersRes = data[2];
    const dets = data[3];

    return ids
      .map((id, i) => {
        const tick = offersRes[i].tick;
        const gives = offersRes[i].gives;

        const rawPrice = tickToPrice(tick);
        const price = side === 'bid' ? 1 / rawPrice : rawPrice;

        let size: number = 0;
        let value: number = 0;

        if (side === 'bid') {
          value = Number(formatUnits(gives, quoteDec!));
          size = value / price;
        } else {
          size = Number(formatUnits(gives, baseDec!));
          value = size * price;
        }

        return {
          id,
          tick,
          maker: dets[i].maker,
          gives,
          gasreq: dets[i].gasreq,
          gasprice: dets[i].gasprice,
          price,
          size,
          value: value,
          side,
        };
      })
      .filter((o) => !makerFilter || o.maker.toLowerCase() === makerFilter)
      .sort((a, b) => (side === 'bid' ? b.price - a.price : a.price - b.price));
  }, [data, makerFilter]);

  return {
    side,
    offers,
    isLoading,
    refetch,
    isRefetching,
  };
}
