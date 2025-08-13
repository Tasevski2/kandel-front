import { useState } from 'react';
import { useConfig, useWriteContract } from 'wagmi';
import { waitForTransactionReceipt } from '@wagmi/core';
import { useInvalidateQueries } from '@/hooks/useInvalidateQueries';
import { KandelABI } from '@/abi/kandel';
import { TRANSACTION_CONFIRMATIONS, QUERY_SCOPE_KEYS } from '@/lib/constants';
import type { Address } from 'viem';
import { useTxToast } from '@/hooks/useTxToast';

interface SetGasReqParams {
  kandelAddr: Address;
  gasreq: number;
}

export function useSetGasReq() {
  const config = useConfig();
  const { invalidateQueriesByScopeKey } = useInvalidateQueries();
  const { setTxToast } = useTxToast();
  const { writeContractAsync } = useWriteContract();
  const [isLoading, setIsLoading] = useState(false);

  const setGasReq = async (params: SetGasReqParams) => {
    const { kandelAddr, gasreq } = params;

    if (gasreq <= 0) {
      throw new Error('Gas requirement must be greater than 0');
    }

    setIsLoading(true);
    const toastId = setTxToast('signing', {
      message: 'Signing gas requirement update…',
    });
    let txHash: Address | undefined;
    try {
      txHash = await writeContractAsync({
        address: kandelAddr,
        abi: KandelABI,
        functionName: 'setGasreq',
        args: [BigInt(gasreq)],
      });
      setTxToast('submitted', {
        message: 'Gas requirement update submitted. Waiting for confirmation…',
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
        message: 'Gas requirement updated successfully.',
        id: toastId,
        hash: txHash,
      });

      return receipt;
    } catch (error) {
      setTxToast('failed', {
        message: 'Failed to update gas requirement.',
        id: toastId,
        hash: txHash,
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    setGasReq,
    isLoading,
  };
}
