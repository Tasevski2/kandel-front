'use client';

import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { getActiveNetwork, getNetworkName } from '../config/networks';

export function useChainValidation() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending: isSwitching } = useSwitchChain();

  const activeNetwork = getActiveNetwork();
  const isCorrectChain = chainId === activeNetwork.id;
  const needsChainSwitch = isConnected && !isCorrectChain;

  const switchToActiveNetwork = () => {
    if (switchChain) {
      switchChain({ chainId: activeNetwork.id });
    }
  };

  return {
    isConnected,
    chainId,
    isCorrectChain,
    needsChainSwitch,
    switchToActiveNetwork,
    isSwitching,
    requiredChain: activeNetwork,
    networkName: getNetworkName(),
  };
}
