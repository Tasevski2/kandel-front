'use client';

import { useState, useEffect, useCallback } from 'react';
import { readContract } from '@wagmi/core';
import { KandelABI } from '../abi/kandel';
import { config } from './useChain';
import type { StoredKandel } from './useKandels';

export interface KandelOfferedVolume {
  address: string;
  askVolume: bigint;
  bidVolume: bigint;
  loading: boolean;
  error?: string;
}

export function useKandelOfferedVolume(kandels: StoredKandel[]) {
  const [offeredVolumes, setOfferedVolumes] = useState<
    Map<string, KandelOfferedVolume>
  >(new Map());
  const [loading, setLoading] = useState(false);

  const fetchOfferedVolume = useCallback(
    async (
      kandelAddress: string
    ): Promise<{ askVolume: bigint; bidVolume: bigint }> => {
      try {
        const [askVolume, bidVolume] = await Promise.all([
          readContract(config, {
            address: kandelAddress as `0x${string}`,
            abi: KandelABI,
            functionName: 'offeredVolume',
            args: [1], // 1 for asks (base token offers)
          }),
          readContract(config, {
            address: kandelAddress as `0x${string}`,
            abi: KandelABI,
            functionName: 'offeredVolume',
            args: [0], // 0 for bids (quote token offers)
          }),
        ]);

        return {
          askVolume: (askVolume as bigint) || BigInt(0),
          bidVolume: (bidVolume as bigint) || BigInt(0),
        };
      } catch (error) {
        return {
          askVolume: BigInt(0),
          bidVolume: BigInt(0),
        };
      }
    },
    []
  );

  const fetchAllOfferedVolumes = useCallback(async () => {
    if (kandels.length === 0) {
      setOfferedVolumes(new Map());
      return;
    }

    setLoading(true);
    const newOfferedVolumes = new Map<string, KandelOfferedVolume>();

    // Initialize all kandels with loading state
    kandels.forEach((kandel) => {
      newOfferedVolumes.set(kandel.address, {
        address: kandel.address,
        askVolume: BigInt(0),
        bidVolume: BigInt(0),
        loading: true,
      });
    });

    setOfferedVolumes(newOfferedVolumes);

    // Fetch offered volumes in parallel
    const fetchPromises = kandels.map(async (kandel) => {
      try {
        const { askVolume, bidVolume } = await fetchOfferedVolume(
          kandel.address
        );
        return {
          address: kandel.address,
          askVolume,
          bidVolume,
          loading: false,
        };
      } catch (error) {
        return {
          address: kandel.address,
          askVolume: BigInt(0),
          bidVolume: BigInt(0),
          loading: false,
          error:
            error instanceof Error
              ? error.message
              : 'Failed to fetch offered volume',
        };
      }
    });

    try {
      const results = await Promise.all(fetchPromises);

      setOfferedVolumes((prevVolumes) => {
        const updatedVolumes = new Map(prevVolumes);
        results.forEach((result) => {
          updatedVolumes.set(result.address, result);
        });
        return updatedVolumes;
      });
    } catch (error) {
      console.error('Failed to fetch offered volumes:', error);
    } finally {
      setLoading(false);
    }
  }, [kandels, fetchOfferedVolume]);

  // Fetch offered volumes when kandels change
  useEffect(() => {
    fetchAllOfferedVolumes();
  }, [fetchAllOfferedVolumes]);

  // Helper to get offered volume for a specific kandel
  const getOfferedVolume = useCallback(
    (address: string): KandelOfferedVolume | undefined => {
      return offeredVolumes.get(address);
    },
    [offeredVolumes]
  );

  return {
    offeredVolumes: Array.from(offeredVolumes.values()),
    loading,
    getOfferedVolume,
    refetch: fetchAllOfferedVolumes,
  };
}
