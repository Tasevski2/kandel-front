'use client';

import { useChainValidation } from '../hooks/useChainValidation';

interface ChainGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function ChainGuard({ children, fallback }: ChainGuardProps) {
  const { isConnected, isCorrectChain } = useChainValidation();

  // If not connected, show children (allow them to connect first)
  if (!isConnected) {
    return <>{children}</>;
  }

  // If connected but wrong chain, show fallback or disable
  if (!isCorrectChain) {
    if (fallback) {
      return <>{fallback}</>;
    }
    
    // Disable interactive elements by wrapping in a disabled div
    return (
      <div className="opacity-50 pointer-events-none">
        {children}
      </div>
    );
  }

  // Correct chain, show normal content
  return <>{children}</>;
}