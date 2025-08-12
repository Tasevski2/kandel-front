import { useWriteContract } from 'wagmi';
import { KandelABI } from '@/abi/kandel';
import { Address } from 'viem';
import { useWithdrawEth } from '../../mangrove/mutations/useWithdrawEth';

interface RetractAllParams {
  kandelAddr: Address;
  pricePoints: number;
  deprovision: boolean;
}

export function useRetractAll() {
  const { writeContractAsync, isPending } = useWriteContract();
  const { withdrawEth } = useWithdrawEth();

  const retractAll = async (params: RetractAllParams) => {
    const { kandelAddr, pricePoints, deprovision } = params;

    const hash = await writeContractAsync({
      address: kandelAddr,
      abi: KandelABI,
      functionName: 'retractOffers',
      args: [BigInt(0), BigInt(pricePoints)], // Retract from index 0 to all price points
    });

    // If deprovisioning is requested, also withdraw ETH provisions
    if (deprovision) {
      await withdrawEth({ kandelAddr });
    }

    return hash;
  };

  return {
    retractAll,
    isLoading: isPending,
  };
}