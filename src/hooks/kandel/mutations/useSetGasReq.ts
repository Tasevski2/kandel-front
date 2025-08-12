import { useState } from 'react';
import { useWriteContract } from 'wagmi';
import { waitForTransactionReceipt } from '@wagmi/core';
import { KandelABI } from '@/abi/kandel';
import { TRANSACTION_CONFIRMATIONS } from '@/lib/constants';
import { config } from '@/config/wagmiConfig';
import { Address } from 'viem';

interface SetGasReqParams {
  kandelAddr: Address;
  gasreq: number;
}

export function useSetGasReq() {
  const { writeContractAsync } = useWriteContract();
  const [isLoading, setIsLoading] = useState(false);

  const setGasReq = async (params: SetGasReqParams) => {
    const { kandelAddr, gasreq } = params;

    if (gasreq <= 0) {
      throw new Error('Gas requirement must be greater than 0');
    }

    setIsLoading(true);
    try {
      const hash = await writeContractAsync({
        address: kandelAddr,
        abi: KandelABI,
        functionName: 'setGasreq',
        args: [BigInt(gasreq)],
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
    setGasReq,
    isLoading,
  };
}