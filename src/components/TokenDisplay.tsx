import { type TokenInfo } from '../hooks/token/useTokenInfo';
import { formatAddress } from '@/lib/formatting';

interface TokenDisplayProps {
  tokenInfo?: TokenInfo;
  showAddress?: boolean;
  showName?: boolean;
  className?: string;
}

export function TokenDisplay({
  tokenInfo,
  showAddress = false,
  showName = false,
  className = '',
}: TokenDisplayProps) {
  if (!tokenInfo) {
    return <span className={`${className} animate-pulse`}>Loading...</span>;
  }

  return (
    <span className={className}>
      {tokenInfo.symbol}
      {showName && ` (${name})`}
      {showAddress && ` - ${formatAddress(tokenInfo.address)}`}
    </span>
  );
}

interface TokenPairDisplayProps {
  baseTokenInfo?: TokenInfo;
  quoteTokenInfo?: TokenInfo;
  separator?: string;
  className?: string;
}

export function TokenPairDisplay({
  baseTokenInfo,
  quoteTokenInfo,
  separator = '/',
  className = '',
}: TokenPairDisplayProps) {
  return (
    <span className={className}>
      <TokenDisplay tokenInfo={baseTokenInfo} />
      {separator}
      <TokenDisplay tokenInfo={quoteTokenInfo} />
    </span>
  );
}
