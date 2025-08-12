import { useState } from 'react';
import { useConfig, useWriteContract } from 'wagmi';
import { waitForTransactionReceipt } from '@wagmi/core';
import { KandelABI } from '@/abi/kandel';
import { TRANSACTION_CONFIRMATIONS, QUERY_SCOPE_KEYS } from '@/lib/constants';
import { Address } from 'viem';
import { useInvalidateQueries } from '@/hooks/useInvalidateQueries';

interface SetStepSizeParams {
  kandelAddr: Address;
  stepSize: number;
}

export function useSetStepSize() {
  const config = useConfig();
  const { invalidateQueriesByScopeKey } = useInvalidateQueries();
  const { writeContractAsync } = useWriteContract();
  const [isLoading, setIsLoading] = useState(false);

  const setStepSize = async (params: SetStepSizeParams) => {
    const { kandelAddr, stepSize } = params;

    if (stepSize <= 0) {
      throw new Error('Step size must be greater than 0');
    }

    setIsLoading(true);
    try {
      const hash = await writeContractAsync({
        address: kandelAddr,
        abi: KandelABI,
        functionName: 'setStepSize',
        args: [BigInt(stepSize)],
      });

      const receipt = await waitForTransactionReceipt(config, {
        hash,
        confirmations: TRANSACTION_CONFIRMATIONS,
      });

      await invalidateQueriesByScopeKey(QUERY_SCOPE_KEYS.PARAMS);

      return receipt;
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    setStepSize,
    isLoading,
  };
}
