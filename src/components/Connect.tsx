'use client';

import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { useChainValidation } from '../hooks/useChainValidation';

export function Connect() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { 
    isCorrectChain, 
    needsChainSwitch, 
    switchToActiveNetwork, 
    networkName,
    isSwitching 
  } = useChainValidation();

  const handleConnect = () => {
    connect({ connector: connectors[0] });
  };

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2">
        {needsChainSwitch ? (
          <button 
            onClick={switchToActiveNetwork} 
            className='btn-warning'
            disabled={isSwitching}
          >
            {isSwitching ? 'Switching...' : `Switch to ${networkName}`}
          </button>
        ) : (
          <span className="text-green-400 text-sm">
            {networkName}
          </span>
        )}
        <button onClick={() => disconnect()} className='btn-secondary'>
          Disconnect {address.slice(0, 6)}...{address.slice(-4)}
        </button>
      </div>
    );
  }

  return (
    <button onClick={handleConnect} className='btn-primary'>
      Connect MetaMask
    </button>
  );
}
