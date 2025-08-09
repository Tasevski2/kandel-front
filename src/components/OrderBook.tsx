'use client';

import { useEffect, useState } from 'react';
import { useMgvReader, type Offer } from '../hooks/useMgvReader';
import { formatAmount } from '../lib/formatting';
import { useTokensInfo } from '../hooks/useTokenInfo';

interface OrderBookProps {
  base: `0x${string}`;
  quote: `0x${string}`;
  tickSpacing: bigint;
  highlightMakers?: `0x${string}`[];
}

export function OrderBook({
  base,
  quote,
  tickSpacing,
  highlightMakers = [],
}: OrderBookProps) {
  const { getBook } = useMgvReader();
  const [bids, setBids] = useState<Offer[]>([]);
  const [asks, setAsks] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch token symbols for size and value display
  const { tokensInfo, loading: tokensLoading } = useTokensInfo([base, quote]);
  const baseTokenInfo = tokensInfo[0];
  const quoteTokenInfo = tokensInfo[1];

  const fetchOrderBook = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      // Fetch both asks and bids in one call with the new API
      const { asks, bids } = await getBook(
        base,
        quote,
        tickSpacing,
        highlightMakers,
        30
      );
      setAsks(asks);
      setBids(bids);
    } catch (error) {
      console.error('Failed to fetch order book:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOrderBook();
  }, [base, quote, tickSpacing, getBook, highlightMakers]);

  const handleRefresh = () => {
    fetchOrderBook(true);
  };

  const renderRow = (offer: Offer) => {
    const isHighlighted = offer.isMine;
    const rowClass = isHighlighted ? 'bg-green-900/30' : 'hover:bg-white/5';
    const priceClass = offer.side === 'bid' ? 'text-green-400' : 'text-red-400';

    return (
      <tr
        key={`${offer.side}-${offer.id}`}
        className={`${rowClass} transition-colors`}
      >
        <td className={`px-3 py-1 text-right ${priceClass}`}>
          {formatAmount(offer.price)}
        </td>
        <td className='px-3 py-1 text-right text-slate-300'>
          <span className="tabular-nums">{formatAmount(offer.size)}</span>{' '}
          <span className="text-slate-500 text-xs">{baseTokenInfo?.symbol || '...'}</span>
        </td>
        <td className='px-3 py-1 text-right text-slate-400'>
          <span className="tabular-nums">{formatAmount(offer.value)}</span>{' '}
          <span className="text-slate-600 text-xs">{quoteTokenInfo?.symbol || '...'}</span>
        </td>
        <td className='px-3 py-1 text-right text-slate-500 text-xs'>
          {offer.maker.slice(0, 6)}...
          {offer.isMine && ' (Mine)'}
        </td>
        <td className='px-3 py-1 text-right text-slate-600 text-xs'>
          {offer.id.toString()}
        </td>
      </tr>
    );
  };

  if (loading) {
    return (
      <div className='card'>
        <div className='text-center py-8 text-slate-400'>
          Loading order book...
        </div>
      </div>
    );
  }

  return (
    <div className='card'>
      <div className='flex justify-between items-center mb-4'>
        <h2 className='text-xl font-semibold text-slate-200'>Order Book</h2>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className='btn-secondary text-sm cursor-pointer flex items-center gap-2'
        >
          <svg
            className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
            fill='none'
            stroke='currentColor'
            viewBox='0 0 24 24'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15'
            />
          </svg>
        </button>
      </div>
      <div className='grid grid-cols-2 gap-6'>
        {/* Bids */}
        <div>
          <h3 className='text-lg font-semibold text-green-400 text-center mb-4'>
            Bids
          </h3>
          <div className='overflow-x-auto'>
            <table className='w-full text-sm'>
              <thead>
                <tr className='border-b border-white/10'>
                  <th className='px-3 py-2 text-right text-slate-400 font-medium'>
                    Price
                  </th>
                  <th className='px-3 py-2 text-right text-slate-400 font-medium'>
                    Size
                  </th>
                  <th className='px-3 py-2 text-right text-slate-400 font-medium'>
                    Value
                  </th>
                  <th className='px-3 py-2 text-right text-slate-400 font-medium'>
                    Maker
                  </th>
                  <th className='px-3 py-2 text-right text-slate-400 font-medium'>
                    ID
                  </th>
                </tr>
              </thead>
              <tbody>
                {bids.length === 0 ? (
                  <tr>
                    <td colSpan={5} className='text-center py-4 text-slate-500'>
                      No bids
                    </td>
                  </tr>
                ) : (
                  bids.map((bid) => renderRow(bid))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Asks */}
        <div>
          <h3 className='text-lg font-semibold text-red-400 text-center mb-4'>
            Asks
          </h3>
          <div className='overflow-x-auto'>
            <table className='w-full text-sm'>
              <thead>
                <tr className='border-b border-white/10'>
                  <th className='px-3 py-2 text-right text-slate-400 font-medium'>
                    Price
                  </th>
                  <th className='px-3 py-2 text-right text-slate-400 font-medium'>
                    Size
                  </th>
                  <th className='px-3 py-2 text-right text-slate-400 font-medium'>
                    Value
                  </th>
                  <th className='px-3 py-2 text-right text-slate-400 font-medium'>
                    Maker
                  </th>
                  <th className='px-3 py-2 text-right text-slate-400 font-medium'>
                    ID
                  </th>
                </tr>
              </thead>
              <tbody>
                {asks.length === 0 ? (
                  <tr>
                    <td colSpan={5} className='text-center py-4 text-slate-500'>
                      No asks
                    </td>
                  </tr>
                ) : (
                  asks.map((ask) => renderRow(ask))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
