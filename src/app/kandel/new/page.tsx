'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Connect } from '@/components/ConnectWrapper';
import { KandelForm } from '@/components/KandelForm';
import { ChainGuard } from '@/components/ChainGuard';
import { MarketDropdown } from '@/components/MarketDropdown';
import { NoMarketsMessage } from '@/components/NoMarketsMessage';
import { useMarkets } from '@/hooks/useMarkets';
import { useKandels } from '@/hooks/useKandels';
import type { Market } from '@/hooks/useMarkets';
import { KANDEL_LABELS, MARKET_LABELS } from '../../../lib/ui-constants';

export default function NewKandelPage() {
  const router = useRouter();
  const { markets, loading: marketsLoading, error } = useMarkets();
  const { addKandel } = useKandels();
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);

  const handleSuccess = async (address: `0x${string}`) => {
    if (selectedMarket) {
      addKandel({
        address,
        baseToken: selectedMarket.baseToken,
        quoteToken: selectedMarket.quoteToken,
        tickSpacing: selectedMarket.tickSpacing.toString(),
        pairId: selectedMarket.pairId,
      });
    }

    router.push(`/kandel/${address}`);
  };

  return (
    <div className='min-h-screen p-8'>
      <div className='max-w-4xl mx-auto'>
        <header className='flex justify-between items-center mb-8'>
          <div>
            <button
              onClick={() => router.push('/')}
              className='text-slate-400 hover:text-slate-200 mb-2 transition-colors cursor-pointer'
            >
              ← Back to Markets
            </button>
            <h1 className='text-3xl font-bold text-slate-100'>
              {KANDEL_LABELS.createNew}
            </h1>
          </div>
          <Connect />
        </header>

        <ChainGuard>
          <div className='space-y-6'>
            <div className='card'>
              <h2 className='text-xl font-semibold text-slate-200 mb-4'>
                Select Market
              </h2>

              {error && (
                <div className='bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-4'>
                  <p className='text-red-400'>{error}</p>
                  <button
                    onClick={() => window.location.reload()}
                    className='btn-secondary mt-2 text-sm'
                  >
                    Retry
                  </button>
                </div>
              )}

              <MarketDropdown
                markets={markets}
                selectedMarket={selectedMarket}
                onMarketSelect={setSelectedMarket}
                loading={marketsLoading}
                placeholder='Choose a market to create your Kandel position'
                allowEmpty={false}
              />

              {!selectedMarket && markets.length > 0 && (
                <p className='text-slate-500 text-sm mt-2'>
                  {MARKET_LABELS.selectAbove}
                </p>
              )}
            </div>

            {selectedMarket && (
              <div className='card'>
                <h2 className='text-xl font-semibold text-slate-200 mb-4'>
                  Configure Kandel Position
                </h2>
                <KandelForm onSuccess={handleSuccess} market={selectedMarket} />
              </div>
            )}

            {marketsLoading && (
              <div className='text-center py-8'>
                <div className='text-slate-400'>
                  Loading available markets...
                </div>
              </div>
            )}

            {!marketsLoading && markets.length === 0 && !error && (
              <NoMarketsMessage />
            )}
          </div>
        </ChainGuard>
      </div>
    </div>
  );
}
