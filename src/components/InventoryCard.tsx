import { formatTokenAmount } from '../lib/formatting';
import { TokenInfo } from '../hooks/token/useTokenInfo';

interface InventoryCardProps {
  baseQty: bigint;
  quoteQty: bigint;
  nOffers: number;
  baseTokenInfo?: TokenInfo;
  quoteTokenInfo?: TokenInfo;
}

export function InventoryCard({
  baseQty,
  quoteQty,
  nOffers,
  baseTokenInfo,
  quoteTokenInfo,
}: InventoryCardProps) {
  // Use provided symbols or get from fetched token info
  const finalBaseSymbol = baseTokenInfo?.symbol || 'Loading...';
  const finalQuoteSymbol = quoteTokenInfo?.symbol || 'Loading...';
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
              {!baseTokenInfo ? (
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
              {!quoteTokenInfo ? (
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
          <p className='text-xl font-semibold text-green-400'>{nOffers}</p>
        </div>
      </div>
    </div>
  );
}
