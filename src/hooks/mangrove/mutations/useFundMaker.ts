import { useWriteContract } from 'wagmi';
import { MangroveABI } from '@/abi/mangrove';
import { ADDRESSES } from '@/lib/addresses';
import { Address } from 'viem';

export function useFundMaker() {
  const { writeContractAsync, isPending } = useWriteContract();

  const fundMaker = async (maker: Address, amount: bigint) => {
    if (amount <= BigInt(0)) return;

    try {
      const hash = await writeContractAsync({
        address: ADDRESSES.mangrove,
        abi: MangroveABI,
        functionName: 'fund',
        args: [maker],
        value: amount,
      });
      return hash;
    } catch (error) {
      throw error;
    }
  };

  return {
    fundMaker,
    isLoading: isPending,
  };
}
