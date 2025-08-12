'use client';

import { useState } from 'react';
import { useConfig, useWriteContract } from 'wagmi';
import { waitForTransactionReceipt } from '@wagmi/core';
import type { Address } from 'viem';
import { KandelABI } from '@/abi/kandel';
import { TRANSACTION_CONFIRMATIONS, QUERY_SCOPE_KEYS } from '@/lib/constants';
import { useErc20Approve } from '../../token/useErc20Approve';
import { useInvalidateQueries } from '@/hooks/useInvalidateQueries';

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
  const { erc20Approve } = useErc20Approve();
  const { writeContractAsync } = useWriteContract();

  const [isLoading, setLoading] = useState(false);

  const depositFunds = async (args: DepositFundsArgs) => {
    const { kandel, baseToken, quoteToken, baseAmount, quoteAmount } = args;

    if (baseAmount <= BigInt(0) && quoteAmount <= BigInt(0)) {
      return;
    }
    setLoading(true);
    try {
      await erc20Approve(baseToken, kandel, baseAmount);
      await erc20Approve(quoteToken, kandel, quoteAmount);

      const hash = await writeContractAsync({
        address: kandel,
        abi: KandelABI,
        functionName: 'depositFunds',
        args: [baseAmount, quoteAmount],
      });

      const receipt = await waitForTransactionReceipt(config, {
        hash,
        confirmations: TRANSACTION_CONFIRMATIONS,
      });

      await invalidateQueriesByScopeKey(
        QUERY_SCOPE_KEYS.RESERVE_BALANCES,
        true
      );

      return receipt;
    } catch (error) {
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
