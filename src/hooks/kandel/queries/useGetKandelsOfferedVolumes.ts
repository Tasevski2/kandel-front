'use client';

import { useCallback, useMemo } from 'react';
import { useReadContracts } from 'wagmi';
import { KandelABI } from '@/abi/kandel';
import type { StoredKandel } from '../useKandels';

type VolumesByKandel = Map<string, KandelOfferedVolume>;

export type KandelOfferedVolume = { bidVolume: bigint; askVolume: bigint };

export function useGetKandelsOfferedVolumes(kandels: StoredKandel[]) {
  const enabled = kandels.length > 0;

  const contracts = useMemo(() => {
    if (!enabled) return [];
    return kandels.flatMap((k) => {
      const addr = k.address;
      return [
        {
          address: addr,
          abi: KandelABI,
          functionName: 'offeredVolume',
          args: [1],
        },
        {
          address: addr,
          abi: KandelABI,
          functionName: 'offeredVolume',
          args: [0],
        },
      ];
    });
  }, [enabled, kandels]);

  const { data, isLoading } = useReadContracts({
    contracts,
    allowFailure: true,
    query: {
      enabled,
    },
  });

  const volumes: VolumesByKandel = useMemo(() => {
    const map: VolumesByKandel = new Map();
    if (!enabled || !data) return map;

    for (let i = 0; i < kandels.length; i++) {
      const askRes = data[i * 2];
      const bidRes = data[i * 2 + 1];

      const ask =
        askRes && askRes.status === 'success'
          ? (askRes.result as bigint)
          : BigInt(0);
      const bid =
        bidRes && bidRes.status === 'success'
          ? (bidRes.result as bigint)
          : BigInt(0);

      map.set(kandels[i].address, { bidVolume: bid, askVolume: ask });
    }
    return map;
  }, [data, enabled, kandels]);

  const getOfferedVolume = useCallback(
    (address: string): KandelOfferedVolume | undefined => {
      return volumes.get(address);
    },
    [volumes]
  );

  return {
    getOfferedVolume,
    isLoading: enabled ? isLoading : false,
  };
}
