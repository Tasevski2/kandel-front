import { useWriteContract } from 'wagmi';
import { KandelABI } from '@/abi/kandel';
import { Address } from 'viem';

export interface PopulateFromOffsetParams {
  kandelAddr: Address;
  from: bigint;
  to: bigint;
  minTick: bigint;
  tickOffsetBetweenLevels: bigint;
  firstAskIndex: bigint;
  bidGivesPerLevel: bigint;
  askGivesPerLevel: bigint;
  params: {
    gasprice: number;
    gasreq: number;
    stepSize: number;
    pricePoints: number;
  };
  baseAmount: bigint;
  quoteAmount: bigint;
  provisionValue: bigint;
}

export function usePopulateFromOffset() {
  const { writeContractAsync, isPending } = useWriteContract();

  const populateFromOffset = async (params: PopulateFromOffsetParams) => {
    const hash = await writeContractAsync({
      address: params.kandelAddr,
      abi: KandelABI,
      functionName: 'populateFromOffset',
      args: [
        params.from,
        params.to,
        params.minTick,
        params.tickOffsetBetweenLevels,
        params.firstAskIndex,
        params.bidGivesPerLevel,
        params.askGivesPerLevel,
        {
          gasprice: params.params.gasprice,
          gasreq: params.params.gasreq,
          stepSize: params.params.stepSize,
          pricePoints: params.params.pricePoints,
        },
        params.baseAmount,
        params.quoteAmount,
      ],
      value: params.provisionValue,
    });

    return hash;
  };

  return {
    populateFromOffset,
    isLoading: isPending,
  };
}