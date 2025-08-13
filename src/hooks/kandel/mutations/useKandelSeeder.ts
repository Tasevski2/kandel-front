import { useState } from 'react';
import { useConfig, useWriteContract } from 'wagmi';
import { waitForTransactionReceipt } from '@wagmi/core';
import { type Address, parseEventLogs } from 'viem';
import { kandelSeederABI } from '@/abi/kandelSeeder';
import { ADDRESSES } from '@/lib/addresses';
import { TRANSACTION_CONFIRMATIONS } from '@/lib/constants';
import { useTxToast } from '@/hooks/useTxToast';

interface CreateParams {
  base: Address;
  quote: Address;
  tickSpacing: bigint;
}

export function useKandelSeeder() {
  const config = useConfig();
  const { setTxToast } = useTxToast();
  const { writeContractAsync } = useWriteContract();
  const [isLoading, setIsLoading] = useState(false);

  const create = async (params: CreateParams): Promise<Address> => {
    setIsLoading(true);
    const toastId = setTxToast('signing', {
      message: 'Signing Kandel deployment…',
    });
    let txHash: Address | undefined;
    try {
      txHash = await writeContractAsync({
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
      setTxToast('submitted', {
        message: 'Deployment submitted. Waiting for confirmation…',
        id: toastId,
        hash: txHash,
      });

      const receipt = await waitForTransactionReceipt(config, { 
        hash: txHash, 
        confirmations: TRANSACTION_CONFIRMATIONS 
      });

      if (receipt.status !== 'success') {
        throw new Error('Transaction failed');
      }

      const logs = parseEventLogs({
        abi: kandelSeederABI,
        logs: receipt.logs,
      });

      const sowEvent = logs.find((log) => log.eventName === 'NewKandel');
      if (!sowEvent || !sowEvent.args?.kandel) {
        throw new Error('Kandel creation failed - no address in events');
      }

      setTxToast('success', {
        message: 'Kandel deployed successfully.',
        id: toastId,
        hash: txHash,
      });

      return sowEvent.args.kandel as Address;
    } catch (error) {
      setTxToast('failed', {
        message: 'Failed to deploy Kandel.',
        id: toastId,
        hash: txHash,
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return { create, isLoading };
}
