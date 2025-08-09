import { useCallback } from 'react';
import { readContract } from '@wagmi/core';
import { formatUnits } from 'viem';
import { readerAbi } from '../abi/reader';
import { erc20Abi } from '../abi/erc20';
import { ADDRESSES } from '../lib/addresses';
import { config } from './useChain';

export interface Offer {
  id: bigint;
  tick: bigint;
  gives: bigint;
  wants: bigint;
  gasprice: bigint;
  gasreq: bigint;
  maker: `0x${string}`;
  price: number;
  size: number;
  value: number;
  side: 'ask' | 'bid';
  isMine: boolean;
}

export interface OrderBook {
  asks: Offer[];
  bids: Offer[];
}

export function useMgvReader() {
  // Helper to get token decimals
  const getDecimals = useCallback(async (addr: `0x${string}`) => {
    try {
      const decimals = await readContract(config, {
        address: addr,
        abi: erc20Abi,
        functionName: 'decimals',
      });
      return Number(decimals);
    } catch {
      // Fallback to 18 decimals if read fails
      return 18;
    }
  }, []);

  // Convert tick to price with proper decimal adjustment
  const tickToPriceQperB = useCallback(
    (tick: bigint, baseDec: number, quoteDec: number): number => {
      const ratio = Math.exp(Number(tick) * Math.log(1.0001)); // 1.0001**tick
      return ratio;
    },
    []
  );

  const getBook = useCallback(
    async (
      base: `0x${string}`,
      quote: `0x${string}`,
      tickSpacing: bigint,
      myKandelAddrs: `0x${string}`[] = [],
      depth = 50
    ): Promise<OrderBook> => {
      try {
        const [baseDec, quoteDec] = await Promise.all([
          getDecimals(base),
          getDecimals(quote),
        ]);

        const myMakers = new Set(myKandelAddrs.map((a) => a.toLowerCase()));

        // Fetch asks: BASE -> QUOTE
        const askResult = await readContract(config, {
          address: ADDRESSES.mgvReader,
          abi: readerAbi,
          functionName: 'offerList',
          args: [
            {
              outbound_tkn: base,
              inbound_tkn: quote,
              tickSpacing,
            },
            BigInt(0),
            BigInt(depth),
          ],
        });

        // Fetch bids: QUOTE -> BASE
        const bidResult = await readContract(config, {
          address: ADDRESSES.mgvReader,
          abi: readerAbi,
          functionName: 'offerList',
          args: [
            {
              outbound_tkn: quote,
              inbound_tkn: base,
              tickSpacing,
            },
            BigInt(0),
            BigInt(depth),
          ],
        });

        // Parse asks: [meta, ids[], offers[], details[]]
        const [, askIds, askOffers, askDetails] = askResult as [
          any,
          bigint[],
          any[],
          any[]
        ];

        const asks: Offer[] = askIds.map((id, i) => {
          const { tick, gives } = askOffers[i] as {
            tick: bigint;
            gives: bigint;
          }; // gives = BASE amount
          const maker = (askDetails[i].maker as `0x${string}`) || '0x0';

          // Calculate price from tick: QUOTE per BASE
          const price = tickToPriceQperB(tick, baseDec, quoteDec);

          // For asks: gives is BASE, so sizeBase = gives in display units
          const sizeBase = Number(formatUnits(gives, baseDec));

          // Value in QUOTE = sizeBase * price
          const valueQuote = sizeBase * price;

          return {
            id,
            tick,
            gives,
            wants: BigInt(0), // Not needed for display
            gasprice: BigInt(askDetails[i].gasprice || 0),
            gasreq: BigInt(askDetails[i].gasreq || 0),
            maker,
            side: 'ask' as const,
            isMine: myMakers.has(maker.toLowerCase()),
            price,
            size: sizeBase,
            value: valueQuote,
          };
        });

        // Parse bids: [meta, ids[], offers[], details[]]
        const [, bidIds, bidOffers, bidDetails] = bidResult as [
          any,
          bigint[],
          any[],
          any[]
        ];

        const bids: Offer[] = bidIds.map((id, i) => {
          const { tick, gives } = bidOffers[i] as {
            tick: bigint;
            gives: bigint;
          }; // gives = QUOTE amount
          const maker = (bidDetails[i].maker as `0x${string}`) || '0x0';

          // For bids (QUOTE -> BASE), we need to invert the price
          const rawPrice = tickToPriceQperB(tick, baseDec, quoteDec);
          const price = 1 / rawPrice;

          // For bids: gives is QUOTE, so valueQuote = gives in display units
          const valueQuote = Number(formatUnits(gives, quoteDec));

          // Size in BASE = valueQuote / price
          const sizeBase = valueQuote / price;

          return {
            id,
            tick,
            gives,
            wants: BigInt(0), // Not needed for display
            gasprice: BigInt(bidDetails[i].gasprice || 0),
            gasreq: BigInt(bidDetails[i].gasreq || 0),
            maker,
            side: 'bid' as const,
            isMine: myMakers.has(maker.toLowerCase()),
            price,
            size: sizeBase,
            value: valueQuote,
          };
        });

        // Filter out invalid prices and sort
        const validAsks = asks.filter(
          (ask) => !isNaN(ask.price) && isFinite(ask.price) && ask.price > 0
        );
        const validBids = bids.filter(
          (bid) => !isNaN(bid.price) && isFinite(bid.price) && bid.price > 0
        );

        // Sort asks ascending by price (lowest to highest)
        validAsks.sort((a, b) => a.price - b.price);

        // Sort bids descending by price (highest to lowest)
        validBids.sort((a, b) => b.price - a.price);

        return { asks: validAsks, bids: validBids };
      } catch (error) {
        return { asks: [], bids: [] };
      }
    },
    [getDecimals, tickToPriceQperB]
  );

  const getNumOpenMarkets = useCallback(async (): Promise<number> => {
    try {
      const result = await readContract(config, {
        address: ADDRESSES.mgvReader,
        abi: readerAbi,
        functionName: 'numOpenMarkets',
      });
      return Number(result);
    } catch (error) {
      return 0;
    }
  }, []);

  return { getBook, getNumOpenMarkets };
}
