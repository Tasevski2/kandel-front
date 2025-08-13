import { useState } from 'react';
import { useWriteContract, useAccount, useConfig } from 'wagmi';
import { readContract, waitForTransactionReceipt } from '@wagmi/core';
import { erc20Abi } from '@/abi/erc20';
import { TRANSACTION_CONFIRMATIONS } from '@/lib/constants';
import { Address } from 'viem';
import { useTxToast } from '@/hooks/useTxToast';

export function useErc20Approve() {
  const config = useConfig();
  const { setTxToast } = useTxToast();
  const { writeContractAsync } = useWriteContract();
  const { address: userAddress } = useAccount();
  const [isLoading, setIsLoading] = useState(false);

  const erc20Approve = async (
    tokenAddress: Address,
    spender: Address,
    amount: bigint
  ): Promise<void> => {
    if (amount === BigInt(0)) return;
    if (!userAddress) throw new Error('User address not available');

    setIsLoading(true);
    const toastId = setTxToast('signing', {
      message: 'Signing token approval…',
    });
    let txHash: Address | undefined;
    try {
      const currentAllowance = await getAllowance(
        tokenAddress,
        userAddress,
        spender
      );

      if (currentAllowance < amount) {
        txHash = await writeContractAsync({
          address: tokenAddress,
          abi: erc20Abi,
          functionName: 'approve',
          args: [spender, amount],
        });
        setTxToast('submitted', {
          message: 'Approval submitted. Waiting for confirmation…',
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

        setTxToast('success', {
          message: 'Token approval granted.',
          id: toastId,
          hash: txHash,
        });
      }
    } catch (error) {
      setTxToast('failed', {
        message: 'Failed to approve token.',
        id: toastId,
        hash: txHash,
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const getAllowance = async (
    tokenAddress: Address,
    owner: Address,
    spender: Address
  ): Promise<bigint> => {
    return (await readContract(config, {
      address: tokenAddress,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [owner, spender],
    })) as bigint;
  };

  return {
    erc20Approve,
    isLoading,
  };
}
