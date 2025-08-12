'use client';

import { useState } from 'react';
import { useWriteContract } from 'wagmi';
import type { Address } from 'viem';
import { KandelABI } from '@/abi/kandel';
import { useErc20Approve } from '../../token/useErc20Approve';

type DepositFundsArgs = {
  kandel: Address;
  baseToken: Address;
  quoteToken: Address;
  baseAmount: bigint; // wei
  quoteAmount: bigint; // wei
};

export function useDepositFunds() {
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

      await writeContractAsync({
        address: kandel,
        abi: KandelABI,
        functionName: 'depositFunds',
        args: [baseAmount, quoteAmount],
      });
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
