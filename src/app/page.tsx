'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Connect } from '../components/ConnectWrapper';
import { ChainGuard } from '../components/ChainGuard';
import { MarketDropdown } from '../components/MarketDropdown';
import { KandelsDropdown } from '../components/KandelsDropdown';
import { OrderBook } from '../components/OrderBook';
import { useMarkets } from '../hooks/useMarkets';
import { useKandels } from '../hooks/useKandels';
import { useMgvReader } from '../hooks/useMgvReader';
import type { Market } from '../hooks/useMarkets';

export default function HomePage() {
  const router = useRouter();
  const { markets, loading, error } = useMarkets();
  const { kandels, loading: kandelsLoading } = useKandels();
  const { getNumOpenMarkets } = useMgvReader();
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
  const [openMarketsCount, setOpenMarketsCount] = useState<number | null>(null);

  // Set first market as default when markets are loaded
  useEffect(() => {
    if (markets.length > 0 && !selectedMarket) {
      setSelectedMarket(markets[0]);
    }
  }, [markets, selectedMarket]);

  // Fetch on-chain market count
  useEffect(() => {
    const fetchMarketCount = async () => {
      try {
        const count = await getNumOpenMarkets();
        setOpenMarketsCount(count);
      } catch (error) {
        setOpenMarketsCount(null);
      }
    };

    fetchMarketCount();
  }, [getNumOpenMarkets]);

  const handleCreateKandel = () => {
    router.push('/kandel/new');
  };

  return (
    <div className='min-h-screen p-8'>
      <div className='max-w-7xl mx-auto'>
        <header className='flex justify-between items-center mb-8'>
          <div>
            <h1 className='text-3xl font-bold text-slate-100'>
              Kandel Position Manager
            </h1>
            <p className='text-slate-400 mt-1'>
              Select a market to view order book and manage your Kandel
              positions
            </p>
          </div>
          <Connect />
        </header>

        <ChainGuard>
          <div className='space-y-6'>
            {/* Error message */}
            {error && (
              <div className='bg-red-500/20 border border-red-500/50 rounded-lg p-4'>
                <p className='text-red-400'>{error}</p>
                <button
                  onClick={() => window.location.reload()}
                  className='btn-secondary mt-2 text-sm'
                >
                  Retry
                </button>
              </div>
            )}

            {/* Top Row: Market Selection + Your Kandels */}
            <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
              {/* Market Selection */}
              <div className='card'>
                <h2 className='text-xl font-semibold text-slate-200 mb-4'>
                  Market Selection
                </h2>
                <MarketDropdown
                  markets={markets}
                  selectedMarket={selectedMarket}
                  onMarketSelect={setSelectedMarket}
                  loading={loading}
                  placeholder='Select a market to get started'
                />
                {openMarketsCount !== null && (
                  <p className='text-slate-500 text-sm mt-2'>
                    {openMarketsCount} markets available
                  </p>
                )}
              </div>

              {/* Your Kandels */}
              <div className='card'>
                <h2 className='text-xl font-semibold text-slate-200 mb-4'>
                  Your Kandels
                </h2>
                <div className='space-y-3'>
                  <KandelsDropdown
                    kandels={kandels}
                    loading={kandelsLoading}
                    placeholder='No Kandel positions yet'
                  />
                  <div className='flex gap-3'>
                    <button
                      onClick={handleCreateKandel}
                      className='btn-primary flex-1'
                      disabled={!selectedMarket}
                    >
                      Create New Kandel
                    </button>
                  </div>
                  {kandels.length > 0 && (
                    <p className='text-slate-500 text-sm'>
                      {kandels.length} total Kandel
                      {kandels.length === 1 ? '' : 's'}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Full-width Order Book */}
            {selectedMarket && (
              <OrderBook
                base={selectedMarket.baseToken}
                quote={selectedMarket.quoteToken}
                tickSpacing={selectedMarket.tickSpacing}
                highlightMakers={kandels.map((k) => k.address as `0x${string}`)}
              />
            )}

            {!selectedMarket && !loading && markets.length === 0 && (
              <div className='text-center py-12'>
                <div className='text-slate-400 text-lg mb-2'>
                  No markets found
                </div>
                <p className='text-slate-500'>
                  There are currently no active markets on this Mangrove
                  instance.
                </p>
              </div>
            )}
          </div>
        </ChainGuard>
      </div>
    </div>
  );
}
