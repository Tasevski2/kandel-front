import { useReadContract, useWriteContract } from 'wagmi';
import { useCallback } from 'react';
import { readContract } from '@wagmi/core';
import { MangroveABI } from '../abi/mangrove';
import { readerAbi } from '../abi/reader';
import { ADDRESSES } from '../lib/addresses';
import { config } from './useChain';

export function useMangrove() {
  const { writeContractAsync } = useWriteContract();

  const getGasPrice = useCallback(async (): Promise<bigint> => {
    try {
      const data = await readContract(config, {
        address: ADDRESSES.mgvReader,
        abi: readerAbi,
        functionName: 'globalUnpacked',
      });

      if (data && typeof data === 'object' && 'gasprice' in data) {
        const gasPrice = BigInt(data.gasprice as any);
        return gasPrice;
      }

      return BigInt(0);
    } catch (error) {
      return BigInt(0);
    }
  }, []);

  const getLocalConfig = useCallback(
    async (
      outbound: `0x${string}`,
      inbound: `0x${string}`,
      tickSpacing: bigint
    ) => {
      try {
        const data = await readContract(config, {
          address: ADDRESSES.mgvReader,
          abi: readerAbi,
          functionName: 'localUnpacked',
          args: [
            {
              outbound_tkn: outbound,
              inbound_tkn: inbound,
              tickSpacing,
            },
          ],
        });

        if (!data || typeof data !== 'object') {
          return { offerGasbase: BigInt(0), density: BigInt(0), active: false };
        }

        const localConfig = data as any;
        const active = Boolean(localConfig.active);
        const density = BigInt(localConfig.density || 0);
        // Note: kilo_offer_gasbase is in thousands, so multiply by 1000
        const offerGasbase =
          BigInt(localConfig.kilo_offer_gasbase || 0) * BigInt(1000);

        return {
          offerGasbase,
          density,
          active,
        };
      } catch (error) {
        return { offerGasbase: BigInt(0), density: BigInt(0), active: false };
      }
    },
    []
  );

  const getMakerFreeBalance = async (maker: `0x${string}`): Promise<bigint> => {
    const data = await readContract(config, {
      address: ADDRESSES.mangrove,
      abi: MangroveABI,
      functionName: 'balanceOf',
      args: [maker],
    });

    return (data as bigint) || BigInt(0);
  };

  const getProvision = useCallback(
    async (
      outbound: `0x${string}`,
      inbound: `0x${string}`,
      tickSpacing: bigint,
      gasreq: bigint
    ): Promise<bigint> => {
      try {
        const provision = await readContract(config, {
          address: ADDRESSES.mgvReader,
          abi: readerAbi,
          functionName: 'getProvisionWithDefaultGasPrice',
          args: [
            {
              outbound_tkn: outbound,
              inbound_tkn: inbound,
              tickSpacing,
            },
            gasreq,
          ],
        });

        return provision as bigint;
      } catch (error) {
        return BigInt(0);
      }
    },
    []
  );

  const fundMaker = useCallback(
    async (maker: `0x${string}`, amount: bigint) => {
      try {
        const hash = await writeContractAsync({
          address: ADDRESSES.mangrove,
          abi: MangroveABI,
          functionName: 'fund',
          args: [maker],
          value: amount,
        });
        return hash;
      } catch (error) {
        throw error;
      }
    },
    [writeContractAsync]
  );

  return {
    getGasPrice,
    getLocalConfig,
    getMakerFreeBalance,
    getProvision,
    fundMaker,
  };
}
