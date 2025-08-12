import { useState } from 'react';
import { useConfig, useWriteContract } from 'wagmi';
import { waitForTransactionReceipt } from '@wagmi/core';
import { KandelABI } from '@/abi/kandel';
import { TRANSACTION_CONFIRMATIONS, QUERY_SCOPE_KEYS } from '@/lib/constants';
import { Address } from 'viem';
import { useWithdrawEth } from '../../mangrove/mutations/useWithdrawEth';
import { useInvalidateQueries } from '@/hooks/useInvalidateQueries';

interface RetractAllParams {
  kandelAddr: Address;
  pricePoints: number;
  deprovision: boolean;
}

export function useRetractAll() {
  const config = useConfig();
  const { invalidateQueriesByScopeKey } = useInvalidateQueries();
  const { writeContractAsync } = useWriteContract();
  const { withdrawEth } = useWithdrawEth();
  const [isLoading, setIsLoading] = useState(false);

  const retractAll = async (params: RetractAllParams) => {
    const { kandelAddr, pricePoints, deprovision } = params;

    setIsLoading(true);
    try {
      const hash = await writeContractAsync({
        address: kandelAddr,
        abi: KandelABI,
        functionName: 'retractOffers',
        args: [BigInt(0), BigInt(pricePoints)], // Retract from index 0 to all price points
      });

      const receipt = await waitForTransactionReceipt(config, {
        hash,
        confirmations: TRANSACTION_CONFIRMATIONS,
      });

      await Promise.all([
        invalidateQueriesByScopeKey(QUERY_SCOPE_KEYS.PARAMS),
        invalidateQueriesByScopeKey(QUERY_SCOPE_KEYS.BASE_QUOTE_TICK_OFFSET),
        invalidateQueriesByScopeKey(QUERY_SCOPE_KEYS.OFFERED_VOLUMES, true),
        invalidateQueriesByScopeKey(QUERY_SCOPE_KEYS.BALANCE_OF),
        invalidateQueriesByScopeKey(QUERY_SCOPE_KEYS.OFFER_LIST),
      ]);

      if (deprovision) {
        await withdrawEth({ kandelAddr });
      }

      return receipt;
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    retractAll,
    isLoading,
  };
}
