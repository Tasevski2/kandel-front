'use client';

import { useState } from 'react';
import { useConfig, useWriteContract } from 'wagmi';
import { waitForTransactionReceipt } from '@wagmi/core';
import type { Address } from 'viem';
import { KandelABI } from '@/abi/kandel';
import { TRANSACTION_CONFIRMATIONS, QUERY_SCOPE_KEYS } from '@/lib/constants';
import { useErc20Approve } from '../../token/useErc20Approve';
import { useInvalidateQueries } from '@/hooks/useInvalidateQueries';
import { useTxToast } from '@/hooks/useTxToast';

type DepositFundsArgs = {
  kandel: Address;
  baseToken: Address;
  quoteToken: Address;
  baseAmount: bigint; // wei
  quoteAmount: bigint; // wei
};

export function useDepositFunds() {
  const config = useConfig();
  const { invalidateQueriesByScopeKey } = useInvalidateQueries();
  const { setTxToast } = useTxToast();
  const { erc20Approve } = useErc20Approve();
  const { writeContractAsync } = useWriteContract();

  const [isLoading, setLoading] = useState(false);

  const depositFunds = async (args: DepositFundsArgs) => {
    const { kandel, baseToken, quoteToken, baseAmount, quoteAmount } = args;

    if (baseAmount <= BigInt(0) && quoteAmount <= BigInt(0)) {
      return;
    }

    setLoading(true);
    const toastId = setTxToast('signing', {
      message: 'Signing deposit…',
    });
    let txHash: Address | undefined;

    try {
      await erc20Approve(baseToken, kandel, baseAmount);
      await erc20Approve(quoteToken, kandel, quoteAmount);

      txHash = await writeContractAsync({
        address: kandel,
        abi: KandelABI,
        functionName: 'depositFunds',
        args: [baseAmount, quoteAmount],
      });
      setTxToast('submitted', {
        message: 'Deposit submitted. Waiting for confirmation…',
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
        message: 'Funds deposited successfully.',
        id: toastId,
        hash: txHash,
      });

      return receipt;
    } catch (error) {
      setTxToast('failed', {
        message: 'Failed to deposit funds.',
        id: toastId,
        hash: txHash,
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return {
    depositFunds,
    isLoading,
  };
}
