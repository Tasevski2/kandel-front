'use client';

import { useReadContract } from 'wagmi';
import type { Address } from 'viem';
import { ADDRESSES } from '@/lib/addresses';
import { MangroveABI } from '@/abi/mangrove';

export function useGetMakerFreeBalance(maker?: Address) {
  const enabled = maker !== undefined;

  const { data, isLoading, queryKey } = useReadContract({
    address: ADDRESSES.mangrove as Address,
    abi: MangroveABI,
    functionName: 'balanceOf',
    args: enabled ? [maker] : undefined,
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
