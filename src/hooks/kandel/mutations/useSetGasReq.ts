import { useWriteContract } from 'wagmi';
import { KandelABI } from '@/abi/kandel';
import { Address } from 'viem';

interface SetGasReqParams {
  kandelAddr: Address;
  gasreq: number;
}

export function useSetGasReq() {
  const { writeContractAsync, isPending } = useWriteContract();

  const setGasReq = async (params: SetGasReqParams) => {
    const { kandelAddr, gasreq } = params;

    if (gasreq <= 0) {
      throw new Error('Gas requirement must be greater than 0');
    }

    const hash = await writeContractAsync({
      address: kandelAddr,
      abi: KandelABI,
      functionName: 'setGasreq',
      args: [BigInt(gasreq)],
    });

    return hash;
  };

  return {
    setGasReq,
    isLoading: isPending,
  };
}