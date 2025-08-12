'use client';

import { TokenDisplay } from '../TokenDisplay';
import { useKandelForm } from './useKandelForm';
import type { KandelInfo } from '@/hooks/kandel/queries/useGetKandelInfo';
import type { Market } from '@/hooks/mangrove/queries/useGetMarkets';
import { Address } from 'viem';
import { formatTokenAmount, formatEthAmount } from '@/lib/formatting';

type KandelFormProps = {
  onSuccess?: (address: Address) => void;
} & (
  | {
      // Edit mode
      isEditing: true;
      kandelInfo: KandelInfo;
    }
  | {
      // Create mode
      isEditing?: false;
      market: Market;
    }
);

export function KandelForm(props: KandelFormProps) {
  const { formState, actions, computed, status } = useKandelForm(props);

  if (!computed.hasValidTokens) {
    return (
      <div className='min-h-screen p-8 flex items-center justify-center'>
        <div className='text-slate-400'>Loading token information...</div>
      </div>
    );
  }

  // Show loading state while configuration is loading
  if (status.configLoading && computed.hasValidTokens) {
    return (
      <div className='flex items-center justify-center py-8'>
        <div className='text-slate-400'>Loading configuration...</div>
      </div>
    );
  }

  return (
    <form onSubmit={actions.handleSubmit} className='space-y-6'>
      {/* Market Parameters Card */}
      <div className='card'>
        <h3 className='text-lg font-semibold text-slate-200 mb-4'>
          Market Parameters
        </h3>

        <div className='grid grid-cols-2 gap-4'>
          <div>
            <label className='label'>
              <TokenDisplay tokenInfo={computed.baseTokenInfo} /> Address
            </label>
            <input
              type='text'
              value={computed.base}
              disabled
              className='input opacity-50'
            />
          </div>

          <div>
            <label className='label'>
              <TokenDisplay tokenInfo={computed.quoteTokenInfo} /> Address
            </label>
            <input
              type='text'
              value={computed.quote}
              disabled
              className='input opacity-50'
            />
          </div>

          <div>
            <label className='label'>
              Min Price ({computed.baseTokenInfo?.symbol || 'BASE'}/
              {computed.quoteTokenInfo?.symbol || 'QUOTE'})
            </label>
            <input
              type='text'
              value={formState.minPrice}
              onChange={(e) =>
                actions.handlePriceChange(
                  e.target.value,
                  actions.setMinPrice,
                  actions.setMinPriceTouched
                )
              }
              placeholder='e.g. 1000'
              required
              className='input'
            />
          </div>

          <div>
            <label className='label'>
              Max Price ({computed.baseTokenInfo?.symbol || 'BASE'}/
              {computed.quoteTokenInfo?.symbol || 'QUOTE'})
            </label>
            <input
              type='text'
              value={formState.maxPrice}
              onChange={(e) =>
                actions.handlePriceChange(
                  e.target.value,
                  actions.setMaxPrice,
                  actions.setMaxPriceTouched
                )
              }
              placeholder='e.g. 2000'
              required
              className='input'
            />
          </div>
        </div>

        {status.priceRangeError && (
          <p className='text-red-400 text-sm mt-2'>{status.priceRangeError}</p>
        )}
      </div>

      {/* Advanced Parameters Card */}
      <div className='card'>
        <h3 className='text-lg font-semibold text-slate-200 mb-4'>
          Advanced Parameters
        </h3>

        <div className='grid grid-cols-2 gap-4'>
          <div>
            <label className='label'>Step</label>
            <input
              type='number'
              value={formState.step}
              onChange={(e) => actions.setStep(e.target.value)}
              min='1'
              max='100'
              step='1'
              required
              className='input'
            />
            {status.stepSizeError && (
              <p className='text-red-400 text-sm mt-1'>
                {status.stepSizeError}
              </p>
            )}
          </div>

          <div>
            <label className='label'>Levels Per Side</label>
            <input
              type='number'
              value={formState.levelsPerSide}
              onChange={(e) => actions.setLevelsPerSide(e.target.value)}
              min='1'
              max='50'
              required
              className='input'
            />
            {status.levelsPerSideError && (
              <p className='text-red-400 text-sm mt-1'>
                {status.levelsPerSideError}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Initial Inventory Card */}
      <div className='card'>
        <h3 className='text-lg font-semibold text-slate-200 mb-4'>
          Initial Inventory
        </h3>

        {computed.isEditing && (
          <div className='flex items-center gap-2 mb-4'>
            <input
              id='addInv'
              type='checkbox'
              checked={formState.addInventory || computed.forceAddInventory}
              onChange={() => actions.setAddInventory(!formState.addInventory)}
              disabled={computed.forceAddInventory}
              className={`w-4 h-4 text-blue-600 bg-slate-700 border-slate-600 rounded focus:ring-blue-500 focus:ring-2 ${
                computed.forceAddInventory
                  ? 'opacity-50 cursor-not-allowed'
                  : ''
              }`}
            />
            <label htmlFor='addInv' className='text-sm text-slate-300'>
              Deposit entered amounts into Kandel inventory
              {computed.forceAddInventory && (
                <span className='block text-xs text-yellow-400 mt-1'>
                  (Required - no existing reserves found)
                </span>
              )}
            </label>
          </div>
        )}

        <div className='grid grid-cols-2 gap-4'>
          <div>
            <label className='label'>
              <TokenDisplay tokenInfo={computed.baseTokenInfo} /> Amount
            </label>
            <input
              type='number'
              value={formState.baseAmount}
              onChange={(e) => actions.setBaseAmount(e.target.value)}
              placeholder='e.g. 100'
              step='0.000000001'
              min='0'
              required={
                !computed.isEditing ||
                formState.addInventory ||
                computed.forceAddInventory
              }
              disabled={
                computed.isEditing &&
                !formState.addInventory &&
                !computed.forceAddInventory
              }
              className={`input ${
                computed.isEditing &&
                !formState.addInventory &&
                !computed.forceAddInventory
                  ? 'opacity-50'
                  : ''
              }`}
            />
            {computed.kandelReserves && computed.baseTokenInfo && (
              <div className='text-xs text-slate-400 mt-1'>
                Kandel Balance:{' '}
                {formatTokenAmount(
                  computed.kandelReserves.baseQty,
                  computed.baseTokenInfo.decimals
                )}{' '}
                {computed.baseTokenInfo.symbol}
              </div>
            )}
          </div>

          <div>
            <label className='label'>
              <TokenDisplay tokenInfo={computed.quoteTokenInfo} /> Amount
            </label>
            <input
              type='number'
              value={formState.quoteAmount}
              onChange={(e) => actions.setQuoteAmount(e.target.value)}
              placeholder='e.g. 150000'
              step='0.000000001'
              min='0'
              required={
                !computed.isEditing ||
                formState.addInventory ||
                computed.forceAddInventory
              }
              disabled={
                computed.isEditing &&
                !formState.addInventory &&
                !computed.forceAddInventory
              }
              className={`input ${
                computed.isEditing &&
                !formState.addInventory &&
                !computed.forceAddInventory
                  ? 'opacity-50'
                  : ''
              }`}
            />
            {computed.kandelReserves && computed.quoteTokenInfo && (
              <div className='text-xs text-slate-400 mt-1'>
                Kandel Balance:{' '}
                {formatTokenAmount(
                  computed.kandelReserves.quoteQty,
                  computed.quoteTokenInfo.decimals
                )}{' '}
                {computed.quoteTokenInfo.symbol}
              </div>
            )}
          </div>
        </div>
        {status.minVolumeError && (
          <p className='text-red-400 text-sm mt-2'>{status.minVolumeError}</p>
        )}
      </div>

      {/* Advanced Settings Card */}
      <div className='card'>
        <h3 className='text-lg font-semibold text-slate-200 mb-4'>
          Advanced Settings
        </h3>

        <div className='space-y-4'>
          <div>
            <label className='label'>Gas Requirement</label>
            <input
              type='number'
              value={formState.gasreq}
              onChange={(e) => actions.setGasreq(e.target.value)}
              required
              className='input'
            />
            {status.gasreqError && (
              <p className='text-red-400 text-sm mt-1'>{status.gasreqError}</p>
            )}
          </div>
        </div>
      </div>

      {/* Provision Summary Card */}
      <div className='card'>
        <h3 className='text-lg font-semibold text-slate-200 mb-4'>
          Provision Summary
        </h3>
        <div className='space-y-2 text-sm'>
          <div className='flex justify-between font-semibold'>
            <span className='text-slate-400'>Total Provision Needed:</span>
            <span className='text-slate-200'>
              {status.configLoading
                ? 'Calculating...'
                : `${formatEthAmount(computed.provision.missing)} ETH`}
            </span>
          </div>
        </div>
      </div>

      {/* Error display */}
      {status.error && (
        <div className='bg-red-500/20 border border-red-500/50 rounded-lg p-4'>
          <p className='text-red-400'>{status.error}</p>
        </div>
      )}

      {/* Submit button */}
      {(() => {
        const hasAnyChanges =
          computed.dirty && Object.values(computed.dirty).some(Boolean);

        return (
          <button
            type='submit'
            disabled={
              status.loading ||
              parseInt(formState.levelsPerSide) === 0 ||
              status.stepSizeError !== null ||
              status.minVolumeError !== null ||
              status.priceRangeError !== null ||
              status.gasreqError !== null ||
              (computed.isEditing && !hasAnyChanges)
            }
            className='btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed'
          >
            {status.loading
              ? 'Processing...'
              : computed.kandelAddress
              ? 'Update Kandel'
              : 'Create Kandel'}
          </button>
        );
      })()}
    </form>
  );
}
