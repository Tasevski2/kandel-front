import { useConfig, useWriteContract } from 'wagmi';
import { waitForTransactionReceipt } from '@wagmi/core';
import { type Address, parseEventLogs } from 'viem';
import { kandelSeederABI } from '@/abi/kandelSeeder';
import { ADDRESSES } from '@/lib/addresses';

interface CreateParams {
  base: Address;
  quote: Address;
  tickSpacing: bigint;
}

export function useKandelSeeder() {
  const config = useConfig();
  const { writeContractAsync } = useWriteContract();

  const create = async (params: CreateParams): Promise<Address> => {
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
        false,
      ],
    });

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

    return sowEvent.args.kandel as Address;
  };

  return { create };
}
