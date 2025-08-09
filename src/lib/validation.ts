// Validation utilities

import { MAX_TICK, MAX_UINT24, MIN_TICK } from './constants';

export function validateStepSize(
  stepSize: number,
  pricePoints: number
): string | null {
  if (stepSize < 1) return 'Step size must be larger than 1';
  if (stepSize >= pricePoints)
    return `Step size must be less than ${Math.max(pricePoints - 1, 1)}`;
  return null;
}

// TODO: we need to use this function
export function validateLevelsPerSide(levels: number): string | null {
  if (levels <= 0) {
    return 'Levels per side must be a positive number';
  }

  return null;
}

export function validateGasreq(gasreq: number): string | null {
  if (gasreq <= 0) {
    return 'Gas requirement must be a positive number';
  }

  if (gasreq > MAX_UINT24) {
    return 'Gas requirement exceeds uint24 maximum (16,777,215)';
  }

  return null;
}

export function validateMinMax(
  minPrice: number,
  maxPrice: number
): string | null {
  if (minPrice <= 0) {
    return 'Min price must be greater than 0';
  }
  if (maxPrice <= minPrice) {
    return 'Max price must be greater than min price';
  }
  return null;
}

export function validatePriceRange(
  minTick: number,
  maxTick: number
): string | null {
  if (
    minTick < MIN_TICK ||
    minTick > MAX_TICK ||
    maxTick < MIN_TICK ||
    maxTick > MAX_TICK
  ) {
    return 'Price range is too extreme. Please choose prices closer to the current market price.';
  }
  return null;
}
