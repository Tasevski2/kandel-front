'use client';

import { useState, useEffect, useCallback } from 'react';
import { Address } from 'viem';

export interface StoredKandel {
  address: Address;
  baseToken: Address;
  quoteToken: Address;
  tickSpacing: string;
  createdAt: number;
  pairId: string;
}

export function useKandels() {
  const [kandels, setKandels] = useState<StoredKandel[]>([]);
  const [isLoading, setLoading] = useState(true);

  // Load kandels from localStorage on mount
  useEffect(() => {
    const loadKandels = () => {
      try {
        const stored = localStorage.getItem('myKandels');
        if (stored) {
          const parsedKandels = JSON.parse(stored);
          if (Array.isArray(parsedKandels)) {
            setKandels(parsedKandels);
          } else {
            setKandels([]);
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

  const saveKandels = useCallback((newKandels: StoredKandel[]) => {
    try {
      localStorage.setItem('myKandels', JSON.stringify(newKandels));
      setKandels(newKandels);
    } catch (error) {
      console.error('Error saving kandels:', error);
    }
  }, []);

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
        const updatedKandels = [...kandels];
        updatedKandels[existingIndex] = newKandel;
        saveKandels(updatedKandels);
      } else {
        saveKandels([...kandels, newKandel]);
      }
    },
    [kandels, saveKandels]
  );

  const removeKandel = useCallback(
    (address: string) => {
      const filteredKandels = kandels.filter(
        (k) => k.address.toLowerCase() !== address.toLowerCase()
      );
      saveKandels(filteredKandels);
    },
    [kandels, saveKandels]
  );

  return {
    kandels,
    isLoading,
    addKandel,
    removeKandel,
  };
}
