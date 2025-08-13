import { useState } from 'react';
import { useConfig, useWriteContract } from 'wagmi';
import { waitForTransactionReceipt } from '@wagmi/core';
import { KandelABI } from '@/abi/kandel';
import {
  TRANSACTION_CONFIRMATIONS,
  QUERY_SCOPE_KEYS,
  MAX_UINT256,
} from '@/lib/constants';
import { Address } from 'viem';
import { useInvalidateQueries } from '@/hooks/useInvalidateQueries';
import { useTxToast } from '@/hooks/useTxToast';

interface WithdrawTokenParams {
  kandelAddr: Address;
  tokenType: 'base' | 'quote';
  recipient: Address;
}

export function useWithdrawToken() {
  const config = useConfig();
  const { invalidateQueriesByScopeKey } = useInvalidateQueries();
  const { setTxToast } = useTxToast();
  const { writeContractAsync } = useWriteContract();
  const [isLoading, setIsLoading] = useState(false);
  // withdraw all funds
  // not production ready, we are not checking if
  // the user has enough funds to cover the offers
  const withdrawToken = async (params: WithdrawTokenParams) => {
    const { kandelAddr, tokenType, recipient } = params;

    setIsLoading(true);
    const toastId = setTxToast('signing', {
      message: 'Signing token withdrawal…',
    });
    let txHash: Address | undefined;
    try {
      const baseAmount = tokenType === 'base' ? MAX_UINT256 : BigInt(0);
      const quoteAmount = tokenType === 'quote' ? MAX_UINT256 : BigInt(0);

      txHash = await writeContractAsync({
        address: kandelAddr,
        abi: KandelABI,
        functionName: 'withdrawFunds',
        args: [baseAmount, quoteAmount, recipient],
      });
      setTxToast('submitted', {
        message: 'Withdrawal submitted. Waiting for confirmation…',
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

      await invalidateQueriesByScopeKey(
        QUERY_SCOPE_KEYS.RESERVE_BALANCES,
        true
      );

      setTxToast('success', {
        message: 'Tokens withdrawn successfully.',
        id: toastId,
        hash: txHash,
      });

      return receipt;
    } catch (error) {
      setTxToast('failed', {
        message: 'Failed to withdraw tokens.',
        id: toastId,
        hash: txHash,
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    withdrawToken,
    isLoading,
  };
}
