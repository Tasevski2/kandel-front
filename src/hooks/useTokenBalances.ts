'use client';

import { useAccount } from 'wagmi';
// This hook is deprecated - hardcoded token balances no longer supported
// Use useTokensInfo with specific token addresses instead

export function useTokenBalances() {
  const { isConnected } = useAccount();

  // This hook is deprecated due to removal of hardcoded token configurations
  // Provide fallback values for backward compatibility
  const refetchBalances = async () => {
    // No-op
  };

  return {
    wethBalance: BigInt(0),
    usdcBalance: BigInt(0),
    isConnected,
    refetchBalances,
  };
}