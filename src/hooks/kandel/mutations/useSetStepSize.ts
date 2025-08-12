import { useWriteContract } from 'wagmi';
import { KandelABI } from '@/abi/kandel';
import { Address } from 'viem';

interface SetStepSizeParams {
  kandelAddr: Address;
  stepSize: number;
}

export function useSetStepSize() {
  const { writeContractAsync, isPending } = useWriteContract();

  const setStepSize = async (params: SetStepSizeParams) => {
    const { kandelAddr, stepSize } = params;

    if (stepSize <= 0) {
      throw new Error('Step size must be greater than 0');
    }

    const hash = await writeContractAsync({
      address: kandelAddr,
      abi: KandelABI,
      functionName: 'setStepSize',
      args: [BigInt(stepSize)],
    });

    return hash;
  };

  return {
    setStepSize,
    isLoading: isPending,
  };
}