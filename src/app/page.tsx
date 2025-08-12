'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Connect } from '../components/ConnectWrapper';
import { ChainGuard } from '../components/ChainGuard';
import { MarketDropdown } from '../components/MarketDropdown';
import { KandelsDropdown } from '../components/KandelsDropdown';
import { OrderBook } from '../components/OrderBook';
import { NoMarketsMessage } from '../components/NoMarketsMessage';
import { useGetMarkets } from '../hooks/mangrove/queries/useGetMarkets';
import { useKandels } from '../hooks/kandel/useKandels';
import type { Market } from '../hooks/mangrove/queries/useGetMarkets';
import {
  APP_LABELS,
  KANDEL_LABELS,
  MARKET_LABELS,
  ERROR_LABELS,
  STATUS_LABELS,
} from '../lib/ui-constants';
import { Address } from 'viem';
import { useGetNumOfOpenMarkets } from '@/hooks/mangrove/queries/useGetNumOfOpenMarkets';

export default function HomePage() {
  const router = useRouter();
  const { markets, isLoading, error } = useGetMarkets();
  const { kandels, isLoading: kandelsLoading } = useKandels();
  const { numOfOpenMarkets } = useGetNumOfOpenMarkets();
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);

  useEffect(() => {
    if (markets.length > 0 && !selectedMarket) {
      setSelectedMarket(markets[0]);
    }
  }, [markets, selectedMarket]);

  const handleCreateKandel = () => {
    router.push('/kandel/new');
  };

  return (
    <div className='min-h-screen p-8'>
      <div className='max-w-7xl mx-auto'>
        <header className='flex justify-between items-center mb-8'>
          <div>
            <h1 className='text-3xl font-bold text-slate-100'>
              {APP_LABELS.title}
            </h1>
            <p className='text-slate-400 mt-1'>{APP_LABELS.subtitle}</p>
          </div>
          <Connect />
        </header>

        <ChainGuard>
          <div className='space-y-6'>
            {error && (
              <div className='bg-red-500/20 border border-red-500/50 rounded-lg p-4'>
                <p className='text-red-400'>{error}</p>
                <button
                  onClick={() => window.location.reload()}
                  className='btn-secondary mt-2 text-sm'
                >
                  {ERROR_LABELS.retry}
                </button>
              </div>
            )}

            <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
              <div className='card'>
                <h2 className='text-xl font-semibold text-slate-200 mb-4'>
                  {MARKET_LABELS.marketSelection}
                </h2>
                <MarketDropdown
                  markets={markets}
                  selectedMarket={selectedMarket}
                  onMarketSelect={setSelectedMarket}
                  isLoading={isLoading}
                  placeholder={MARKET_LABELS.getStarted}
                />
                {numOfOpenMarkets !== undefined && (
                  <p className='text-slate-500 text-sm mt-2'>
                    {numOfOpenMarkets} {STATUS_LABELS.marketsAvailable}
                  </p>
                )}
              </div>

              <div className='card'>
                <h2 className='text-xl font-semibold text-slate-200 mb-4'>
                  {KANDEL_LABELS.yourKandels}
                </h2>
                <div className='space-y-3'>
                  <KandelsDropdown
                    kandels={kandels}
                    isLoading={kandelsLoading}
                    placeholder={KANDEL_LABELS.noPositions}
                  />
                  <div className='flex gap-3'>
                    <button
                      onClick={handleCreateKandel}
                      className='btn-primary flex-1'
                      disabled={!selectedMarket}
                    >
                      {KANDEL_LABELS.createNew}
                    </button>
                  </div>
                  {kandels.length > 0 && (
                    <p className='text-slate-500 text-sm'>
                      {kandels.length}{' '}
                      {kandels.length === 1
                        ? STATUS_LABELS.totalKandel
                        : STATUS_LABELS.totalKandels}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {selectedMarket && (
              <OrderBook
                base={selectedMarket.baseToken}
                quote={selectedMarket.quoteToken}
                tickSpacing={selectedMarket.tickSpacing}
                highlightMakers={kandels.map((k) => k.address as Address)}
              />
            )}

            {!selectedMarket && !isLoading && markets.length === 0 && (
              <NoMarketsMessage />
            )}
          </div>
        </ChainGuard>
      </div>
    </div>
  );
}
