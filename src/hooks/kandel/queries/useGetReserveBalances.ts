'use client';

import { useReadContracts } from 'wagmi';
import type { Address } from 'viem';
import { KandelABI } from '@/abi/kandel';

export function useGetReserveBalances(kandelAddr?: Address) {
  const enabled = Boolean(kandelAddr);

  const { data, isLoading } = useReadContracts({
    contracts: !enabled
      ? []
      : [
          {
            address: kandelAddr!,
            abi: KandelABI,
            functionName: 'reserveBalance',
            args: [1], // Ask -> BASE
          },
          {
            address: kandelAddr!,
            abi: KandelABI,
            functionName: 'reserveBalance',
            args: [0], // Bid → QUOTE
          },
        ],
    allowFailure: false,
    query: {
      enabled,
    },
  });

  const baseBalance = (data?.[0] as bigint) ?? BigInt(0);
  const quoteBalance = (data?.[1] as bigint | undefined) ?? BigInt(0);

  return {
    baseBalance,
    quoteBalance,
    isLoading: isLoading,
  };
}
