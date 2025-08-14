import { useMemo } from 'react';
import { erc20Abi } from '../../abi/erc20';
import { useReadContracts } from 'wagmi';
import { Address } from 'viem';

export interface TokenInfo {
  symbol: string;
  name: string;
  decimals: number;
  address: Address;
}

export function useTokensInfo(addresses: Address[]) {
  const enabled = addresses.length > 0;

  const contracts = useMemo(
    () =>
      !enabled
        ? []
        : addresses.flatMap((addr) => [
            { address: addr, abi: erc20Abi, functionName: 'symbol' } as const,
            { address: addr, abi: erc20Abi, functionName: 'name' } as const,
            { address: addr, abi: erc20Abi, functionName: 'decimals' } as const,
          ]),
    [addresses, enabled]
  );

  const { data, isLoading, error, refetch } = useReadContracts({
    contracts,
    allowFailure: true,
    query: {
      enabled,
    },
  });

  const tokensInfo: Record<Address, TokenInfo> = useMemo(() => {
    if (!enabled || !data) return {};
    const out: Record<Address, TokenInfo> = {};

    for (let i = 0; i < addresses.length; i++) {
      const sym = data[i * 3 + 0]?.result as string | undefined;
      const name = data[i * 3 + 1]?.result as string | undefined;
      const dec = data[i * 3 + 2]?.result as number | undefined;

      const addr = addresses[i];

      if (sym === undefined || name === undefined || dec === undefined) {
        continue;
      }

      out[addr] = {
        address: addr,
        symbol: sym,
        name,
        decimals: dec,
      } as TokenInfo;
    }
    return out;
  }, [addresses, data, enabled]);

  return {
    tokensInfo,
    isLoading,
    error: error ? 'Failed to fetch some token metadata' : null,
    refetch,
  };
}
