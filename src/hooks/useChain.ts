'use client';

import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { getActiveNetwork } from '../config/networks';

const activeNetwork = getActiveNetwork();

export function useChain() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending: isSwitching } = useSwitchChain();

  const isCorrectChain = isConnected && chainId === activeNetwork.id;

  const switchToRequired = () => {
    if (chainId === activeNetwork.id) return;
    switchChain({ chainId: activeNetwork.id });
  };

  return {
    isConnected,
    chainId,
    activeNetwork,
    isCorrectChain,
    switchToRequired,
    isSwitching,
  };
}
