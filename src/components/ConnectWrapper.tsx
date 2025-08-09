'use client';

import dynamic from 'next/dynamic';

const ConnectWithBalancesDynamic = dynamic(
  () => import('./ConnectWithBalances').then(mod => ({ default: mod.ConnectWithBalances })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center gap-4">
        <button className="btn-secondary" disabled>
          Loading...
        </button>
      </div>
    )
  }
);

export { ConnectWithBalancesDynamic as Connect };