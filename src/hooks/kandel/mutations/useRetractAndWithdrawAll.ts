import { useWriteContract } from 'wagmi';
import { KandelABI } from '@/abi/kandel';
import { MAX_UINT256 } from '@/lib/constants';
import { Address } from 'viem';

interface RetractAndWithdrawAllParams {
  kandelAddr: Address;
  recipient: Address;
  pricePoints: number;
}

export function useRetractAndWithdrawAll() {
  const { writeContractAsync, isPending } = useWriteContract();

  const retractAndWithdrawAll = async (params: RetractAndWithdrawAllParams) => {
    const { kandelAddr, recipient, pricePoints } = params;

    try {
      const hash = await writeContractAsync({
        address: kandelAddr,
        abi: KandelABI,
        functionName: 'retractAndWithdraw',
        args: [
          BigInt(0), // from: start at index 0
          BigInt(pricePoints), // to: retract all offers (levelsPerSide * 2)
          MAX_UINT256, // baseAmount: withdraw all base tokens
          MAX_UINT256, // quoteAmount: withdraw all quote tokens
          MAX_UINT256, // freeWei: withdraw all ETH provisions
          recipient, // recipient: send all withdrawals to user
        ],
      });

      return hash;
    } catch (error) {
      console.error('Failed to completely shut down Kandel position:', error);
      throw error;
    }
  };

  return {
    retractAndWithdrawAll,
    isLoading: isPending,
  };
}