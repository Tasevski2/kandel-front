'use client';

import { useAccount, useBalance } from 'wagmi';
import { formatEther } from 'viem';

export function TokenBalances() {
  const { address, isConnected } = useAccount();
  const { data: balance } = useBalance({
    address,
    query: { refetchInterval: 5000 },
  });

  if (!isConnected || !balance) {
    return null;
  }

  const ethDisplay = parseFloat(formatEther(balance.value)).toFixed(4);

  return (
    <div className='flex items-center gap-3 text-sm'>
      <div className='bg-slate-800/50 rounded-lg px-3 py-2 border border-slate-700'>
        <span className='text-slate-400'>ETH:</span>
        <span className='text-slate-200 ml-1 font-mono'>{ethDisplay}</span>
      </div>
    </div>
  );
}
