'use client';

import { useReadContract } from 'wagmi';
import type { Address } from 'viem';
import { KandelABI } from '@/abi/kandel';

export function useBaseQuoteTickOffset(kandelAddr: Address) {
  const { data, isLoading } = useReadContract({
    address: kandelAddr,
    abi: KandelABI,
    functionName: 'baseQuoteTickOffset',
  });

  return {
    baseQuoteTickOffset: data as bigint | undefined,
    isLoading,
  };
}
