import { useState } from 'react';
import { useConfig, useWriteContract } from 'wagmi';
import { waitForTransactionReceipt } from '@wagmi/core';
import { MangroveABI } from '@/abi/mangrove';
import { ADDRESSES } from '@/lib/addresses';
import { TRANSACTION_CONFIRMATIONS, QUERY_SCOPE_KEYS } from '@/lib/constants';
import { Address } from 'viem';
import { useInvalidateQueries } from '@/hooks/useInvalidateQueries';

export function useFundMaker() {
  const config = useConfig();
  const { invalidateQueriesByScopeKey } = useInvalidateQueries();
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

      await invalidateQueriesByScopeKey(QUERY_SCOPE_KEYS.BALANCE_OF);

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
