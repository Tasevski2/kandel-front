'use client';

import { useReadContracts } from 'wagmi';
import type { Address } from 'viem';
import { ADDRESSES } from '@/lib/addresses';
import { readerAbi } from '@/abi/reader';
import { KILO_TO_GAS_UNITS } from '@/lib/constants';

interface LocalConfigsParams {
  base?: Address;
  quote?: Address;
  tickSpacing?: bigint;
}

export function useGetLocalConfigs({
  base,
  quote,
  tickSpacing,
}: LocalConfigsParams) {
  const enabled =
    base !== undefined && quote !== undefined && tickSpacing !== undefined;

  const { data, isLoading } = useReadContracts({
    contracts: !enabled
      ? []
      : [
          {
            address: ADDRESSES.mgvReader,
            abi: readerAbi,
            functionName: 'localUnpacked',
            args: [
              {
                outbound_tkn: base,
                inbound_tkn: quote,
                tickSpacing: tickSpacing,
              },
            ],
          },
          {
            address: ADDRESSES.mgvReader,
            abi: readerAbi,
            functionName: 'localUnpacked',
            args: [
              {
                outbound_tkn: quote,
                inbound_tkn: base,
                tickSpacing: tickSpacing,
              },
            ],
          },
        ],
    allowFailure: false,
    query: {
      enabled,
    },
  });

  const parseLocal = (res: any) => {
    if (!res) {
      return { active: false, density: BigInt(0), offerGasbase: BigInt(0) };
    }
    const active = res.active;
    const density = res.density as bigint;

    const kGas = res.kilo_offer_gasbase as bigint;

    return {
      active,
      density,
      offerGasbase: kGas * BigInt(KILO_TO_GAS_UNITS),
    };
  };

  return {
    ask: parseLocal(data?.[0]),
    bid: parseLocal(data?.[0]),
    isLoading,
  };
}
