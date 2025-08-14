'use client';

import { useMemo } from 'react';
import { formatAmount } from '../lib/formatting';
import { useTokensInfo } from '../hooks/token/useTokensInfo';
import type { Address } from 'viem';
import { useGetOrderBook } from '@/hooks/mangrove/queries/useGetOrderBook';
import type { Offer } from '@/hooks/mangrove/queries/useGetOffers';

interface OrderBookProps {
  base?: Address;
  quote?: Address;
  tickSpacing: bigint;
  highlightMakers?: Address[];
}

export function OrderBook({
  base,
  quote,
  tickSpacing,
  highlightMakers = [],
}: OrderBookProps) {
  const tokenAddresses = useMemo(
    () => (base && quote ? [base, quote] : []),
    [base, quote]
  );
  const { tokensInfo, isLoading: tokensLoading } =
    useTokensInfo(tokenAddresses);

  const baseTokenInfo = tokensInfo ? tokensInfo[base!] : undefined;
  const quoteTokenInfo = tokensInfo ? tokensInfo[quote!] : undefined;

  const {
    asks,
    bids,
    isLoading: orderbookLoading,
    isRefetching,
    refetch,
  } = useGetOrderBook({
    base: baseTokenInfo?.address,
    quote: quoteTokenInfo?.address,
    baseDec: baseTokenInfo?.decimals,
    quoteDec: quoteTokenInfo?.decimals,
    tickSpacing: tickSpacing,
    maker: null,
  });

  const isLoading = tokensLoading || orderbookLoading;

  if (isLoading) {
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
          onClick={refetch}
          disabled={isRefetching}
          className='btn-secondary text-sm cursor-pointer flex items-center gap-2'
        >
          <svg
            className={`w-4 h-4 ${isRefetching ? 'animate-spin' : ''}`}
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
              <OrdersTableHeader />
              <tbody>
                {bids && bids.length ? (
                  bids.map((bid) => (
                    <OrderBookRow
                      key={`${bid.side}-${bid.id}`}
                      offer={bid}
                      highlightMakers={highlightMakers}
                      baseTokenSymbol={baseTokenInfo?.symbol}
                      quoteTokenSymbol={quoteTokenInfo?.symbol}
                    />
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className='text-center py-4 text-slate-500'>
                      No bids
                    </td>
                  </tr>
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
              <OrdersTableHeader />
              <tbody>
                {asks && asks.length ? (
                  asks.map((ask) => (
                    <OrderBookRow
                      key={`${ask.side}-${ask.id}`}
                      offer={ask}
                      highlightMakers={highlightMakers}
                      baseTokenSymbol={baseTokenInfo?.symbol}
                      quoteTokenSymbol={quoteTokenInfo?.symbol}
                    />
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className='text-center py-4 text-slate-500'>
                      No asks
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function OrdersTableHeader() {
  return (
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
        <th className='px-3 py-2 text-right text-slate-400 font-medium'>ID</th>
      </tr>
    </thead>
  );
}

interface OrderBookRowProps {
  offer: Offer;
  highlightMakers: Address[];
  baseTokenSymbol?: string;
  quoteTokenSymbol?: string;
}

function OrderBookRow({
  offer,
  highlightMakers,
  baseTokenSymbol,
  quoteTokenSymbol,
}: OrderBookRowProps) {
  const isMine = highlightMakers.includes(offer.maker);
  const rowClass = isMine ? 'bg-green-900/30' : 'hover:bg-white/5';
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
        <span className='tabular-nums'>{formatAmount(offer.size)}</span>{' '}
        <span className='text-slate-500 text-xs'>
          {baseTokenSymbol || '...'}
        </span>
      </td>
      <td className='px-3 py-1 text-right text-slate-400'>
        <span className='tabular-nums'>{formatAmount(offer.value)}</span>{' '}
        <span className='text-slate-600 text-xs'>
          {quoteTokenSymbol || '...'}
        </span>
      </td>
      <td className='px-3 py-1 text-right text-slate-500 text-xs'>
        {offer.maker.slice(0, 6)}...
        {isMine && ' (Mine)'}
      </td>
      <td className='px-3 py-1 text-right text-slate-600 text-xs'>
        {offer.id.toString()}
      </td>
    </tr>
  );
}
