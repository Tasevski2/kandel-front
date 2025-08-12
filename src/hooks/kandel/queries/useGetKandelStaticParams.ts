'use client';

import { useReadContracts } from 'wagmi';
import type { Address } from 'viem';
import { KandelABI } from '@/abi/kandel';
import { useMemo } from 'react';

export type KandelStaticParams = {
  base: Address;
  quote: Address;
  tickSpacing: bigint;
};

export function useGetKandelStatisParams(kandelAddr: Address) {
  const { data, isLoading } = useReadContracts({
    allowFailure: false,
    contracts: [
      { address: kandelAddr, abi: KandelABI, functionName: 'BASE' },
      { address: kandelAddr, abi: KandelABI, functionName: 'QUOTE' },
      {
        address: kandelAddr,
        abi: KandelABI,
        functionName: 'TICK_SPACING',
      },
    ],
  });

  const staticParams: KandelStaticParams | undefined = useMemo(() => {
    if (!data) return;
    return {
      base: data[0] as Address,
      quote: data[1] as Address,
      tickSpacing: data[2] as bigint,
    };
  }, [data]);

  return {
    staticParams,
    isLoading,
  };
}
