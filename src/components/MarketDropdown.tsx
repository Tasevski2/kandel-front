'use client';

import { useState, useRef, useEffect } from 'react';
import { TokenPairDisplay } from './TokenDisplay';
import type { Market } from '../hooks/useMarkets';

interface MarketDropdownProps {
  markets: Market[];
  selectedMarket: Market | null;
  onMarketSelect: (market: Market | null) => void;
  loading?: boolean;
  placeholder?: string;
  allowEmpty?: boolean;
}

export function MarketDropdown({
  markets,
  selectedMarket,
  onMarketSelect,
  loading = false,
  placeholder = "Select a market",
  allowEmpty = false,
}: MarketDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter markets based on search term
  const filteredMarkets = markets.filter(market => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      market.pairId.toLowerCase().includes(searchLower) ||
      market.baseToken.toLowerCase().includes(searchLower) ||
      market.quoteToken.toLowerCase().includes(searchLower)
    );
  });

  const handleMarketSelect = (market: Market | null) => {
    onMarketSelect(market);
    setIsOpen(false);
    setSearchTerm('');
  };

  if (loading) {
    return (
      <div className="relative">
        <div className="input flex items-center justify-between cursor-not-allowed opacity-50">
          <span className="text-slate-400">Loading markets...</span>
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-slate-400 border-t-transparent"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="input flex items-center justify-between w-full text-left hover:bg-slate-700/50 transition-colors"
        disabled={loading}
      >
        <span className={selectedMarket ? 'text-slate-200' : 'text-slate-400'}>
          {selectedMarket ? (
            <div className="flex items-center gap-2">
              <TokenPairDisplay 
                baseAddress={selectedMarket.baseToken} 
                quoteAddress={selectedMarket.quoteToken} 
              />
              <span className="text-xs text-slate-500">
                (TS: {selectedMarket.tickSpacing.toString()})
              </span>
            </div>
          ) : (
            placeholder
          )}
        </span>
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform ${
            isOpen ? 'transform rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m19 9-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-lg max-h-80 overflow-hidden">
          {/* Search input */}
          <div className="p-3 border-b border-slate-700">
            <input
              type="text"
              placeholder="Search markets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-slate-200 placeholder-slate-400 focus:outline-none focus:border-blue-500"
              autoFocus
            />
          </div>

          {/* Market options */}
          <div className="max-h-60 overflow-y-auto">
            {allowEmpty && (
              <button
                onClick={() => handleMarketSelect(null)}
                className="w-full px-3 py-2 text-left hover:bg-slate-700 transition-colors border-b border-slate-700/50"
              >
                <span className="text-slate-400 text-sm">No market selected</span>
              </button>
            )}
            
            {filteredMarkets.length === 0 ? (
              <div className="px-3 py-4 text-center text-slate-400 text-sm">
                {markets.length === 0 ? 'No markets available' : 'No markets match your search'}
              </div>
            ) : (
              filteredMarkets.map((market) => (
                <button
                  key={`${market.baseToken}-${market.quoteToken}-${market.tickSpacing}`}
                  onClick={() => handleMarketSelect(market)}
                  className={`w-full px-3 py-2 text-left hover:bg-slate-700 transition-colors border-b border-slate-700/50 last:border-b-0 ${
                    selectedMarket?.baseToken === market.baseToken &&
                    selectedMarket?.quoteToken === market.quoteToken &&
                    selectedMarket?.tickSpacing === market.tickSpacing
                      ? 'bg-slate-700'
                      : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <TokenPairDisplay 
                        baseAddress={market.baseToken} 
                        quoteAddress={market.quoteToken} 
                      />
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-slate-500">
                          TS: {market.tickSpacing.toString()}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          market.isActive 
                            ? 'bg-green-500/20 text-green-400' 
                            : 'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {market.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
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