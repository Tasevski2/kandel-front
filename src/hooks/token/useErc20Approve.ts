import { useState } from 'react';
import { useWriteContract, useAccount, useConfig } from 'wagmi';
import { readContract, waitForTransactionReceipt } from '@wagmi/core';
import { erc20Abi } from '@/abi/erc20';
import { TRANSACTION_CONFIRMATIONS } from '@/lib/constants';
import { Address } from 'viem';

export function useErc20Approve() {
  const config = useConfig();
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
    try {
      const currentAllowance = await getAllowance(
        tokenAddress,
        userAddress,
        spender
      );

      if (currentAllowance < amount) {
        const hash = await writeContractAsync({
          address: tokenAddress,
          abi: erc20Abi,
          functionName: 'approve',
          args: [spender, amount],
        });

        await waitForTransactionReceipt(config, {
          hash,
          confirmations: TRANSACTION_CONFIRMATIONS,
        });
      }
    } catch (error) {
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
