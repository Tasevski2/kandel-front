import { useState } from 'react';
import { useConfig, useWriteContract } from 'wagmi';
import { waitForTransactionReceipt } from '@wagmi/core';
import { KandelABI } from '@/abi/kandel';
import { TRANSACTION_CONFIRMATIONS, QUERY_SCOPE_KEYS } from '@/lib/constants';
import { Address } from 'viem';
import { useWithdrawEth } from '../../mangrove/mutations/useWithdrawEth';
import { useInvalidateQueries } from '@/hooks/useInvalidateQueries';
import { useTxToast } from '@/hooks/useTxToast';

interface RetractAllParams {
  kandelAddr: Address;
  pricePoints: number;
  deprovision: boolean;
}

export function useRetractAll() {
  const config = useConfig();
  const { invalidateQueriesByScopeKey } = useInvalidateQueries();
  const { setTxToast } = useTxToast();
  const { writeContractAsync } = useWriteContract();
  const { withdrawEth } = useWithdrawEth();
  const [isLoading, setIsLoading] = useState(false);

  const retractAll = async (params: RetractAllParams) => {
    const { kandelAddr, pricePoints, deprovision } = params;

    setIsLoading(true);
    const toastId = setTxToast('signing', {
      message: 'Signing offer retraction…',
    });
    let txHash: Address | undefined;
    try {
      txHash = await writeContractAsync({
        address: kandelAddr,
        abi: KandelABI,
        functionName: 'retractOffers',
        args: [BigInt(0), BigInt(pricePoints)],
      });
      setTxToast('submitted', {
        message: 'Retraction submitted. Waiting for confirmation…',
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

      await Promise.all([
        invalidateQueriesByScopeKey(QUERY_SCOPE_KEYS.PARAMS),
        invalidateQueriesByScopeKey(QUERY_SCOPE_KEYS.BASE_QUOTE_TICK_OFFSET),
        invalidateQueriesByScopeKey(QUERY_SCOPE_KEYS.OFFERED_VOLUMES, true),
        invalidateQueriesByScopeKey(QUERY_SCOPE_KEYS.BALANCE_OF),
        invalidateQueriesByScopeKey(QUERY_SCOPE_KEYS.OFFER_LIST),
      ]);

      setTxToast('success', {
        message: 'All offers retracted successfully.',
        id: toastId,
        hash: txHash,
      });

      if (deprovision) {
        await withdrawEth({ kandelAddr });
      }

      return receipt;
    } catch (error) {
      setTxToast('failed', {
        message: 'Failed to retract offers.',
        id: toastId,
        hash: txHash,
      });
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
