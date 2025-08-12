'use client';

import { formatUnits } from 'viem';
import { formatAmount } from '../lib/formatting';
import type { KandelOfferedVolume } from '@/hooks/kandel/queries/useGetKandelsOfferedVolumes';
import type { TokenInfo } from '../hooks/token/useTokenInfo';

interface KandelVolumeIndicatorProps {
  kandelAddress: string;
  getOfferedVolume: (address: string) => KandelOfferedVolume | undefined;
  isLoadingOfferedVolume: boolean;
  baseTokenInfo: TokenInfo;
  quoteTokenInfo: TokenInfo;
}

export function KandelVolumeIndicator({
  kandelAddress,
  getOfferedVolume,
  isLoadingOfferedVolume,
  baseTokenInfo,
  quoteTokenInfo,
}: KandelVolumeIndicatorProps) {
  const volumeData = getOfferedVolume(kandelAddress);

  if (isLoadingOfferedVolume) {
    return (
      <div className='animate-spin rounded-full h-3 w-3 border border-slate-500 border-t-transparent' />
    );
  }

  if (!volumeData) {
    return (
      <span className='text-xs px-2 py-0.5 rounded-full font-medium bg-slate-500/20 text-slate-400'>
        No data
      </span>
    );
  }

  const hasVolume =
    volumeData.askVolume > BigInt(0) || volumeData.bidVolume > BigInt(0);

  if (!hasVolume) {
    return (
      <span className='text-xs px-2 py-0.5 rounded-full font-medium bg-slate-500/20 text-slate-400'>
        No volume
      </span>
    );
  }

  // Format volumes for display using correct token decimals
  // askVolume uses base token decimals, bidVolume uses quote token decimals
  const askVolumeFormatted = Number(
    formatUnits(volumeData.askVolume, baseTokenInfo.decimals)
  );
  const bidVolumeFormatted = Number(
    formatUnits(volumeData.bidVolume, quoteTokenInfo.decimals)
  );

  // For display, we need to normalize both volumes to show meaningful totals
  // Since ask and bid volumes are in different token units, we'll show them separately or as a combined indicator
  const hasAskVolume = askVolumeFormatted > 0;
  const hasBidVolume = bidVolumeFormatted > 0;

  return (
    <div className='flex items-center gap-1'>
      {hasBidVolume && (
        <span className='text-xs px-2 py-0.5 rounded-full font-medium bg-green-500/20 text-green-400'>
          {formatAmount(bidVolumeFormatted)} {quoteTokenInfo.symbol} vol
        </span>
      )}
      {hasAskVolume && (
        <span className='text-xs px-2 py-0.5 rounded-full font-medium bg-red-500/20 text-red-400'>
          {formatAmount(askVolumeFormatted)} {baseTokenInfo.symbol} vol
        </span>
      )}
    </div>
  );
}
