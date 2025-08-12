'use client';

import { useReadContract } from 'wagmi';
import type { Address } from 'viem';
import { KandelABI } from '@/abi/kandel';
import { QUERY_SCOPE_KEYS } from '@/lib/constants';

export function useBaseQuoteTickOffset(kandelAddr: Address) {
  const { data, isLoading } = useReadContract({
    address: kandelAddr,
    abi: KandelABI,
    functionName: 'baseQuoteTickOffset',
    scopeKey: QUERY_SCOPE_KEYS.BASE_QUOTE_TICK_OFFSET,
  });

  return {
    baseQuoteTickOffset: data as bigint | undefined,
    isLoading,
  };
}
