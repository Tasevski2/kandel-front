import { useState, useEffect, useCallback, useRef } from 'react';
import { readContract } from '@wagmi/core';
import { erc20Abi } from '../abi/erc20';
import { config } from './useChain';

export interface TokenInfo {
  symbol: string;
  name: string;
  decimals: number;
  address: `0x${string}`;
}

// Cache to avoid repeated blockchain calls
export const tokenInfoCache = new Map<string, TokenInfo>();

export function useTokenInfo(tokenAddress?: `0x${string}`) {
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTokenInfo = useCallback(async (address: `0x${string}`) => {
    // Check cache first
    const cached = tokenInfoCache.get(address.toLowerCase());
    if (cached) {
      setTokenInfo(cached);
      setLoading(false);
      return cached;
    }

    // Fetch from blockchain
    try {
      setLoading(true);
      setError(null);

      const [symbol, name, decimals] = await Promise.all([
        readContract(config, {
          address,
          abi: erc20Abi,
          functionName: 'symbol',
        }),
        readContract(config, {
          address,
          abi: erc20Abi,
          functionName: 'name',
        }),
        readContract(config, {
          address,
          abi: erc20Abi,
          functionName: 'decimals',
        }),
      ]);

      const info: TokenInfo = {
        symbol: symbol as string,
        name: name as string,
        decimals: Number(decimals),
        address,
      };

      // Cache the result
      tokenInfoCache.set(address.toLowerCase(), info);
      setTokenInfo(info);
      return info;
    } catch (err) {
      const fallbackInfo: TokenInfo = {
        symbol: `${address.slice(0, 6)}...${address.slice(-4)}`,
        name: 'Unknown Token',
        decimals: 18,
        address,
      };
      setError('Failed to fetch token info');
      setTokenInfo(fallbackInfo);
      return fallbackInfo;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tokenAddress) {
      fetchTokenInfo(tokenAddress);
    } else {
      setTokenInfo(null);
      setLoading(false);
      setError(null);
    }
  }, [tokenAddress, fetchTokenInfo]);

  return {
    tokenInfo,
    loading,
    error,
    refetch: () => tokenAddress && fetchTokenInfo(tokenAddress),
  };
}

// Hook for multiple tokens
export function useTokensInfo(tokenAddresses: (`0x${string}` | undefined)[]) {
  const [tokensInfo, setTokensInfo] = useState<(TokenInfo | null)[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastAddressesRef = useRef<string>('');

  // Helper function to compare arrays
  const addressesKey = tokenAddresses.map((addr) => addr || 'null').join(',');

  const fetchTokensInfo = useCallback(
    async (addresses: (`0x${string}` | undefined)[]) => {
      if (!addresses.some((addr) => addr)) {
        setTokensInfo([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const results = await Promise.all(
          addresses.map(async (address) => {
            if (!address) return null;

            // Check cache first
            const cached = tokenInfoCache.get(address.toLowerCase());
            if (cached) return cached;

            // Fetch from blockchain
            try {
              const [symbol, name, decimals] = await Promise.all([
                readContract(config, {
                  address,
                  abi: erc20Abi,
                  functionName: 'symbol',
                }),
                readContract(config, {
                  address,
                  abi: erc20Abi,
                  functionName: 'name',
                }),
                readContract(config, {
                  address,
                  abi: erc20Abi,
                  functionName: 'decimals',
                }),
              ]);

              const info: TokenInfo = {
                symbol: symbol as string,
                name: name as string,
                decimals: Number(decimals),
                address,
              };

              tokenInfoCache.set(address.toLowerCase(), info);
              return info;
            } catch (err) {
              return {
                symbol: `${address.slice(0, 6)}...${address.slice(-4)}`,
                name: 'Unknown Token',
                decimals: 18,
                address,
              };
            }
          })
        );

        setTokensInfo(results);
      } catch (err) {
        setError('Failed to fetch tokens info');
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    // Only fetch if addresses have actually changed
    if (lastAddressesRef.current !== addressesKey) {
      lastAddressesRef.current = addressesKey;
      fetchTokensInfo(tokenAddresses);
    }
  }, [addressesKey, tokenAddresses, fetchTokensInfo]);

  return {
    tokensInfo,
    loading,
    error,
    refetch: () => fetchTokensInfo(tokenAddresses),
  };
}
