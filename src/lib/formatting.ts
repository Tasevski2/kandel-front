import { Address, formatUnits } from 'viem';

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

  const isNegative = amount < 0;
  const absVolume = Math.abs(amount);

  let result: string;

  if (absVolume >= 1_000_000_000) {
    const billions = absVolume / 1_000_000_000;
    const rounded = parseFloat(billions.toFixed(1));
    result = `${rounded}B`;
  } else if (absVolume >= 1_000_000) {
    const millions = absVolume / 1_000_000;
    const rounded = parseFloat(millions.toFixed(1));
    result = `${rounded}M`;
  } else if (absVolume >= 1_000) {
    const thousands = absVolume / 1_000;
    const rounded = parseFloat(thousands.toFixed(4));
    result = `${rounded}K`;
  } else if (absVolume >= 1) {
    result = parseFloat(absVolume.toFixed(4)).toString();
  } else {
    const fixed = absVolume.toFixed(maxDecimals);
    result = parseFloat(fixed).toString();

    if ((result === '0' || result.includes('e-')) && absVolume > 0) {
      const str = absVolume.toString();
      if (str.includes('e-')) {
        result = absVolume.toFixed(maxDecimals);
        result = result.replace(/\.?0+$/, '');
      } else {
        const parts = str.split('.');
        if (parts[1]) {
          const firstNonZero = parts[1].search(/[1-9]/);
          if (firstNonZero !== -1) {
            const neededDecimals = Math.min(maxDecimals, firstNonZero + 3);
            result = absVolume.toFixed(neededDecimals);
                result = result.replace(/\.?0+$/, '');
          }
        }
      }
    }
  }

  return isNegative ? `-${result}` : result;
}

export function formatAddress(addr: Address): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}
