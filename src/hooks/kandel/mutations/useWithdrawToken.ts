import { useWriteContract } from 'wagmi';
import { readContract } from '@wagmi/core';
import { KandelABI } from '@/abi/kandel';
import { config } from '@/config/wagmiConfig';
import { Address } from 'viem';

interface WithdrawTokenParams {
  kandelAddr: Address;
  tokenType: 'base' | 'quote';
  recipient?: Address;
}

export function useWithdrawToken() {
  const { writeContractAsync, isPending } = useWriteContract();

  const withdrawToken = async (params: WithdrawTokenParams) => {
    const { kandelAddr, tokenType, recipient } = params;

    // Get the current token reserve balance
    const reserveType = tokenType === 'base' ? 1 : 0; // 1 = Ask = Base, 0 = Bid = Quote
    const balance = (await readContract(config, {
      address: kandelAddr,
      abi: KandelABI,
      functionName: 'reserveBalance',
      args: [reserveType],
    })) as bigint;

    if (balance <= BigInt(0)) {
      throw new Error(`No ${tokenType} token balance to withdraw`);
    }

    // Use Kandel's withdrawFunds function
    const baseAmount = tokenType === 'base' ? balance : BigInt(0);
    const quoteAmount = tokenType === 'quote' ? balance : BigInt(0);

    const hash = await writeContractAsync({
      address: kandelAddr,
      abi: KandelABI,
      functionName: 'withdrawFunds',
      args: [baseAmount, quoteAmount, recipient || kandelAddr],
    });

    return hash;
  };

  return {
    withdrawToken,
    isLoading: isPending,
  };
}