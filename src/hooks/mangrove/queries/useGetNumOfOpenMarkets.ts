'use client';

import { useReadContract } from 'wagmi';
import type { Address } from 'viem';
import { readerAbi } from '@/abi/reader';
import { ADDRESSES } from '@/lib/addresses';

export function useGetNumOfOpenMarkets() {
  const { data, isLoading } = useReadContract({
    address: ADDRESSES.mgvReader as Address,
    abi: readerAbi,
    functionName: 'numOpenMarkets',
  });

  return {
    numOfOpenMarkets: data !== undefined ? Number(data) : undefined,
    isLoading: isLoading,
  };
}
