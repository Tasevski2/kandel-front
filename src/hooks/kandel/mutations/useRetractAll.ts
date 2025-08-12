import { useState } from 'react';
import { useWriteContract } from 'wagmi';
import { waitForTransactionReceipt } from '@wagmi/core';
import { KandelABI } from '@/abi/kandel';
import { config } from '@/config/wagmiConfig';
import { TRANSACTION_CONFIRMATIONS } from '@/lib/constants';
import { Address } from 'viem';
import { useWithdrawEth } from '../../mangrove/mutations/useWithdrawEth';

interface RetractAllParams {
  kandelAddr: Address;
  pricePoints: number;
  deprovision: boolean;
}

export function useRetractAll() {
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

      // If deprovisioning is requested, also withdraw ETH provisions
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