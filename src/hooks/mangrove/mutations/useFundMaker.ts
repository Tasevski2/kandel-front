import { useState } from 'react';
import { useWriteContract } from 'wagmi';
import { waitForTransactionReceipt } from '@wagmi/core';
import { MangroveABI } from '@/abi/mangrove';
import { ADDRESSES } from '@/lib/addresses';
import { TRANSACTION_CONFIRMATIONS } from '@/lib/constants';
import { config } from '@/config/wagmiConfig';
import { Address } from 'viem';

export function useFundMaker() {
  const { writeContractAsync } = useWriteContract();
  const [isLoading, setIsLoading] = useState(false);

  const fundMaker = async (maker: Address, amount: bigint) => {
    if (amount <= BigInt(0)) return;

    setIsLoading(true);
    try {
      const hash = await writeContractAsync({
        address: ADDRESSES.mangrove,
        abi: MangroveABI,
        functionName: 'fund',
        args: [maker],
        value: amount,
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
    fundMaker,
    isLoading,
  };
}
