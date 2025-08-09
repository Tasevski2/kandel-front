import { parseUnits } from 'viem';
import { TICK_BASE } from './constants';

/**
 * Convert a Uniswap/Mangrove tick to a human-readable price.
 *
 * price = 1.0001^tick × 10^(quoteDecimals − baseDecimals)
 *
 * @param tick         The tick (signed) — bigint or number is OK.
 * @param baseDecimals  ERC-20 decimals of the BASE token.
 * @param quoteDecimals ERC-20 decimals of the QUOTE token.
 * @returns            Price expressed as "QUOTE per 1 BASE".
 *
 * Note – for UI display this vanilla `Math.pow` version is fine
 * (≈ 14-digit precision).  If you need full-precision math on huge
 * ticks, swap `Math.pow` for a big-number lib such as `big.js` or bn.js.
 */
export function tickToPrice(
  tick: bigint | number,
  baseDecimals: number,
  quoteDecimals: number
): number {
  const ratio = Math.pow(1.0001, Number(tick)); // price in raw ratio
  const decimalFactor = Math.pow(10, quoteDecimals - baseDecimals);
  return ratio * decimalFactor;
}

// Simple tick to price conversion without decimal adjustments
export function tickToPriceSimple(tick: number | bigint): number {
  return Math.pow(1.0001, Number(tick));
}

export function priceToTick(price: number): number {
  return Math.log(price) / Math.log(TICK_BASE);
}

export function parseAmount(amount: string, decimals: number): bigint {
  // Validate input
  if (!amount || amount.trim() === '' || isNaN(parseFloat(amount))) {
    return BigInt(0);
  }

  try {
    return parseUnits(amount, decimals);
  } catch (error) {
    return BigInt(0);
  }
}
