import { useState } from 'react';
import { useConfig, useWriteContract } from 'wagmi';
import { readContract, waitForTransactionReceipt } from '@wagmi/core';
import { KandelABI } from '@/abi/kandel';
import { MangroveABI } from '@/abi/mangrove';
import { ADDRESSES } from '@/lib/addresses';
import { TRANSACTION_CONFIRMATIONS, QUERY_SCOPE_KEYS } from '@/lib/constants';
import { Address } from 'viem';
import { useInvalidateQueries } from '@/hooks/useInvalidateQueries';
import { useTxToast } from '@/hooks/useTxToast';

interface WithdrawEthParams {
  kandelAddr: Address;
  amount?: bigint;
  recipient?: Address;
}

export function useWithdrawEth() {
  const config = useConfig();
  const { invalidateQueriesByScopeKey } = useInvalidateQueries();
  const { setTxToast } = useTxToast();
  const { writeContractAsync } = useWriteContract();
  const [isLoading, setIsLoading] = useState(false);

  const withdrawEth = async (params: WithdrawEthParams) => {
    const { kandelAddr, amount, recipient } = params;

    setIsLoading(true);
    const toastId = setTxToast('signing', {
      message: 'Signing ETH withdrawal…',
    });
    let txHash: Address | undefined;
    try {
      const balance =
        amount ||
        ((await readContract(config, {
          address: ADDRESSES.mangrove,
          abi: MangroveABI,
          functionName: 'balanceOf',
          args: [kandelAddr],
        })) as bigint);

      if (balance <= BigInt(0)) {
        throw new Error('No ETH balance to withdraw');
      }

      txHash = await writeContractAsync({
        address: kandelAddr,
        abi: KandelABI,
        functionName: 'withdrawFromMangrove',
        args: [balance, recipient || kandelAddr],
      });
      setTxToast('submitted', {
        message: 'ETH withdrawal submitted. Waiting for confirmation…',
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
        message: 'ETH withdrawn successfully.',
        id: toastId,
        hash: txHash,
      });

      return receipt;
    } catch (error) {
      setTxToast('failed', {
        message: 'Failed to withdraw ETH.',
        id: toastId,
        hash: txHash,
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    withdrawEth,
    isLoading,
  };
}
