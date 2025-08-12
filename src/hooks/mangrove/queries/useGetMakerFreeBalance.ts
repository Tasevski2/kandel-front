'use client';

import { useReadContract } from 'wagmi';
import type { Address } from 'viem';
import { ADDRESSES } from '@/lib/addresses';
import { MangroveABI } from '@/abi/mangrove';
import { QUERY_SCOPE_KEYS } from '@/lib/constants';

export function useGetMakerFreeBalance(maker?: Address) {
  const enabled = maker !== undefined;

  const { data, isLoading, queryKey } = useReadContract({
    address: ADDRESSES.mangrove as Address,
    abi: MangroveABI,
    functionName: 'balanceOf',
    args: enabled ? [maker] : undefined,
    scopeKey: QUERY_SCOPE_KEYS.BALANCE_OF,
    query: {
      enabled,
    },
  });

  return {
    balanceWei: data,
    isLoading: isLoading,
    queryKey,
  };
}
