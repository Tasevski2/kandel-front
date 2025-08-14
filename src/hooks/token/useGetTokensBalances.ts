'use client';

import { useMemo } from 'react';
import { useReadContracts } from 'wagmi';
import { Address } from 'viem';
import { erc20Abi } from '@/abi/erc20';

interface UseGetTokensBalancesParams {
  tokenAddresses: Address[];
  userAddress?: Address;
}

export function useGetTokensBalances({
  tokenAddresses,
  userAddress,
}: UseGetTokensBalancesParams) {
  const enabled = tokenAddresses.length > 0 && !!userAddress;

  const contracts = useMemo(
    () =>
      !enabled
        ? []
        : tokenAddresses.map((tokenAddress) => ({
            address: tokenAddress,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [userAddress],
          })),
    [tokenAddresses, userAddress, enabled]
  );

  const {
    data,
    isLoading,
    error,
    refetch,
  } = useReadContracts({
    contracts,
    allowFailure: true,
    query: {
      enabled,
      staleTime: 0,    // Data is immediately stale
      gcTime: 0,       // Garbage collect immediately
    },
  });

  const balances: Record<Address, bigint> = useMemo(() => {
    if (!enabled || !data) return {};
    
    const result: Record<Address, bigint> = {};
    
    tokenAddresses.forEach((tokenAddress, index) => {
      const balance = data[index]?.result;
      if (balance !== undefined && typeof balance === 'bigint') {
        result[tokenAddress] = balance;
      } else {
        result[tokenAddress] = BigInt(0);
      }
    });
    
    return result;
  }, [tokenAddresses, data, enabled]);

  return {
    balances,
    isLoading,
    error: error ? 'Failed to fetch token balances' : null,
    refetch,
  };
}