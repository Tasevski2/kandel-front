import { useCallback } from 'react';
import { useWriteContract, useAccount } from 'wagmi';
import { readContract } from '@wagmi/core';
import { erc20Abi } from '../abi/erc20';
import { config } from './useChain';

export function useTokens() {
  const { writeContractAsync } = useWriteContract();
  const { address: userAddress } = useAccount();

  /**
   * Approve ERC20 tokens only if current allowance is insufficient
   * @param tokenAddress - ERC20 token contract address
   * @param spender - Address that will spend the tokens
   * @param amount - Amount to approve
   */
  const erc20Approve = useCallback(
    async (
      tokenAddress: `0x${string}`,
      spender: `0x${string}`,
      amount: bigint
    ): Promise<void> => {
      if (amount === BigInt(0)) return;
      if (!userAddress) throw new Error('User address not available');

      try {
        // Check current allowance
        const currentAllowance = (await readContract(config, {
          address: tokenAddress,
          abi: erc20Abi,
          functionName: 'allowance',
          args: [userAddress, spender],
        })) as bigint;

        // Only approve if current allowance is insufficient
        if (currentAllowance < amount) {
          await writeContractAsync({
            address: tokenAddress,
            abi: erc20Abi,
            functionName: 'approve',
            args: [spender, amount],
          });
        }
      } catch (error) {
        throw error;
      }
    },
    [writeContractAsync, userAddress]
  );

  /**
   * Get current allowance for a token
   * @param tokenAddress - ERC20 token contract address
   * @param owner - Token owner address
   * @param spender - Spender address
   */
  const getAllowance = useCallback(
    async (
      tokenAddress: `0x${string}`,
      owner: `0x${string}`,
      spender: `0x${string}`
    ): Promise<bigint> => {
      return (await readContract(config, {
        address: tokenAddress,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [owner, spender],
      })) as bigint;
    },
    []
  );

  return {
    erc20Approve,
    getAllowance,
  };
}
