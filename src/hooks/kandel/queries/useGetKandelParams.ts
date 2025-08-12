import { KandelABI } from '@/abi/kandel';
import { useMemo } from 'react';
import { Address } from 'viem';
import { useReadContract } from 'wagmi';

export type KandelParams = {
  gasprice: number;
  gasreq: number;
  stepSize: number;
  pricePoints: number;
};

export function useGetKandelParams(kandelAddr: Address) {
  const { data, isLoading } = useReadContract({
    address: kandelAddr,
    abi: KandelABI,
    functionName: 'params',
    query: {
      enabled: !!kandelAddr,
    },
  });

  const params = useMemo(() => {
    if (!data) return;
    const arr = data as [bigint, bigint, bigint, bigint]; // [gasprice, gasreq, stepSize, pricePoints]
    return {
      gasprice: Number(arr[0]),
      gasreq: Number(arr[1]),
      stepSize: Number(arr[2]),
      pricePoints: Number(arr[3]),
    };
  }, [data]);

  return {
    params,
    isLoading: isLoading,
  };
}
