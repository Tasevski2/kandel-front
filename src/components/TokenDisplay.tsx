'use client';

import { useTokenInfo } from '../hooks/useTokenInfo';

interface TokenDisplayProps {
  address?: `0x${string}`;
  showAddress?: boolean;
  showName?: boolean;
  className?: string;
  fallback?: string;
}

export function TokenDisplay({
  address,
  showAddress = false,
  showName = false,
  className = '',
  fallback,
}: TokenDisplayProps) {
  const { tokenInfo, loading } = useTokenInfo(address);

  if (!address) {
    return <span className={className}>{fallback || 'Unknown'}</span>;
  }

  if (loading && !tokenInfo) {
    return <span className={`${className} animate-pulse`}>Loading...</span>;
  }

  const symbol = tokenInfo?.symbol || `${address.slice(0, 6)}...${address.slice(-4)}`;
  const name = tokenInfo?.name || 'Unknown Token';

  return (
    <span className={className}>
      {symbol}
      {showName && ` (${name})`}
      {showAddress && ` - ${address.slice(0, 6)}...${address.slice(-4)}`}
    </span>
  );
}

interface TokenPairDisplayProps {
  baseAddress?: `0x${string}`;
  quoteAddress?: `0x${string}`;
  separator?: string;
  className?: string;
}

export function TokenPairDisplay({
  baseAddress,
  quoteAddress,
  separator = '/',
  className = '',
}: TokenPairDisplayProps) {
  return (
    <span className={className}>
      <TokenDisplay address={baseAddress} />
      {separator}
      <TokenDisplay address={quoteAddress} />
    </span>
  );
}