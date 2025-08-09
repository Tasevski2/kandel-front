/**
 * Utility functions for Kandel calculations
 */

/**
 * Calculate the step size between price levels for a Kandel position
 * @param minPrice Minimum price for the range
 * @param maxPrice Maximum price for the range  
 * @param levelsPerSide Number of levels per side (bids and asks)
 * @returns The step size in ticks
 */
export function calculateStepSize(
  minPrice: number,
  maxPrice: number,
  levelsPerSide: number
): bigint {
  // Validate inputs
  if (!isFinite(minPrice) || !isFinite(maxPrice) || !isFinite(levelsPerSide)) {
    return BigInt(1);
  }
  
  if (minPrice <= 0 || maxPrice <= minPrice || levelsPerSide <= 0) {
    return BigInt(1);
  }
  
  const minTick = Math.floor(Math.log(minPrice) / Math.log(1.0001));
  const maxTick = Math.ceil(Math.log(maxPrice) / Math.log(1.0001));
  const pricePoints = levelsPerSide * 2;
  const stepSize = Math.floor((maxTick - minTick) / pricePoints);
  
  // Ensure stepSize is at least 1 and finite
  const result = Math.max(1, stepSize);
  return isFinite(result) ? BigInt(result) : BigInt(1);
}

