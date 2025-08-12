// Validation utilities

import { MAX_TICK, MAX_UINT24, MAX_UINT32, MIN_TICK } from './constants';

export function validateStepSize(
  stepSize: number,
  pricePoints: number
): string | null {
  if (stepSize < 1) return 'Step size must be larger than 1';
  if (stepSize >= pricePoints)
    return `Step size must be less than ${Math.max(pricePoints, 1)}`;
  if (stepSize > MAX_UINT32) {
    return 'Step size is too large. Please use a value: 1 <= step size < price points.';
  }
  return null;
}

// TODO: we need to use this function
export function validateLevelsPerSide(levels: number): string | null {
  if (levels <= 0) {
    return 'Levels per side must be a positive number';
  }
  // Calculate price points (levels * 2 - 1)
  const pricePoints = levels * 2 - 1;
  if (pricePoints > MAX_UINT32) {
    return 'Too many price levels requested. Please reduce the number of levels.';
  }
  return null;
}

export function validateGasreq(gasreqStr: string): string | null {
  const trimmed = gasreqStr.trim();
  if (trimmed === '') {
    return `Gas requirement must be between 1 and ${MAX_UINT24.toLocaleString()}`;
  }
  const gasreq = Number(trimmed);
  if (isNaN(gasreq) || gasreq <= 0) {
    return `Gas requirement must be between 1 and ${MAX_UINT24.toLocaleString()}`;
  }
  if (gasreq > MAX_UINT24) {
    return `Gas requirement exceeds maximum (${MAX_UINT24.toLocaleString()})`;
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
