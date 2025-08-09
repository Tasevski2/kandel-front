import { useState } from 'react';
import { useWriteContract } from 'wagmi';
import { readContract } from '@wagmi/core';
import { KandelABI } from '../abi/kandel';
import { MangroveABI } from '../abi/mangrove';
import { readerAbi } from '../abi/reader';
import { erc20Abi } from 'viem';
import { ADDRESSES } from '../lib/addresses';
import { config } from './useChain';
import { tickToPriceSimple } from '../lib/pricing';
import { useTokens } from './useTokens';

const MAX_UINT256 = BigInt(
  '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
);

type OLKey = {
  outbound_tkn: `0x${string}`;
  inbound_tkn: `0x${string}`;
  tickSpacing: bigint;
};

/**
 * Find `baseQuoteTickIndex0` – the tick of the lowest-price ASK
 * posted by this Kandel (i.e. price-point #0 on the base→quote list).
 *
 * • Scans the ask side (`outbound = BASE`, `inbound = QUOTE`) from id 0 upward.
 * • Stops at the first row whose maker matches `kandelAddr`.
 * • Returns `{ id, tick, index }` or `null` if no live ask exists.
 */
async function fetchBaseQuoteTickIndex0(
  readerAddr: `0x${string}`,
  kandelAddr: `0x${string}`,
  base: `0x${string}`,
  quote: `0x${string}`,
  tickSpacing: bigint,
  page = BigInt(64)
): Promise<{ id: bigint; tick: bigint; index: number } | null> {
  const asksKey: OLKey = {
    outbound_tkn: base,
    inbound_tkn: quote,
    tickSpacing,
  };

  let cursor = BigInt(0);
  let index = 0; // running index within the ladder

  while (true) {
    const [, ids, offers, details] = (await readContract(config, {
      address: readerAddr,
      abi: readerAbi,
      functionName: 'offerList',
      args: [asksKey, cursor, page],
    })) as [any, bigint[], any[], any[]];

    for (let i = 0; i < ids.length; i++, index++) {
      const maker = details[i]?.maker as `0x${string}`;
      if (maker && maker.toLowerCase() === kandelAddr.toLowerCase()) {
        return { id: ids[i], tick: offers[i].tick as bigint, index };
      }
    }

    if (ids.length < Number(page)) break; // reached end of book
    cursor = ids[ids.length - 1]; // continue after last id
  }
  return null; // no live asks for this Kandel
}

export interface KandelParams {
  base: `0x${string}`;
  quote: `0x${string}`;
  minPrice: number;
  maxPrice: number;
  stepSize: number;
  levelsPerSide: number;
  gasprice: number;
  gasreq: number;
  baseQuoteTickOffset?: bigint;
  baseQuoteTickIndex0?: bigint;
  minTick?: bigint;
  maxTick?: bigint;
}

export interface LadderItem {
  index: bigint;
  tick: bigint;
  bidGives: bigint;
  askGives: bigint;
}

