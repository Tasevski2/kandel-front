'use client';

import { useMemo } from 'react';
import { formatTokenAmount } from '../lib/formatting';
import { useTokensInfo } from '../hooks/useTokenInfo';

interface InventoryCardProps {
  baseQty: bigint;
  quoteQty: bigint;
  liveOffers: number;
  baseToken: `0x${string}`;
  quoteToken: `0x${string}`;
  baseSymbol?: string;
  quoteSymbol?: string;
}

export function InventoryCard({
  baseQty,
  quoteQty,
  liveOffers,
  baseToken,
  quoteToken,
  baseSymbol,
  quoteSymbol,
}: InventoryCardProps) {
  // Memoize token addresses to prevent infinite re-renders
  const tokenAddresses = useMemo(
    () => [baseToken, quoteToken],
    [baseToken, quoteToken]
  );

  // Fetch token info from blockchain
  const { tokensInfo, loading } = useTokensInfo(tokenAddresses);

  const baseTokenInfo = tokensInfo[0];
  const quoteTokenInfo = tokensInfo[1];

  // Use provided symbols or get from fetched token info
  const finalBaseSymbol = baseSymbol || baseTokenInfo?.symbol || 'Loading...';
  const finalQuoteSymbol =
    quoteSymbol || quoteTokenInfo?.symbol || 'Loading...';
  const baseDecimals = baseTokenInfo?.decimals || 18;
  const quoteDecimals = quoteTokenInfo?.decimals || 6;
  return (
    <div className='card'>
      <h3 className='text-lg font-semibold text-slate-200 mb-4'>
        Inventory Status
      </h3>

      <div className='space-y-4'>
        <div className='grid grid-cols-2 gap-4'>
          <div className='bg-white/5 rounded-lg p-4'>
            <p className='text-sm text-slate-400 mb-1'>
              {loading && !baseTokenInfo ? (
                <span className='animate-pulse'>Loading...</span>
              ) : (
                `${finalBaseSymbol} Balance`
              )}
            </p>
            <p className='text-xl font-semibold text-slate-200'>
              {formatTokenAmount(baseQty, baseDecimals)}
            </p>
          </div>

          <div className='bg-white/5 rounded-lg p-4'>
            <p className='text-sm text-slate-400 mb-1'>
              {loading && !quoteTokenInfo ? (
                <span className='animate-pulse'>Loading...</span>
              ) : (
                `${finalQuoteSymbol} Balance`
              )}
            </p>
            <p className='text-xl font-semibold text-slate-200'>
              {formatTokenAmount(quoteQty, quoteDecimals)}
            </p>
          </div>
        </div>

        <div className='bg-white/5 rounded-lg p-4'>
          <p className='text-sm text-slate-400 mb-1'>Live Offers</p>
          <p className='text-xl font-semibold text-green-400'>{liveOffers}</p>
        </div>
      </div>
    </div>
  );
}
