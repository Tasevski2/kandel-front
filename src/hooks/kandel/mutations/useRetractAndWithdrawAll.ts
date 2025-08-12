import { useState } from 'react';
import { useConfig, useWriteContract } from 'wagmi';
import { waitForTransactionReceipt } from '@wagmi/core';
import { KandelABI } from '@/abi/kandel';
import {
  MAX_UINT256,
  TRANSACTION_CONFIRMATIONS,
  QUERY_SCOPE_KEYS,
} from '@/lib/constants';
import { Address } from 'viem';
import { useInvalidateQueries } from '@/hooks/useInvalidateQueries';

interface RetractAndWithdrawAllParams {
  kandelAddr: Address;
  recipient: Address;
  pricePoints: number;
}

export function useRetractAndWithdrawAll() {
  const config = useConfig();
  const { invalidateQueriesByScopeKey } = useInvalidateQueries();
  const { writeContractAsync } = useWriteContract();
  const [isLoading, setIsLoading] = useState(false);

  const retractAndWithdrawAll = async (params: RetractAndWithdrawAllParams) => {
    const { kandelAddr, recipient, pricePoints } = params;

    setIsLoading(true);
    try {
      const hash = await writeContractAsync({
        address: kandelAddr,
        abi: KandelABI,
        functionName: 'retractAndWithdraw',
        args: [
          BigInt(0), // from: start at index 0
          BigInt(pricePoints), // to: retract all offers (levelsPerSide * 2)
          MAX_UINT256, // baseAmount: withdraw all base tokens
          MAX_UINT256, // quoteAmount: withdraw all quote tokens
          MAX_UINT256, // freeWei: withdraw all ETH provisions
          recipient, // recipient: send all withdrawals to user
        ],
      });

      const receipt = await waitForTransactionReceipt(config, {
        hash,
        confirmations: TRANSACTION_CONFIRMATIONS,
      });

      await Promise.all([
        invalidateQueriesByScopeKey(QUERY_SCOPE_KEYS.BASE_QUOTE_TICK_OFFSET),
        invalidateQueriesByScopeKey(QUERY_SCOPE_KEYS.OFFERED_VOLUMES, true),
        invalidateQueriesByScopeKey(QUERY_SCOPE_KEYS.RESERVE_BALANCES, true),
        invalidateQueriesByScopeKey(QUERY_SCOPE_KEYS.BALANCE_OF),
        invalidateQueriesByScopeKey(QUERY_SCOPE_KEYS.OFFER_LIST),
      ]);

      return receipt;
    } catch (error) {
      console.error('Failed to completely shut down Kandel position:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    retractAndWithdrawAll,
    isLoading,
  };
}
