import { useState } from 'react';
import { useConfig, useWriteContract } from 'wagmi';
import { waitForTransactionReceipt } from '@wagmi/core';
import { KandelABI } from '@/abi/kandel';
import { TRANSACTION_CONFIRMATIONS, QUERY_SCOPE_KEYS } from '@/lib/constants';
import { Address } from 'viem';
import { useInvalidateQueries } from '@/hooks/useInvalidateQueries';
import { useTxToast } from '@/hooks/useTxToast';

interface SetStepSizeParams {
  kandelAddr: Address;
  stepSize: number;
}

export function useSetStepSize() {
  const config = useConfig();
  const { invalidateQueriesByScopeKey } = useInvalidateQueries();
  const { setTxToast } = useTxToast();
  const { writeContractAsync } = useWriteContract();
  const [isLoading, setIsLoading] = useState(false);

  const setStepSize = async (params: SetStepSizeParams) => {
    const { kandelAddr, stepSize } = params;

    if (stepSize <= 0) {
      throw new Error('Step size must be greater than 0');
    }

    setIsLoading(true);
    const toastId = setTxToast('signing', {
      message: 'Signing step size update…',
    });
    let txHash: Address | undefined;
    try {
      txHash = await writeContractAsync({
        address: kandelAddr,
        abi: KandelABI,
        functionName: 'setStepSize',
        args: [BigInt(stepSize)],
      });
      setTxToast('submitted', {
        message: 'Step size update submitted. Waiting for confirmation…',
        id: toastId,
        hash: txHash,
      });

      const receipt = await waitForTransactionReceipt(config, {
        hash: txHash,
        confirmations: TRANSACTION_CONFIRMATIONS,
      });

      if (receipt.status !== 'success') {
        throw new Error();
      }

      await invalidateQueriesByScopeKey(QUERY_SCOPE_KEYS.PARAMS);

      setTxToast('success', {
        message: 'Step size updated successfully.',
        id: toastId,
        hash: txHash,
      });

      return receipt;
    } catch (error) {
      setTxToast('failed', {
        message: 'Failed to update step size.',
        id: toastId,
        hash: txHash,
      });
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
