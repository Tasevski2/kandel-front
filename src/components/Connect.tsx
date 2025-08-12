'use client';

import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { useChain } from '../hooks/useChain';

export function Connect() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { isCorrectChain, switchToRequired, activeNetwork, isSwitching } =
    useChain();

  const handleConnect = () => {
    connect({ connector: connectors[0] });
  };

  if (isConnected && address) {
    return (
      <div className='flex items-center gap-2'>
        {!isCorrectChain ? (
          <button
            onClick={switchToRequired}
            className='btn-warning'
            disabled={isSwitching}
          >
            {isSwitching ? 'Switching...' : `Switch to ${activeNetwork.name}`}
          </button>
        ) : (
          <span className='text-green-400 text-sm'>{activeNetwork.name}</span>
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
