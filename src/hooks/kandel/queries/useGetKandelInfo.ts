// src/hooks/kandel/useKandelInfo.ts
'use client';

import { useMemo } from 'react';
import type { Address } from 'viem';
import { useTokensInfo, type TokenInfo } from '@/hooks/token/useTokenInfo';
import { tickToPrice } from '@/lib/pricing';
import { useGetKandelParams } from './useGetKandelParams';
import { useGetKandelStaticParams } from './useGetKandelStaticParams';
import { useGetBaseQuoteTickIndex0 } from './useGetBaseQuoteTickIndex0';
import { useBaseQuoteTickOffset } from './useGetBaseQuoteTickOffset';

export type KandelInfo = {
  address: Address;
  base: TokenInfo;
  quote: TokenInfo;
  stepSize: number;
  levelsPerSide: number;
  gasprice: number;
  gasreq: number;
  tickSpacing: bigint;
  minPrice?: number;
  maxPrice?: number;
  minTick?: bigint;
  maxTick?: bigint;
  baseQuoteTickOffset?: bigint;
  baseQuoteTickIndex0?: bigint;
};

export function useGetKandelInfo(kandelAddr: Address) {
  const { staticParams } = useGetKandelStaticParams(kandelAddr);
  const { params } = useGetKandelParams(kandelAddr);
  const { baseQuoteTickOffset } = useBaseQuoteTickOffset(kandelAddr);

  const baseAddr = staticParams?.base;
  const quoteAddr = staticParams?.quote;
  const { tokensInfo } = useTokensInfo(
    baseAddr && quoteAddr ? [baseAddr, quoteAddr] : []
  );
  const baseTokenInfo = baseAddr ? tokensInfo[baseAddr] : undefined;
  const quoteTokenInfo = quoteAddr ? tokensInfo[quoteAddr] : undefined;

  const { baseQuoteTickIndex0 } = useGetBaseQuoteTickIndex0({
    kandelAddr,
    base: baseAddr,
    quote: quoteAddr,
    baseDec: baseTokenInfo?.decimals,
    quoteDec: quoteTokenInfo?.decimals,
    tickSpacing: staticParams?.tickSpacing,
  });

  const kandelInfo: KandelInfo | undefined = useMemo(() => {
    if (!params || !staticParams || !baseTokenInfo || !quoteTokenInfo) return;

    const { stepSize, pricePoints, gasprice, gasreq } = params;
    const { tickSpacing } = staticParams;

    if (pricePoints === 0) {
      return {
        address: kandelAddr,
        base: baseTokenInfo,
        quote: quoteTokenInfo,
        stepSize: stepSize,
        levelsPerSide: 0,
        gasprice: gasprice,
        gasreq: gasreq,
        tickSpacing: tickSpacing,
      };
    }

    if (baseQuoteTickIndex0 === undefined || baseQuoteTickOffset === undefined)
      return; // if it is undefined then it is still not loaded
    const levelsPerSide = pricePoints / 2;
    let minPrice: number | undefined;
    let maxPrice: number | undefined;
    let minTick: bigint | undefined;
    let maxTick: bigint | undefined;

    if (baseQuoteTickIndex0 && baseQuoteTickOffset) {
      const levels = BigInt(levelsPerSide);

      minTick = baseQuoteTickIndex0 - levels * baseQuoteTickOffset;
      maxTick =
        baseQuoteTickIndex0 + (levels - BigInt(1)) * baseQuoteTickOffset;

      minPrice = tickToPrice(minTick);
      maxPrice = tickToPrice(maxTick);
    }

    return {
      address: kandelAddr,
      base: baseTokenInfo,
      quote: quoteTokenInfo,
      stepSize,
      levelsPerSide,
      gasprice,
      gasreq,
      tickSpacing,
      minPrice,
      maxPrice,
      minTick,
      maxTick,
      baseQuoteTickOffset: baseQuoteTickOffset ?? undefined,
      baseQuoteTickIndex0: baseQuoteTickIndex0 ?? undefined,
    };
  }, [
    params,
    staticParams,
    baseTokenInfo,
    quoteTokenInfo,
    baseQuoteTickIndex0,
    baseQuoteTickOffset,
  ]);

  return { kandelInfo, isLoading: !kandelInfo };
}
