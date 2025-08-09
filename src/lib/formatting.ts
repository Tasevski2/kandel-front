import { formatUnits } from 'viem';

/**
 * BigInt token amount formatter using viem + formatAmount combo
 * Converts bigint to number then applies universal formatting
 * @param amount - Amount in smallest unit (wei/units)
 * @param decimals - Token decimals (e.g., 18 for WETH, 6 for USDC)
 */
export function formatTokenAmount(amount: bigint, decimals: number): string {
  const formatted = formatUnits(amount, decimals);
  return formatAmount(Number(formatted));
}

/**
 * ETH amount formatter shorthand
 * Uses formatTokenAmount with 18 decimals for ETH/Wei
 * @param amount - Amount in wei
 */
export function formatEthAmount(amount: bigint): string {
  return formatTokenAmount(amount, 18);
}

/**
 * Universal amount formatter with smart decimal handling and compact notation
 * Handles tiny amounts (up to 10 decimals) and large amounts (K/M/B suffixes)
 * Perfect for displaying token volumes, balances, prices, and amounts across the app
 *
 * @param amount - Amount as a number (already converted from wei/units)
 * @param maxDecimals - Maximum decimal places for small numbers (default: 18)
 * @returns Formatted string with appropriate precision and compact notation
 *
 * Examples:
 * formatAmount(0) -> '0'
 * formatAmount(0.000000005) -> '0.000000005'
 * formatAmount(0.123456) -> '0.123456'
 * formatAmount(1.5) -> '1.5'
 * formatAmount(10) -> '10'
 * formatAmount(10.5) -> '10.5'
 * formatAmount(10.1234) -> '10.1234'
 * formatAmount(1234) -> '1.234K'
 * formatAmount(10000) -> '10K'
 * formatAmount(10500) -> '10.5K'
 * formatAmount(1234.5678) -> '1.2346K'
 * formatAmount(1000000) -> '1M'
 * formatAmount(1500000) -> '1.5M'
 * formatAmount(1000000000) -> '1B'
 * formatAmount(1200000000) -> '1.2B'
 */
export function formatAmount(amount: number, maxDecimals: number = 18): string {
  if (amount === 0) return '0';

  // Handle negative numbers
  const isNegative = amount < 0;
  const absVolume = Math.abs(amount);

  let result: string;

  if (absVolume >= 1_000_000_000) {
    // Billions - show up to 1 decimal, remove if .0
    const billions = absVolume / 1_000_000_000;
    const rounded = parseFloat(billions.toFixed(1));
    result = `${rounded}B`;
  } else if (absVolume >= 1_000_000) {
    // Millions - show up to 1 decimal, remove if .0
    const millions = absVolume / 1_000_000;
    const rounded = parseFloat(millions.toFixed(1));
    result = `${rounded}M`;
  } else if (absVolume >= 1_000) {
    // Thousands - show up to 4 decimals, remove trailing zeros
    const thousands = absVolume / 1_000;
    const rounded = parseFloat(thousands.toFixed(4));
    result = `${rounded}K`;
  } else if (absVolume >= 1) {
    // Numbers >= 1: show up to 4 decimal places, remove trailing zeros
    result = parseFloat(absVolume.toFixed(4)).toString();
  } else {
    // Numbers < 1: show significant digits up to maxDecimals
    // This handles very small numbers like 0.000000005
    const fixed = absVolume.toFixed(maxDecimals);
    result = parseFloat(fixed).toString();

    // If the result is '0' or scientific notation but original wasn't zero, try with more precision
    if ((result === '0' || result.includes('e-')) && absVolume > 0) {
      // Find the first non-zero digit
      const str = absVolume.toString();
      if (str.includes('e-')) {
        // Scientific notation - very small number, use toFixed directly
        result = absVolume.toFixed(maxDecimals);
        // Remove trailing zeros manually
        result = result.replace(/\.?0+$/, '');
      } else {
        // Regular decimal
        const parts = str.split('.');
        if (parts[1]) {
          const firstNonZero = parts[1].search(/[1-9]/);
          if (firstNonZero !== -1) {
            const neededDecimals = Math.min(maxDecimals, firstNonZero + 3);
            result = absVolume.toFixed(neededDecimals);
            // Remove trailing zeros manually
            result = result.replace(/\.?0+$/, '');
          }
        }
      }
      // DON'T convert back to parseFloat - keep the decimal format
    }
  }

  return isNegative ? `-${result}` : result;
}
