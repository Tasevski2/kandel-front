'use client';

import { useReadContracts } from 'wagmi';
import type { Address } from 'viem';
import { ADDRESSES } from '@/lib/addresses';
import { readerAbi } from '@/abi/reader';

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
          // ASK side (BASE -> QUOTE)
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
          // BID side (QUOTE -> BASE)
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
    // Be tolerant to different case/keys from ABI generation
    const active = res.active;
    const density = res.density as bigint;

    const kGas = res.kilo_offer_gasbase as bigint;

    return {
      active,
      density,
      offerGasbase: kGas * BigInt(1000), // convert kilo → gas units
    };
  };

  return {
    ask: parseLocal(data?.[0]), // BASE -> QUOTE local config
    bid: parseLocal(data?.[0]), // QUOTE -> BASE local config
    isLoading,
  };
}
