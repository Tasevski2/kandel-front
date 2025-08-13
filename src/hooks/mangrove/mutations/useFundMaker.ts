import { useState } from 'react';
import { useConfig, useWriteContract } from 'wagmi';
import { waitForTransactionReceipt } from '@wagmi/core';
import { MangroveABI } from '@/abi/mangrove';
import { ADDRESSES } from '@/lib/addresses';
import { TRANSACTION_CONFIRMATIONS, QUERY_SCOPE_KEYS } from '@/lib/constants';
import { Address } from 'viem';
import { useInvalidateQueries } from '@/hooks/useInvalidateQueries';
import { useTxToast } from '@/hooks/useTxToast';

export function useFundMaker() {
  const config = useConfig();
  const { invalidateQueriesByScopeKey } = useInvalidateQueries();
  const { setTxToast } = useTxToast();
  const { writeContractAsync } = useWriteContract();
  const [isLoading, setIsLoading] = useState(false);

  const fundMaker = async (maker: Address, amount: bigint) => {
    if (amount <= BigInt(0)) return;

    setIsLoading(true);
    const toastId = setTxToast('signing', {
      message: 'Signing ETH deposit transaction…',
    });
    let txHash: Address | undefined;
    try {
      txHash = await writeContractAsync({
        address: ADDRESSES.mangrove,
        abi: MangroveABI,
        functionName: 'fund',
        args: [maker],
        value: amount,
      });
      setTxToast('submitted', {
        message: 'ETH deposit submitted. Waiting for confirmation…',
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

      await invalidateQueriesByScopeKey(QUERY_SCOPE_KEYS.BALANCE_OF);

      setTxToast('success', {
        message: 'ETH deposited successfully.',
        id: toastId,
        hash: txHash,
      });

      return receipt;
    } catch (error) {
      setTxToast('failed', {
        message: 'Failed to deposit ETH.',
        id: toastId,
        hash: txHash,
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    fundMaker,
    isLoading,
  };
}