export function useKandel(kandelAddr: `0x${string}`) {
  const { writeContractAsync } = useWriteContract();
  const { erc20Approve } = useTokens();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getParams = async (tickSpacing?: bigint): Promise<KandelParams> => {
    const [base, quote, params, baseQuoteTickOffset] = await Promise.all([
      readContract(config, {
        address: kandelAddr,
        abi: KandelABI,
        functionName: 'BASE',
      }),
      readContract(config, {
        address: kandelAddr,
        abi: KandelABI,
        functionName: 'QUOTE',
      }),
      readContract(config, {
        address: kandelAddr,
        abi: KandelABI,
        functionName: 'params',
      }),
      readContract(config, {
        address: kandelAddr,
        abi: KandelABI,
        functionName: 'baseQuoteTickOffset',
      }),
    ]);

    const baseToken = base as `0x${string}`;
    const quoteToken = quote as `0x${string}`;

    // GeometricKandel stores parameters
    const contractParams = {
      gasprice: (params as any)[0] as number,
      gasreq: (params as any)[1] as number,
      stepSize: (params as any)[2] as number,
      pricePoints: (params as any)[3] as number,
    };

    // Check if this Kandel has been properly initialized
    if (contractParams.pricePoints === 0 || contractParams.stepSize === 0) {
      return {
        base: baseToken,
        quote: quoteToken,
        minPrice: 0,
        maxPrice: 0,
        stepSize: contractParams.stepSize,
        levelsPerSide: 0,
        gasprice: contractParams.gasprice,
        gasreq: contractParams.gasreq,
      };
    }

    const levelsPerSide = contractParams.pricePoints / 2;

    // Use provided tickSpacing or fallback to BigInt(1)
    const effectiveTickSpacing = tickSpacing || BigInt(1);
    const tickOffsetBigInt = baseQuoteTickOffset as bigint;

    // Fetch the baseQuoteTickIndex0 (first ask tick)
    const baseQuoteTickData = await fetchBaseQuoteTickIndex0(
      ADDRESSES.mgvReader,
      kandelAddr,
      baseToken,
      quoteToken,
      effectiveTickSpacing
    );

    let minPrice = 0;
    let maxPrice = 0;
    let minTick: bigint | undefined;
    let maxTick: bigint | undefined;
    let baseQuoteTickIndex0: bigint | undefined;

    if (baseQuoteTickData && tickOffsetBigInt) {
      // We found the first ask, use exact tick calculation
      baseQuoteTickIndex0 = baseQuoteTickData.tick;
      const levels = BigInt(levelsPerSide);

      // Calculate min/max ticks using the formula from the user
      minTick = baseQuoteTickIndex0 - levels * tickOffsetBigInt;
      maxTick = baseQuoteTickIndex0 + (levels - BigInt(1)) * tickOffsetBigInt;

      // Convert ticks to prices
      minPrice = tickToPriceSimple(minTick);
      maxPrice = tickToPriceSimple(maxTick);
    } else {
      // Fallback: fetch all offers and calculate min/max from actual prices
      const [askResult, bidResult] = await Promise.all([
        readContract(config, {
          address: ADDRESSES.mgvReader,
          abi: readerAbi,
          functionName: 'offerList',
          args: [
            {
              outbound_tkn: baseToken,
              inbound_tkn: quoteToken,
              tickSpacing: effectiveTickSpacing,
            },
            BigInt(0),
            BigInt(100),
          ],
        }),
        readContract(config, {
          address: ADDRESSES.mgvReader,
          abi: readerAbi,
          functionName: 'offerList',
          args: [
            {
              outbound_tkn: quoteToken,
              inbound_tkn: baseToken,
              tickSpacing: effectiveTickSpacing,
            },
            BigInt(0),
            BigInt(100),
          ],
        }),
      ]);

      const [, askIds, askOffers, askDetails] = askResult as [
        any,
        bigint[],
        any[],
        any[]
      ];
      const [, bidIds, bidOffers, bidDetails] = bidResult as [
        any,
        bigint[],
        any[],
        any[]
      ];

      const kandelPrices: number[] = [];
      const kandelAddrLower = kandelAddr.toLowerCase();

      // Process asks
      askIds.forEach((_, i) => {
        const maker = askDetails[i]?.maker as `0x${string}`;
        if (maker && maker.toLowerCase() === kandelAddrLower) {
          const { tick } = askOffers[i] as { tick: bigint };
          const price = tickToPriceSimple(tick);
          kandelPrices.push(price);
        }
      });

      // Process bids
      bidIds.forEach((_, i) => {
        const maker = bidDetails[i]?.maker as `0x${string}`;
        if (maker && maker.toLowerCase() === kandelAddrLower) {
          const { tick } = bidOffers[i] as { tick: bigint };
          const rawPrice = tickToPriceSimple(tick);
          const price = 1 / rawPrice;
          kandelPrices.push(price);
        }
      });

      if (kandelPrices.length > 0) {
        minPrice = Math.min(...kandelPrices);
        maxPrice = Math.max(...kandelPrices);
      }
    }

    return {
      base: baseToken,
      quote: quoteToken,
      minPrice,
      maxPrice,
      stepSize: contractParams.stepSize,
      levelsPerSide,
      gasprice: contractParams.gasprice,
      gasreq: contractParams.gasreq,
      baseQuoteTickOffset: tickOffsetBigInt,
      baseQuoteTickIndex0,
      minTick,
      maxTick,
    };
  };

  const getInventory = async () => {
    const [baseBalance, quoteBalance] = await Promise.all([
      readContract(config, {
        address: kandelAddr,
        abi: KandelABI,
        functionName: 'reserveBalance',
        args: [1],
      }),
      readContract(config, {
        address: kandelAddr,
        abi: KandelABI,
        functionName: 'reserveBalance',
        args: [0],
      }),
    ]);

    return {
      baseQty: (baseBalance as bigint) || BigInt(0),
      quoteQty: (quoteBalance as bigint) || BigInt(0),
    };
  };

  const getTickSpacing = async (): Promise<bigint> => {
    const tickSpacing = await readContract(config, {
      address: kandelAddr,
      abi: KandelABI,
      functionName: 'TICK_SPACING',
    });
    return tickSpacing as bigint;
  };

  const retractAll = async (opts: { deprovision: boolean }) => {
    // Get the total number of price points to determine the range
    const params = await getParams();
    const pricePoints = params.levelsPerSide * 2; // Total price points

    // The retractOffers function takes 'from' and 'to' parameters
    // Pass 0 to pricePoints to retract all offers
    await writeContractAsync({
      address: kandelAddr,
      abi: KandelABI,
      functionName: 'retractOffers',
      args: [BigInt(0), BigInt(pricePoints)], // Retract from index 0 to all price points
    });

    // If deprovisioning is requested, withdraw ETH provisions separately
    if (opts.deprovision) {
      // The withdrawEth function will handle withdrawal of provisions
      await withdrawEth();
    }
  };

  const withdrawEth = async (amount?: bigint, recipient?: `0x${string}`) => {
    // If no amount specified, get the current balance
    const balance =
      amount ||
      ((await readContract(config, {
        address: ADDRESSES.mangrove,
        abi: MangroveABI,
        functionName: 'balanceOf',
        args: [kandelAddr],
      })) as bigint);

    if (balance > BigInt(0)) {
      // Use Kandel's withdrawFromMangrove function
      await writeContractAsync({
        address: kandelAddr,
        abi: KandelABI,
        functionName: 'withdrawFromMangrove',
        args: [balance, recipient || kandelAddr], // Default to contract address if no recipient
      });
    }
  };

  const withdrawEthToUser = async (
    userAddress: `0x${string}`,
    amount?: bigint
  ) => {
    // Get the current ETH balance from Mangrove
    const balance =
      amount ||
      ((await readContract(config, {
        address: ADDRESSES.mangrove,
        abi: MangroveABI,
        functionName: 'balanceOf',
        args: [kandelAddr],
      })) as bigint);

    if (balance > BigInt(0)) {
      await writeContractAsync({
        address: kandelAddr,
        abi: KandelABI,
        functionName: 'withdrawFromMangrove',
        args: [balance, userAddress],
      });
    }
  };

  const withdrawBaseToken = async (
    amount?: bigint,
    recipient?: `0x${string}`
  ) => {
    // Get the current base token reserve balance
    const baseBalance =
      amount ||
      ((await readContract(config, {
        address: kandelAddr,
        abi: KandelABI,
        functionName: 'reserveBalance',
        args: [1], // 1 = Ask = Base token
      })) as bigint);

    if (baseBalance > BigInt(0)) {
      // Use Kandel's withdrawFunds function
      await writeContractAsync({
        address: kandelAddr,
        abi: KandelABI,
        functionName: 'withdrawFunds',
        args: [baseBalance, BigInt(0), recipient || kandelAddr], // baseAmount, quoteAmount=0, recipient
      });
    }
  };

  const withdrawQuoteToken = async (
    amount?: bigint,
    recipient?: `0x${string}`
  ) => {
    // Get the current quote token reserve balance
    const quoteBalance =
      amount ||
      ((await readContract(config, {
        address: kandelAddr,
        abi: KandelABI,
        functionName: 'reserveBalance',
        args: [0], // 0 = Bid = Quote token
      })) as bigint);

    if (quoteBalance > BigInt(0)) {
      // Use Kandel's withdrawFunds function
      await writeContractAsync({
        address: kandelAddr,
        abi: KandelABI,
        functionName: 'withdrawFunds',
        args: [BigInt(0), quoteBalance, recipient || kandelAddr], // baseAmount=0, quoteAmount, recipient
      });
    }
  };

  const withdrawBothTokens = async (
    baseAmount?: bigint,
    quoteAmount?: bigint,
    recipient?: `0x${string}`
  ) => {
    // Get current reserve balances if amounts not specified
    const baseBalance =
      baseAmount ||
      ((await readContract(config, {
        address: kandelAddr,
        abi: KandelABI,
        functionName: 'reserveBalance',
        args: [1], // 1 = Ask = Base token
      })) as bigint);

    const quoteBalance =
      quoteAmount ||
      ((await readContract(config, {
        address: kandelAddr,
        abi: KandelABI,
        functionName: 'reserveBalance',
        args: [0], // 0 = Bid = Quote token
      })) as bigint);

    if (baseBalance > BigInt(0) || quoteBalance > BigInt(0)) {
      // Use Kandel's withdrawFunds to withdraw both tokens at once
      await writeContractAsync({
        address: kandelAddr,
        abi: KandelABI,
        functionName: 'withdrawFunds',
        args: [baseBalance, quoteBalance, recipient || kandelAddr],
      });
    }
  };

  const withdrawToken = async (
    token: `0x${string}`,
    amount?: bigint,
    recipient?: `0x${string}`
  ) => {
    // Get the actual base and quote token addresses from the Kandel contract
    const [base, quote] = await Promise.all([
      readContract(config, {
        address: kandelAddr,
        abi: KandelABI,
        functionName: 'BASE',
      }),
      readContract(config, {
        address: kandelAddr,
        abi: KandelABI,
        functionName: 'QUOTE',
      }),
    ]);

    const baseToken = base as `0x${string}`;
    const quoteToken = quote as `0x${string}`;

    // Generic token withdrawal function
    if (token === baseToken) {
      await withdrawBaseToken(amount, recipient);
    } else if (token === quoteToken) {
      await withdrawQuoteToken(amount, recipient);
    } else {
      console.error(
        'Kandel only supports withdrawing base and quote tokens through withdrawFunds'
      );
    }
  };

  const retractAndWithdrawAll = async (userAddress: `0x${string}`) => {
    try {
      // Get kandel parameters for price points calculation
      const params = await getParams();
      const pricePoints = params.levelsPerSide * 2;

      // Single atomic operation: retract all offers and withdraw everything
      await writeContractAsync({
        address: kandelAddr,
        abi: KandelABI,
        functionName: 'retractAndWithdraw',
        args: [
          BigInt(0), // from: start at index 0
          BigInt(pricePoints), // to: retract all offers (levelsPerSide * 2)
          MAX_UINT256, // baseAmount: withdraw all base tokens
          MAX_UINT256, // quoteAmount: withdraw all quote tokens
          MAX_UINT256, // freeWei: withdraw all ETH provisions
          userAddress, // recipient: send all withdrawals to user
        ],
      });
    } catch (error) {
      console.error('Failed to completely shut down Kandel position:', error);
      throw error;
    }
  };

  const getReserveBalances = async () => {
    try {
      const [baseBalance, quoteBalance] = await Promise.all([
        readContract(config, {
          address: kandelAddr,
          abi: KandelABI,
          functionName: 'reserveBalance',
          args: [1], // 1 = Ask = Base token
        }),
        readContract(config, {
          address: kandelAddr,
          abi: KandelABI,
          functionName: 'reserveBalance',
          args: [0], // 0 = Bid = Quote token
        }),
      ]);

      return {
        baseBalance: (baseBalance as bigint) || BigInt(0),
        quoteBalance: (quoteBalance as bigint) || BigInt(0),
      };
    } catch (error) {
      throw error;
    }
  };

  const checkAllowance = async (
    tokenAddress: `0x${string}`,
    ownerAddress: `0x${string}`,
    baseAddress: `0x${string}`,
    quoteAddress: `0x${string}`
  ) => {
    try {
      const isBaseToken =
        tokenAddress.toLowerCase() === baseAddress.toLowerCase();

      // For base token deposits: base->quote offers (outbound=base, inbound=quote)
      // For quote token deposits: quote->base offers (outbound=quote, inbound=base)
      const outboundToken = isBaseToken ? baseAddress : quoteAddress;
      const inboundToken = isBaseToken ? quoteAddress : baseAddress;

      const allowance = await readContract(config, {
        address: ADDRESSES.mangrove,
        abi: MangroveABI,
        functionName: 'allowance',
        args: [
          outboundToken, // outbound_tkn (token being offered)
          inboundToken, // inbound_tkn (token being received)
          ownerAddress, // owner (user)
          kandelAddr, // spender (Kandel contract)
        ],
      });
      return allowance as bigint;
    } catch (error) {
      throw error;
    }
  };

  // Removed approveToken function - now using erc20Approve from useTokens

  const depositFunds = async (
    tokenAddress: `0x${string}`,
    amount: bigint,
    userAddress: `0x${string}`
  ) => {
    setLoading(true);
    setError(null);

    try {
      // Get base and quote addresses first
      const [baseAddr, quoteAddr] = await Promise.all([
        readContract(config, {
          address: kandelAddr,
          abi: KandelABI,
          functionName: 'BASE',
        }),
        readContract(config, {
          address: kandelAddr,
          abi: KandelABI,
          functionName: 'QUOTE',
        }),
      ]);

      // Check if we need approval
      const currentAllowance = await checkAllowance(
        tokenAddress,
        userAddress,
        baseAddr as `0x${string}`,
        quoteAddr as `0x${string}`
      );

      if (currentAllowance < amount) {
        // Need approval first
        await erc20Approve(tokenAddress, kandelAddr, amount);
      }

      const isBaseToken =
        tokenAddress.toLowerCase() === (baseAddr as string).toLowerCase();

      // Execute deposit
      await writeContractAsync({
        address: kandelAddr,
        abi: KandelABI,
        functionName: 'depositFunds',
        args: [
          isBaseToken ? amount : BigInt(0),
          isBaseToken ? BigInt(0) : amount,
        ],
      });

      return { success: true };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Deposit failed';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const updateKandelParams = async (
    updates: {
      levels?: number;
      step?: number;
      gasreq?: number;
      minPrice?: number;
      maxPrice?: number;
    },
    tokenInfo: {
      baseSymbol: string;
      quoteSymbol: string;
      baseDecimals: number;
      quoteDecimals: number;
    }
  ) => {
    setLoading(true);
    setError(null);

    try {
      // Get current parameters
      const currentParams = await getParams();
      const tickSpacing = await getTickSpacing();

      // Merge updates with current values
      const levels = updates.levels ?? currentParams.levelsPerSide;
      const step = updates.step ?? currentParams.stepSize;
      const gasreq = updates.gasreq ?? currentParams.gasreq;
      const minPrice = updates.minPrice ?? currentParams.minPrice;
      const maxPrice = updates.maxPrice ?? currentParams.maxPrice;

      const pricePoints = levels * 2;

      // Market parameters no longer needed since we're using populateFromOffset

      // Get current reserves to maintain existing inventory
      const reserves = await getInventory();

      // Calculate geometric distribution parameters
      const tickSpacingInt = Number(tickSpacing);
      const minTick = Math.log(minPrice) / Math.log(1.0001);
      const maxTick = Math.log(maxPrice) / Math.log(1.0001);
      // centerTick no longer needed since we're using populateFromOffset
      const tickOffsetBetweenLevels = BigInt(
        Math.round((maxTick - minTick) / pricePoints / tickSpacingInt) *
          tickSpacingInt
      );

      // Calculate per-level amounts from current reserves to maintain existing inventory
      const bidGivesPerLevel =
        reserves.quoteQty > BigInt(0)
          ? reserves.quoteQty / BigInt(levels)
          : BigInt(1);
      const askGivesPerLevel =
        reserves.baseQty > BigInt(0)
          ? reserves.baseQty / BigInt(levels)
          : BigInt(1);

      // No longer need to create distribution since we're using populateFromOffset

      // Update using populateFromOffset function
      await writeContractAsync({
        address: kandelAddr,
        abi: KandelABI,
        functionName: 'populateFromOffset',
        args: [
          BigInt(0), // from: start index
          BigInt(pricePoints), // to: end index
          BigInt(Math.round(minTick)), // baseQuoteTickIndex0
          tickOffsetBetweenLevels, // _baseQuoteTickOffset
          BigInt(levels), // firstAskIndex
          bidGivesPerLevel, // bidGives
          askGivesPerLevel, // askGives
          {
            gasprice: 0, // Use market gas price
            gasreq: gasreq,
            stepSize: step,
            pricePoints: pricePoints,
          },
          BigInt(0), // baseAmount - maintain current
          BigInt(0), // quoteAmount - maintain current
        ],
        value: BigInt(0), // No additional provision needed for param updates
      });

      return { success: true };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Parameter update failed';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  return {
    getParams,
    getInventory,
    getTickSpacing,
    retractAll,
    withdrawEth,
    withdrawEthToUser,
    withdrawBaseToken,
    withdrawQuoteToken,
    withdrawBothTokens,
    withdrawToken,
    retractAndWithdrawAll,
    getReserveBalances,
    depositFunds,
    updateKandelParams,
    loading,
    error,
  };
}
