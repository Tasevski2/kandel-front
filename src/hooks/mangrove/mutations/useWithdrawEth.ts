import { useState } from 'react';
import { useWriteContract } from 'wagmi';
import { readContract, waitForTransactionReceipt } from '@wagmi/core';
import { KandelABI } from '@/abi/kandel';
import { MangroveABI } from '@/abi/mangrove';
import { ADDRESSES } from '@/lib/addresses';
import { TRANSACTION_CONFIRMATIONS } from '@/lib/constants';
import { config } from '@/config/wagmiConfig';
import { Address } from 'viem';

interface WithdrawEthParams {
  kandelAddr: Address;
  amount?: bigint;
  recipient?: Address;
}

export function useWithdrawEth() {
  const { writeContractAsync } = useWriteContract();
  const [isLoading, setIsLoading] = useState(false);

  const withdrawEth = async (params: WithdrawEthParams) => {
    const { kandelAddr, amount, recipient } = params;

    setIsLoading(true);
    try {
      // If no amount specified, get the current balance
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

      // Use Kandel's withdrawFromMangrove function
      const hash = await writeContractAsync({
        address: kandelAddr,
        abi: KandelABI,
        functionName: 'withdrawFromMangrove',
        args: [balance, recipient || kandelAddr], // Default to contract address if no recipient
      });

      const receipt = await waitForTransactionReceipt(config, {
        hash,
        confirmations: TRANSACTION_CONFIRMATIONS,
      });

      return receipt;
    } catch (error) {
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