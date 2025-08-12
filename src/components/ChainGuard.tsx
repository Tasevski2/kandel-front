'use client';

import { useChain } from '../hooks/useChain';

interface ChainGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function ChainGuard({ children, fallback }: ChainGuardProps) {
  const { isConnected, isCorrectChain } = useChain();

  if (!isConnected) {
    return <>{children}</>;
  }

  if (!isCorrectChain) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return <div className='opacity-50 pointer-events-none'>{children}</div>;
  }

  return <>{children}</>;
}
