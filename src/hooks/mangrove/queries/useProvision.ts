import { readerAbi } from '@/abi/reader';
import { ADDRESSES } from '@/lib/addresses';
import { useMemo } from 'react';
import type { Address } from 'viem';
import { useReadContracts } from 'wagmi';

interface UseProvisionParams {
  base?: Address;
  quote?: Address;
  tickSpacing?: bigint;
  gasreq?: number;
}

export function useProvision({
  base,
  quote,
  tickSpacing,
  gasreq,
}: UseProvisionParams) {
  const enabled =
    base !== undefined &&
    quote !== undefined &&
    tickSpacing !== undefined &&
    gasreq !== undefined;

  const { data, isLoading } = useReadContracts({
    contracts: !enabled
      ? []
      : ([
          {
            address: ADDRESSES.mgvReader,
            abi: readerAbi,
            functionName: 'getProvisionWithDefaultGasPrice',
            args: [
              {
                outbound_tkn: base,
                inbound_tkn: quote,
                tickSpacing: tickSpacing,
              },
              BigInt(gasreq),
            ],
          },
          {
            address: ADDRESSES.mgvReader,
            abi: readerAbi,
            functionName: 'getProvisionWithDefaultGasPrice',
            args: [
              {
                outbound_tkn: quote,
                inbound_tkn: base,
                tickSpacing: tickSpacing,
              },
              BigInt(gasreq),
            ],
          },
        ] as const),
    allowFailure: false,
    query: { enabled },
  });

  const provision = useMemo(
    () => (data ? { perAsk: data[0], perBid: data[1] } : undefined),
    [data]
  );

  return {
    provision,
    isLoading,
  };
}
