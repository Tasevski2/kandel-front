'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { TokenPairDisplay } from './TokenDisplay';
import { useKandelOfferedVolume } from '../hooks/useKandelOfferedVolume';
import { KandelVolumeIndicator } from './KandelVolumeIndicator';
import { useTokensInfo } from '../hooks/useTokenInfo';
import type { StoredKandel } from '../hooks/useKandels';
import { KANDEL_LABELS } from '../lib/ui-constants';

interface KandelsDropdownProps {
  kandels: StoredKandel[];
  loading?: boolean;
  placeholder?: string;
}

export function KandelsDropdown({
  kandels,
  loading = false,
  placeholder = KANDEL_LABELS.yourKandels,
}: KandelsDropdownProps) {
  const router = useRouter();
  const { getOfferedVolume } = useKandelOfferedVolume(kandels);

  // Get all unique token addresses from kandels
  const allTokenAddresses = kandels.reduce(
    (addresses: (`0x${string}` | undefined)[], kandel) => {
      addresses.push(
        kandel.baseToken as `0x${string}`,
        kandel.quoteToken as `0x${string}`
      );
      return addresses;
    },
    []
  );
  const uniqueTokenAddresses = [...new Set(allTokenAddresses.filter(Boolean))];

  const { tokensInfo } = useTokensInfo(uniqueTokenAddresses);

  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter kandels based on search term
  const filteredKandels = kandels.filter((kandel) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      kandel.address.toLowerCase().includes(searchLower) ||
      kandel.pairId.toLowerCase().includes(searchLower) ||
      kandel.baseToken.toLowerCase().includes(searchLower) ||
      kandel.quoteToken.toLowerCase().includes(searchLower)
    );
  });

  const handleKandelClick = (kandel: StoredKandel) => {
    router.push(`/kandel/${kandel.address}`);
    setIsOpen(false);
    setSearchTerm('');
  };

  if (loading) {
    return (
      <div className='relative'>
        <div className='input flex items-center justify-between cursor-not-allowed opacity-50'>
          <span className='text-slate-400'>Loading your Kandels...</span>
          <div className='animate-spin rounded-full h-4 w-4 border-2 border-slate-400 border-t-transparent'></div>
        </div>
      </div>
    );
  }

  return (
    <div className='relative' ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className='input flex items-center justify-between w-full text-left hover:bg-slate-700/50 transition-colors'
        disabled={loading}
      >
        <span className='text-slate-200'>
          <div className='flex items-center gap-2'>
            {kandels.length > 0 ? (
              <span>
                {kandels.length} Kandel{kandels.length === 1 ? '' : 's'}
              </span>
            ) : (
              <span className='text-slate-400'>{placeholder}</span>
            )}
          </div>
        </span>
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform ${
            isOpen ? 'transform rotate-180' : ''
          }`}
          fill='none'
          stroke='currentColor'
          viewBox='0 0 24 24'
        >
          <path
            strokeLinecap='round'
            strokeLinejoin='round'
            strokeWidth={2}
            d='m19 9-7 7-7-7'
          />
        </svg>
      </button>

      {isOpen && (
        <div className='absolute z-50 w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-lg max-h-80 overflow-hidden'>
          {/* Search input */}
          {kandels.length > 0 && (
            <div className='p-3 border-b border-slate-700'>
              <input
                type='text'
                placeholder='Search your Kandels...'
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className='w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-slate-200 placeholder-slate-400 focus:outline-none focus:border-blue-500'
                autoFocus
              />
            </div>
          )}

          {/* Kandel options */}
          <div className='max-h-60 overflow-y-auto'>
            {kandels.length === 0 ? (
              <div className='px-3 py-4 text-center text-slate-400 text-sm'>
                {KANDEL_LABELS.noPositionsFound}
                <p className='text-xs text-slate-500 mt-1'>
                  Create your first Kandel position
                </p>
              </div>
            ) : filteredKandels.length === 0 ? (
              <div className='px-3 py-4 text-center text-slate-400 text-sm'>
                No Kandels match your search
              </div>
            ) : (
              filteredKandels.map((kandel) => (
                <button
                  key={kandel.address}
                  onClick={() => handleKandelClick(kandel)}
                  className='w-full px-3 py-2 text-left hover:bg-slate-700 transition-colors border-b border-slate-700/50 last:border-b-0'
                >
                  <div className='flex items-center justify-between'>
                    <div className='flex flex-col gap-1'>
                      <div className='flex items-center justify-between w-full gap-2'>
                        <TokenPairDisplay
                          baseAddress={kandel.baseToken as `0x${string}`}
                          quoteAddress={kandel.quoteToken as `0x${string}`}
                        />
                        {(() => {
                          // Find token info for this kandel
                          const baseTokenInfo = tokensInfo.find(
                            (t) =>
                              t?.address.toLowerCase() ===
                              kandel.baseToken.toLowerCase()
                          );
                          const quoteTokenInfo = tokensInfo.find(
                            (t) =>
                              t?.address.toLowerCase() ===
                              kandel.quoteToken.toLowerCase()
                          );

                          // Only show volume indicator if we have token info
                          if (baseTokenInfo && quoteTokenInfo) {
                            return (
                              <KandelVolumeIndicator
                                kandelAddress={kandel.address}
                                getOfferedVolume={getOfferedVolume}
                                baseTokenInfo={baseTokenInfo}
                                quoteTokenInfo={quoteTokenInfo}
                              />
                            );
                          }

                          // Fallback loading state
                          return (
                            <span className='text-xs px-2 py-0.5 rounded-full font-medium bg-slate-500/20 text-slate-400'>
                              Loading...
                            </span>
                          );
                        })()}
                      </div>
                      <div className='flex items-center gap-2'>
                        <span className='text-xs text-slate-500 font-mono'>
                          {kandel.address.slice(0, 10)}...
                          {kandel.address.slice(-6)}
                        </span>
                        <span className='text-xs text-slate-500'>
                          TS: {kandel.tickSpacing}
                        </span>
                      </div>
                      <span className='text-xs text-slate-500'>
                        Created{' '}
                        {new Date(kandel.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
