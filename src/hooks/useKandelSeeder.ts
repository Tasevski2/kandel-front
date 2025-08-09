import { useWriteContract } from 'wagmi';
import { waitForTransactionReceipt } from '@wagmi/core';
import { parseEventLogs } from 'viem';
import { kandelSeederABI } from '../abi/kandelSeeder';
import { ADDRESSES } from '../lib/addresses';
import { config } from './useChain';

interface CreateParams {
  base: `0x${string}`;
  quote: `0x${string}`;
  tickSpacing: bigint;
}

export function useKandelSeeder() {
  const { writeContractAsync } = useWriteContract();

  const create = async (params: CreateParams): Promise<`0x${string}`> => {
    const hash = await writeContractAsync({
      address: ADDRESSES.kandelSeeder,
      abi: kandelSeederABI,
      functionName: 'sow',
      args: [
        {
          outbound_tkn: params.base,
          inbound_tkn: params.quote,
          tickSpacing: params.tickSpacing,
        },
        false, // liquiditySharing
      ],
    });

    // Wait for transaction and extract Kandel address from events
    const receipt = await waitForTransactionReceipt(config, { hash });

    if (!receipt) throw new Error('Transaction failed');

    const logs = parseEventLogs({
      abi: kandelSeederABI,
      logs: receipt.logs,
    });

    const sowEvent = logs.find((log) => log.eventName === 'NewKandel');
    if (!sowEvent || !sowEvent.args?.kandel) {
      throw new Error('Kandel creation failed - no address in events');
    }

    return sowEvent.args.kandel as `0x${string}`;
  };

  return { create };
}
