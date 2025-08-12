import { useState } from 'react';
import { useWriteContract } from 'wagmi';
import { waitForTransactionReceipt } from '@wagmi/core';
import { KandelABI } from '@/abi/kandel';
import { TRANSACTION_CONFIRMATIONS } from '@/lib/constants';
import { config } from '@/config/wagmiConfig';
import type { Address } from 'viem';

export interface PopulateFromOffsetParams {
  kandelAddr: Address;
  from: bigint;
  to: bigint;
  minTick: bigint;
  tickOffsetBetweenLevels: bigint;
  firstAskIndex: bigint;
  bidGivesPerLevel: bigint;
  askGivesPerLevel: bigint;
  params: {
    gasprice: number;
    gasreq: number;
    stepSize: number;
    pricePoints: number;
  };
  baseAmount: bigint;
  quoteAmount: bigint;
  provisionValue: bigint;
}

export function usePopulateFromOffset() {
  const { writeContractAsync } = useWriteContract();
  const [isLoading, setIsLoading] = useState(false);

  const populateFromOffset = async (params: PopulateFromOffsetParams) => {
    setIsLoading(true);
    try {
      const hash = await writeContractAsync({
        address: params.kandelAddr,
        abi: KandelABI,
        functionName: 'populateFromOffset',
        args: [
          params.from,
          params.to,
          params.minTick,
          params.tickOffsetBetweenLevels,
          params.firstAskIndex,
          params.bidGivesPerLevel,
          params.askGivesPerLevel,
          {
            gasprice: params.params.gasprice,
            gasreq: params.params.gasreq,
            stepSize: params.params.stepSize,
            pricePoints: params.params.pricePoints,
          },
          params.baseAmount,
          params.quoteAmount,
        ],
        value: params.provisionValue,
      });

      const receipt = await waitForTransactionReceipt(config, {
        hash,
        confirmations: TRANSACTION_CONFIRMATIONS,
      });

      return receipt;
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    populateFromOffset,
    isLoading,
  };
}
