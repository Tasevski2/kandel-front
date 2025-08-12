import { useState } from 'react';
import { useConfig, useWriteContract } from 'wagmi';
import { readContract, waitForTransactionReceipt } from '@wagmi/core';
import { KandelABI } from '@/abi/kandel';
import { TRANSACTION_CONFIRMATIONS, QUERY_SCOPE_KEYS } from '@/lib/constants';
import { Address } from 'viem';
import { useInvalidateQueries } from '@/hooks/useInvalidateQueries';

interface WithdrawTokenParams {
  kandelAddr: Address;
  tokenType: 'base' | 'quote';
  recipient?: Address;
}

export function useWithdrawToken() {
  const config = useConfig();
  const { invalidateQueriesByScopeKey } = useInvalidateQueries();
  const { writeContractAsync } = useWriteContract();
  const [isLoading, setIsLoading] = useState(false);

  const withdrawToken = async (params: WithdrawTokenParams) => {
    const { kandelAddr, tokenType, recipient } = params;

    setIsLoading(true);
    try {
      // Get the current token reserve balance
      const reserveType = tokenType === 'base' ? 1 : 0; // 1 = Ask = Base, 0 = Bid = Quote
      const balance = (await readContract(config, {
        address: kandelAddr,
        abi: KandelABI,
        functionName: 'reserveBalance',
        args: [reserveType],
      })) as bigint;

      if (balance <= BigInt(0)) {
        throw new Error(`No ${tokenType} token balance to withdraw`);
      }

      // Use Kandel's withdrawFunds function
      const baseAmount = tokenType === 'base' ? balance : BigInt(0);
      const quoteAmount = tokenType === 'quote' ? balance : BigInt(0);

      const hash = await writeContractAsync({
        address: kandelAddr,
        abi: KandelABI,
        functionName: 'withdrawFunds',
        args: [baseAmount, quoteAmount, recipient || kandelAddr],
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
      setIsLoading(false);
    }
  };

  return {
    withdrawToken,
    isLoading,
  };
}
