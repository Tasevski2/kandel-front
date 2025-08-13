import { parseUnits } from 'viem';
import { TICK_BASE } from './constants';

export function tickToPrice(tick: number | bigint): number {
  return Math.pow(TICK_BASE, Number(tick));
}

export function priceToTick(price: number): number {
  return Math.log(price) / Math.log(TICK_BASE);
}

export function minPriceToTick(price: number): number {
  return Math.floor(priceToTick(price));
}

export function maxPriceToTick(price: number): number {
  return Math.ceil(priceToTick(price));
}

export function parseAmount(amount: string, decimals: number): bigint {
  if (!amount || amount.trim() === '' || isNaN(parseFloat(amount))) {
    return BigInt(0);
  }

  try {
    return parseUnits(amount, decimals);
  } catch (error) {
    return BigInt(0);
  }
}
