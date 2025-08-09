'use client';

import { useState, useEffect, useCallback } from 'react';

export interface StoredKandel {
  address: string;
  baseToken: string;
  quoteToken: string;
  tickSpacing: string;
  createdAt: number;
  pairId: string;
}

export function useKandels() {
  const [kandels, setKandels] = useState<StoredKandel[]>([]);
  const [loading, setLoading] = useState(true);

  // Load kandels from localStorage on mount
  useEffect(() => {
    const loadKandels = () => {
      try {
        const stored = localStorage.getItem('myKandels');
        if (stored) {
          const parsedKandels = JSON.parse(stored);
          // Handle both old format (array of strings) and new format (array of objects)
          if (Array.isArray(parsedKandels)) {
            if (
              parsedKandels.length > 0 &&
              typeof parsedKandels[0] === 'string'
            ) {
              // Old format - convert to new format, but we can't get the metadata
              // so we'll just clear it since the user said they deleted localStorage
              setKandels([]);
            } else {
              // New format
              setKandels(parsedKandels);
            }
          }
        }
      } catch (error) {
        setKandels([]);
      } finally {
        setLoading(false);
      }
    };

    loadKandels();
  }, []);

  // Save kandels to localStorage
  const saveKandels = useCallback((newKandels: StoredKandel[]) => {
    try {
      localStorage.setItem('myKandels', JSON.stringify(newKandels));
      setKandels(newKandels);
    } catch (error) {
      console.error('Error saving kandels:', error);
    }
  }, []);

  // Add a new kandel
  const addKandel = useCallback(
    (kandel: Omit<StoredKandel, 'createdAt'>) => {
      const newKandel: StoredKandel = {
        ...kandel,
        createdAt: Date.now(),
      };

      const existingIndex = kandels.findIndex(
        (k) => k.address.toLowerCase() === kandel.address.toLowerCase()
      );

      if (existingIndex >= 0) {
        // Update existing kandel
        const updatedKandels = [...kandels];
        updatedKandels[existingIndex] = newKandel;
        saveKandels(updatedKandels);
      } else {
        // Add new kandel
        saveKandels([...kandels, newKandel]);
      }
    },
    [kandels, saveKandels]
  );

  // Remove a kandel
  const removeKandel = useCallback(
    (address: string) => {
      const filteredKandels = kandels.filter(
        (k) => k.address.toLowerCase() !== address.toLowerCase()
      );
      saveKandels(filteredKandels);
    },
    [kandels, saveKandels]
  );

  // Get kandels for a specific market
  const getKandelsForMarket = useCallback(
    (baseToken: string, quoteToken: string): StoredKandel[] => {
      return kandels.filter((kandel) => {
        const base = baseToken.toLowerCase();
        const quote = quoteToken.toLowerCase();
        const kandelBase = kandel.baseToken.toLowerCase();
        const kandelQuote = kandel.quoteToken.toLowerCase();

        return (
          (kandelBase === base && kandelQuote === quote) ||
          (kandelBase === quote && kandelQuote === base)
        );
      });
    },
    [kandels]
  );

  // Check if a kandel exists
  const hasKandel = useCallback(
    (address: string): boolean => {
      return kandels.some(
        (k) => k.address.toLowerCase() === address.toLowerCase()
      );
    },
    [kandels]
  );

  // Get kandel by address
  const getKandel = useCallback(
    (address: string): StoredKandel | undefined => {
      return kandels.find(
        (k) => k.address.toLowerCase() === address.toLowerCase()
      );
    },
    [kandels]
  );

  return {
    kandels,
    loading,
    addKandel,
    removeKandel,
    getKandelsForMarket,
    hasKandel,
    getKandel,
  };
}
