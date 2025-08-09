'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAccount, useBalance } from 'wagmi';
import { useMangrove } from '../hooks/useMangrove';
import { useKandelSeeder } from '../hooks/useKandelSeeder';
import { useKandel } from '../hooks/useKandel';
import { useProvision } from '../hooks/useProvision';
import { useTokensInfo } from '../hooks/useTokenInfo';
import { useTokens } from '../hooks/useTokens';
import {
  DEFAULT_STEP,
  DEFAULT_LEVELS_PER_SIDE,
  DEFAULT_PAGE_SIZE,
  MAX_TICK,
  MIN_TICK,
} from '../lib/constants';
import {
  createGeometricDistribution,
  type MarketParams,
} from '@mangrovedao/mgv';
import { maxPriceToTick, minPriceToTick, parseAmount } from '../lib/pricing';
import {
  formatAmount,
  formatEthAmount,
  formatTokenAmount,
} from '../lib/formatting';
import { TokenDisplay } from './TokenDisplay';
import type { Market } from '../hooks/useMarkets';
import { readContract } from '@wagmi/core';
import { config } from '../hooks/useChain';
import { readerAbi } from '../abi/reader';
import { ADDRESSES } from '../lib/addresses';
import {
  validateStepSize,
  validateLevelsPerSide,
  validatePriceRange,
} from '@/lib/validation';

interface KandelFormProps {
  kandelAddress?: `0x${string}`;
  onSuccess?: (address: `0x${string}`) => void;
  market?: Market;
  isEditing?: boolean;
}

// Type definitions for order book operations
type OLKey = {
  outbound_tkn: `0x${string}`;
  inbound_tkn: `0x${string}`;
  tickSpacing: bigint;
};

type OfferWithTick = {
  id: bigint;
  tick: bigint;
  gives: bigint;
  maker: `0x${string}`;
};

/**
 * Fetch all live offers for a specific maker on one side of the book.
 * Handles pagination if needed (though typically not required for Kandel grids).
 */
async function fetchMakerOffers(
  reader: `0x${string}`,
  key: OLKey,
  maker: `0x${string}`,
  page = BigInt(DEFAULT_PAGE_SIZE) // how many rows per offerList call
): Promise<OfferWithTick[]> {
  const res: OfferWithTick[] = [];
  let cursor = BigInt(0);

  while (true) {
    const [, ids, offers, details] = (await readContract(config, {
      address: reader,
      abi: readerAbi,
      functionName: 'offerList',
      args: [key, cursor, page],
    })) as [any, bigint[], any[], any[]];

    // Filter and collect offers from this maker
    ids.forEach((id, i) => {
      const offerMaker = details[i]?.maker as `0x${string}`;
      if (offerMaker && offerMaker.toLowerCase() === maker.toLowerCase()) {
        const tick = offers[i]?.tick as bigint;
        const gives = offers[i]?.gives as bigint;
        if (tick !== undefined) {
          res.push({ id, tick, gives, maker: offerMaker });
        }
      }
    });

    // Check if we've reached the end of the list
    if (ids.length < Number(page)) break;

    // For pagination (rarely needed for Kandel)
    cursor = ids[ids.length - 1];
  }

  return res;
}

/**
 * Extract min and max ticks from an array of offers.
 * Pure function for easy testing and reusability.
 * Optimized to find both min and max in a single pass.
 */
function extractMinMaxTicks(
  offers: OfferWithTick[]
): { minTick: bigint; maxTick: bigint } | null {
  if (offers.length === 0) {
    return null;
  }

  // Find min and max in a single pass through the array
  const { minTick, maxTick } = offers.reduce(
    (acc, offer) => ({
      minTick: offer.tick < acc.minTick ? offer.tick : acc.minTick,
      maxTick: offer.tick > acc.maxTick ? offer.tick : acc.maxTick,
    }),
    { minTick: offers[0].tick, maxTick: offers[0].tick }
  );

  return { minTick, maxTick };
}

/**
 * Fetch Kandel's offers from both sides of the book and extract min/max ticks.
 * Optimized to fetch both sides in parallel for better performance.
 */
async function fetchKandelTicks(
  kandelAddr: `0x${string}`,
  base: `0x${string}`,
  quote: `0x${string}`,
  tickSpacing: bigint
): Promise<{ minTick: bigint; maxTick: bigint } | null> {
  try {
    const reader = ADDRESSES.mgvReader;

    // Define keys for both sides of the book
    const bidsKey: OLKey = {
      outbound_tkn: quote,
      inbound_tkn: base,
      tickSpacing,
    };
    const asksKey: OLKey = {
      outbound_tkn: base,
      inbound_tkn: quote,
      tickSpacing,
    };

    // Fetch both sides in parallel for performance
    const [myBids, myAsks] = await Promise.all([
      fetchMakerOffers(reader, bidsKey, kandelAddr),
      fetchMakerOffers(reader, asksKey, kandelAddr),
    ]);

    // Combine all offers
    const allOffers = [...myBids, ...myAsks];

    if (allOffers.length === 0) {
      return null;
    }

    // Extract min and max ticks
    const result = extractMinMaxTicks(allOffers);

    return result;
  } catch (error) {
    console.error('Unable to load Kandel position data:', error);
    return null;
  }
}

/**
 * Helper function to calculate accurate ask/bid counts for provision calculation.
 * Creates geometric distribution internally and returns only the counts we need.
 */
function getGeometricDistributionOffersCounts(params: {
  baseQuoteTickIndex0: bigint;
  baseQuoteTickOffset: bigint;
  firstAskIndex: bigint;
  pricePoints: bigint;
  stepSize: bigint;
  market: MarketParams;
  bidGives: bigint;
  askGives: bigint;
}): { askCount: number; bidCount: number } {
  const distribution = createGeometricDistribution(params);
  return {
    askCount: distribution.asks.length,
    bidCount: distribution.bids.length,
  };
}

export function KandelForm({
  kandelAddress,
  onSuccess,
  market,
  isEditing = false,
}: KandelFormProps) {
  // Determine tokens from market prop or kandel params
  const [base, setBase] = useState<`0x${string}`>(
    market?.baseToken || ('0x0' as `0x${string}`)
  );
  const [quote, setQuote] = useState<`0x${string}`>(
    market?.quoteToken || ('0x0' as `0x${string}`)
  );
  const [tickSpacing, setTickSpacing] = useState<bigint>(
    market?.tickSpacing || BigInt(1)
  );

  // Check for valid tokens and market data
  const hasValidTokens = base !== '0x0' && quote !== '0x0';
  const [minPrice, setMinPrice] = useState('1000');
  const [maxPrice, setMaxPrice] = useState('2000');
  const [step, setStep] = useState(DEFAULT_STEP.toString());
  const [levelsPerSide, setLevelsPerSide] = useState(
    DEFAULT_LEVELS_PER_SIDE.toString()
  );
  const [gasreq, setGasreq] = useState('200000');
  const [baseAmount, setBaseAmount] = useState('');
  const [quoteAmount, setQuoteAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // New state for enhancements
  const [minVolumeError, setMinVolumeError] = useState<string | null>(null);
  const [stepSizeError, setStepSizeError] = useState<string | null>(null);
  const [priceRangeError, setPriceRangeError] = useState<string | null>(null);
  const [levelsPerSideError, setLevelsPerSideError] = useState<string | null>(
    null
  );

  // Track whether user has edited price fields
  const [minPriceTouched, setMinPriceTouched] = useState(false);
  const [maxPriceTouched, setMaxPriceTouched] = useState(false);

  // Edit mode state
  const [addInventory, setAddInventory] = useState(!isEditing);

  // Fetch Kandel reserve balances (internal inventory)
  const [kandelReserves, setKandelReserves] = useState<{
    baseQty: bigint;
    quoteQty: bigint;
  } | null>(null);

  // Check if Kandel has reserves to determine checkbox behavior
  // If no reserves exist, force addInventory=true (user must add amounts)
  // If reserves exist, allow user to choose between using reserves or adding more

  // New state for exact tick values from contract
  const [baseQuoteTickOffset, setBaseQuoteTickOffset] = useState<bigint | null>(
    null
  );
  const [baseQuoteTickIndex0, setBaseQuoteTickIndex0] = useState<bigint | null>(
    null
  );
  const hasReserves =
    kandelReserves &&
    (kandelReserves.baseQty > BigInt(0) || kandelReserves.quoteQty > BigInt(0));
  const forceAddInventory = isEditing && !hasReserves;

  // Initial values reference for dirty field detection
  const initialValues = useRef({
    minPrice: '',
    maxPrice: '',
    levelsPerSide: '',
    step: '',
    gasreq: '',
    minTick: null as bigint | null,
    maxTick: null as bigint | null,
    baseQuoteTickOffset: null as bigint | null,
    baseQuoteTickIndex0: null as bigint | null,
  });

  // Dirty field detection - only active in edit mode
  const dirty = isEditing
    ? {
        minMax: minPriceTouched || maxPriceTouched,
        levels: levelsPerSide !== initialValues.current.levelsPerSide,
        step: step !== initialValues.current.step,
        gasreq: gasreq !== initialValues.current.gasreq,
        inventory: addInventory,
      }
    : null;

  const { getLocalConfig, getMakerFreeBalance, getProvision } = useMangrove();
  const { create } = useKandelSeeder();
  const kandel = useKandel(kandelAddress || ('0x0' as `0x${string}`));
  const { tokensInfo, loading: tokensLoading } = useTokensInfo(
    hasValidTokens ? [base, quote] : []
  );
  const { minGives, missing } = useProvision();
  const { erc20Approve } = useTokens();

  // Helper function to filter numeric input for price fields
  const handlePriceChange = (
    value: string,
    setter: (val: string) => void,
    touchSetter?: (val: boolean) => void
  ) => {
    // Allow only digits, one decimal point, and no leading/trailing spaces
    const numericValue = value.replace(/[^0-9.]/g, '');

    // Prevent multiple decimal points
    const parts = numericValue.split('.');
    if (parts.length > 2) {
      return; // Don't update if multiple decimals attempted
    }

    setter(numericValue);

    // Mark field as touched if in edit mode
    if (touchSetter && isEditing) {
      touchSetter(true);
    }
  };

  // Fetch kandel params when kandelAddress is provided
  useEffect(() => {
    if (kandelAddress && !market) {
      const fetchKandelParams = async () => {
        try {
          const [params, tickSpacingValue, reserves] = await Promise.all([
            kandel.getParams(),
            kandel.getTickSpacing(),
            kandel.getInventory(),
          ]);
          setBase(params.base);
          setQuote(params.quote);
          setTickSpacing(tickSpacingValue);
          setGasreq(params.gasreq.toString());
          setMinPrice(params.minPrice.toString());
          setMaxPrice(params.maxPrice.toString());
          setLevelsPerSide(params.levelsPerSide.toString());
          setStep(params.stepSize.toString());

          // Set new tick values if available
          if (params.baseQuoteTickOffset) {
            setBaseQuoteTickOffset(params.baseQuoteTickOffset);
          }
          if (params.baseQuoteTickIndex0) {
            setBaseQuoteTickIndex0(params.baseQuoteTickIndex0);
          }

          // Set Kandel reserve balances
          setKandelReserves(reserves);

          // Fetch original ticks from the offer book
          let originalTicks = null;
          if (isEditing) {
            originalTicks = await fetchKandelTicks(
              kandelAddress,
              params.base,
              params.quote,
              tickSpacingValue
            );
          }

          // Set initial values for dirty field detection
          if (isEditing) {
            initialValues.current = {
              minPrice: params.minPrice.toString(),
              maxPrice: params.maxPrice.toString(),
              levelsPerSide: params.levelsPerSide.toString(),
              step: params.stepSize.toString(),
              gasreq: params.gasreq.toString(),
              minTick: originalTicks?.minTick || params.minTick || null,
              maxTick: originalTicks?.maxTick || params.maxTick || null,
              baseQuoteTickOffset: params.baseQuoteTickOffset || null,
              baseQuoteTickIndex0: params.baseQuoteTickIndex0 || null,
            };
          }
        } catch (error) {
          console.error('Unable to load Kandel configuration:', error);
        }
      };
      fetchKandelParams();
    }
  }, [kandelAddress, market, isEditing]); // Added isEditing dependency

  // Dynamic token info fetching - only if we have valid tokens

  // Extract token info for display
  const baseTokenInfo = tokensInfo.find(
    (t) => t?.address.toLowerCase() === base.toLowerCase()
  );
  const quoteTokenInfo = tokensInfo.find(
    (t) => t?.address.toLowerCase() === quote.toLowerCase()
  );

  // Direction-specific configs for accurate minVolume validation
  const [askDensity, setAskDensity] = useState<bigint>(BigInt(0)); // base->quote (asks)
  const [bidDensity, setBidDensity] = useState<bigint>(BigInt(0)); // quote->base (bids)
  const [askOfferGasbase, setAskOfferGasbase] = useState<bigint>(BigInt(0));
  const [bidOfferGasbase, setBidOfferGasbase] = useState<bigint>(BigInt(0));

  // Legacy single-direction config for backward compatibility
  const [offerGasbase, setOfferGasbase] = useState<bigint>(BigInt(0));
  const [density, setDensity] = useState<bigint>(BigInt(0));
  const [configLoading, setConfigLoading] = useState<boolean>(
    // Start loading if we have kandelAddress (need to wait for tokens)
    // Don't start loading if we have market (tokens available immediately)
    kandelAddress && !market ? true : false
  );
  const [provision, setProvision] = useState({
    perOffer: BigInt(0),
    total: BigInt(0),
    missing: BigInt(0),
  });

  // User balance state for provision calculation
  const [userFreeBalance, setUserFreeBalance] = useState<bigint>(BigInt(0));

  // Wrap getMakerFreeBalance in useCallback to prevent rerenders
  const getMakerFreeBalanceCallback = useCallback(getMakerFreeBalance, [
    getMakerFreeBalance,
  ]);

  useEffect(() => {
    const fetchConfig = async () => {
      // Only fetch config if we have valid tokens
      if (!hasValidTokens) {
        setConfigLoading(false);
        return;
      }

      try {
        setConfigLoading(true);

        // Fetch ask config (base->quote direction)
        const askConfig = await getLocalConfig(base, quote, tickSpacing);
        setAskDensity(askConfig.density);
        setAskOfferGasbase(askConfig.offerGasbase);

        // Fetch bid config (quote->base direction)
        const bidConfig = await getLocalConfig(quote, base, tickSpacing);
        setBidDensity(bidConfig.density);
        setBidOfferGasbase(bidConfig.offerGasbase);

        // Keep legacy single config for backward compatibility (use ask config)
        setOfferGasbase(askConfig.offerGasbase);
        setDensity(askConfig.density);

        if (!askConfig.active) {
        }
      } catch (err) {
        console.error('Unable to load market configuration:', err);
      } finally {
        setConfigLoading(false);
      }
    };

    fetchConfig();
  }, [base, quote, tickSpacing, getLocalConfig, hasValidTokens]);

  // Real-time stepSize validation - runs immediately on step/levelsPerSide change
  useEffect(() => {
    // Clear previous error
    setStepSizeError(null);

    // Skip if values are empty
    if (!step.trim() || !levelsPerSide.trim()) return;

    const stepSizeInt = parseInt(step);
    const levelsInt = parseInt(levelsPerSide);
    const pricePoints = levelsInt * 2;

    // Validate stepSize immediately
    const stepSizeValidation = validateStepSize(stepSizeInt, pricePoints);
    if (stepSizeValidation) {
      setStepSizeError(stepSizeValidation);
    }
  }, [step, levelsPerSide]);

  // Real-time levels per side validation
  useEffect(() => {
    // Clear previous error
    setLevelsPerSideError(null);

    // Skip if value is empty
    if (!levelsPerSide.trim()) return;

    const levelsInt = parseInt(levelsPerSide);

    // Check if it's a valid number
    if (isNaN(levelsInt)) {
      setLevelsPerSideError('Levels per side must be a number');
      return;
    }

    // Validate using the validation function
    const validation = validateLevelsPerSide(levelsInt);
    if (validation) {
      setLevelsPerSideError(validation);
    }
  }, [levelsPerSide]);

  // Load user free balance for provision calculation
  useEffect(() => {
    async function loadUserBalance() {
      if (kandelAddress) {
        try {
          const balance = await getMakerFreeBalanceCallback(kandelAddress);
          setUserFreeBalance(balance);
        } catch (error) {
          setUserFreeBalance(BigInt(0));
        }
      } else {
        setUserFreeBalance(BigInt(0));
      }
    }
    loadUserBalance();
  }, [kandelAddress, getMakerFreeBalanceCallback]);

  // Real-time price range validation - runs immediately when min/max prices change
  useEffect(() => {
    // Clear previous error
    setPriceRangeError(null);

    // Skip if either value is empty
    if (!minPrice.trim() || !maxPrice.trim()) return;

    const minP = parseFloat(minPrice);
    const maxP = parseFloat(maxPrice);

    // Check if both are valid numbers
    if (!isFinite(minP)) {
      setPriceRangeError('Min price must be a valid number');
      return;
    }
    if (!isFinite(maxP)) {
      setPriceRangeError('Max price must be a valid number');
      return;
    }

    // Check if min price is positive
    if (minP <= 0) {
      setPriceRangeError('Min price must be greater than 0');
      return;
    }

    // Check if max price is greater than min price
    if (maxP <= minP) {
      setPriceRangeError('Max price must be greater than min price');
      return;
    }
  }, [minPrice, maxPrice]);

  // Real-time minVolume validation - runs immediately when amounts/levels change
  useEffect(() => {
    // Clear previous error
    setMinVolumeError(null);

    // Skip if required values are empty or missing
    if (!baseAmount.trim() || !quoteAmount.trim() || !levelsPerSide.trim())
      return;
    if (configLoading || askDensity === BigInt(0) || bidDensity === BigInt(0))
      return;

    // Skip if token info not loaded yet
    const baseTokenInfo = tokensInfo.find(
      (t) => t?.address.toLowerCase() === base.toLowerCase()
    );
    const quoteTokenInfo = tokensInfo.find(
      (t) => t?.address.toLowerCase() === quote.toLowerCase()
    );

    if (!baseTokenInfo || !quoteTokenInfo) return;

    try {
      // Parse amounts and calculate per-level amounts
      const baseAmountWei = parseAmount(baseAmount, baseTokenInfo.decimals);
      const quoteAmountWei = parseAmount(quoteAmount, quoteTokenInfo.decimals);
      const levelsInt = parseInt(levelsPerSide);
      const gasreqBigInt = BigInt(gasreq);

      // Calculate minimum required gives for each direction
      const minRequiredGivesAsk = minGives(
        askDensity,
        askOfferGasbase,
        gasreqBigInt
      ); // base->quote (asks)
      const minRequiredGivesBid = minGives(
        bidDensity,
        bidOfferGasbase,
        gasreqBigInt
      ); // quote->base (bids)

      // Calculate per-level amounts
      const perLevelBase = baseAmountWei / BigInt(levelsInt);
      const perLevelQuote = quoteAmountWei / BigInt(levelsInt);

      // Validate base amount per level (for asks: base->quote)
      if (perLevelBase < minRequiredGivesAsk) {
        setMinVolumeError(
          `Base amount per level (${formatTokenAmount(
            perLevelBase,
            baseTokenInfo.decimals
          )} ${
            baseTokenInfo.symbol
          }) is below minimum required for asks (${formatTokenAmount(
            minRequiredGivesAsk,
            baseTokenInfo.decimals
          )} ${baseTokenInfo.symbol})`
        );
        return;
      }

      // Validate quote amount per level (for bids: quote->base)
      if (perLevelQuote < minRequiredGivesBid) {
        setMinVolumeError(
          `Quote amount per level (${formatTokenAmount(
            perLevelQuote,
            quoteTokenInfo.decimals
          )} ${
            quoteTokenInfo.symbol
          }) is below minimum required for bids (${formatTokenAmount(
            minRequiredGivesBid,
            quoteTokenInfo.decimals
          )} ${quoteTokenInfo.symbol})`
        );
        return;
      }
    } catch (error) {
      // Silently handle parsing errors - user is still typing
    }
  }, [
    baseAmount,
    quoteAmount,
    levelsPerSide,
    tokensInfo,
    askDensity,
    bidDensity,
    askOfferGasbase,
    bidOfferGasbase,
    gasreq,
    configLoading,
    base,
    quote,
    minGives,
  ]);

  // Note: Provision now calculated per-side (ask + bid) rather than total offers

  // Calculate provision per side (asks and bids) - debounced to avoid excessive calls
  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      const gasreqBigInt = BigInt(gasreq);
      const levels = BigInt(parseInt(levelsPerSide) || 0);

      if (configLoading || levels === BigInt(0)) {
        setProvision({
          perOffer: BigInt(0),
          total: BigInt(0),
          missing: missing(BigInt(0), BigInt(0), userFreeBalance),
        });
        return;
      }

      // Validate required parameters - allow empty amounts when editing with existing inventory
      const hasRequiredPriceParams =
        minPrice.trim() && maxPrice.trim() && step.trim();
      const hasUserAmounts = baseAmount.trim() && quoteAmount.trim();
      const hasKandelInventory =
        isEditing &&
        kandelReserves &&
        (kandelReserves.baseQty > BigInt(0) ||
          kandelReserves.quoteQty > BigInt(0));

      if (!hasRequiredPriceParams || (!hasUserAmounts && !hasKandelInventory)) {
        // Set to 0 when parameters incomplete - no fallback estimates
        setProvision({
          perOffer: BigInt(0),
          total: BigInt(0),
          missing: missing(BigInt(0), BigInt(0), userFreeBalance),
        });
        return;
      }

      try {
        // Build token objects for distribution creation
        const baseTokenInfo = tokensInfo.find(
          (t) => t?.address.toLowerCase() === base.toLowerCase()
        );
        const quoteTokenInfo = tokensInfo.find(
          (t) => t?.address.toLowerCase() === quote.toLowerCase()
        );

        if (!baseTokenInfo || !quoteTokenInfo) {
          // Set to 0 when token info not available
          setProvision({
            perOffer: BigInt(0),
            total: BigInt(0),
            missing: missing(BigInt(0), BigInt(0), userFreeBalance),
          });
          return;
        }

        // Parse levelsPerSide for calculations
        const levelsInt = parseInt(levelsPerSide);

        // Safety check: ensure levels is not zero before any calculations
        if (levelsInt <= 0) {
          setProvision({
            perOffer: BigInt(0),
            total: BigInt(0),
            missing: missing(BigInt(0), BigInt(0), userFreeBalance),
          });
          return;
        }

        // Parse form values and create distribution parameters
        const minP = parseFloat(minPrice);
        const maxP = parseFloat(maxPrice);
        // levelsInt already declared above
        const baseAmountWei = parseAmount(baseAmount, baseTokenInfo.decimals);
        const quoteAmountWei = parseAmount(
          quoteAmount,
          quoteTokenInfo.decimals
        );

        // Check if we have amounts for distribution calculation
        const canUseUserAmounts =
          baseAmountWei > BigInt(0) && quoteAmountWei > BigInt(0);
        const canUseKandelInventory =
          isEditing &&
          kandelReserves &&
          (kandelReserves.baseQty > BigInt(0) ||
            kandelReserves.quoteQty > BigInt(0));

        if (!canUseUserAmounts && !canUseKandelInventory) {
          setProvision({
            perOffer: BigInt(0),
            total: BigInt(0),
            missing: missing(BigInt(0), BigInt(0), userFreeBalance),
          });
          return;
        }

        // Calculate distribution parameters with bounds checking
        const minTick = minPriceToTick(minP);
        const maxTick = maxPriceToTick(maxP);

        // Bounds checking for tick values to prevent overflow
        const rangeValidationError = validatePriceRange(minTick, maxTick);
        if (rangeValidationError) {
          throw new Error(rangeValidationError);
        }

        const totalTickRange = maxTick - minTick;
        const tickOffsetBetweenLevels = BigInt(
          Math.floor(totalTickRange / (levelsInt * 2 - 1))
        );

        // Create market parameters
        const marketParams = {
          base: {
            address: base,
            symbol: baseTokenInfo.symbol,
            decimals: baseTokenInfo.decimals,
            displayDecimals: 3,
            priceDisplayDecimals: 4,
            mgvTestToken: false,
          },
          quote: {
            address: quote,
            symbol: quoteTokenInfo.symbol,
            decimals: quoteTokenInfo.decimals,
            displayDecimals: 3,
            priceDisplayDecimals: 4,
            mgvTestToken: false,
          },
          tickSpacing,
        };

        // Determine amounts for distribution - use Kandel inventory if user amounts are zero
        let bidGivesForProvision: bigint;
        let askGivesForProvision: bigint;

        if (canUseUserAmounts) {
          // Use user input amounts
          bidGivesForProvision = quoteAmountWei / BigInt(levelsInt);
          askGivesForProvision = baseAmountWei / BigInt(levelsInt);
        } else {
          // Use Kandel inventory (when editing with addInventory=false)
          bidGivesForProvision =
            kandelReserves!.quoteQty > BigInt(0)
              ? kandelReserves!.quoteQty / BigInt(levelsInt)
              : BigInt(1);
          askGivesForProvision =
            kandelReserves!.baseQty > BigInt(0)
              ? kandelReserves!.baseQty / BigInt(levelsInt)
              : BigInt(1);
        }

        // Calculate accurate ask/bid counts using geometric distribution
        const { askCount, bidCount } = getGeometricDistributionOffersCounts({
          baseQuoteTickIndex0: BigInt(minTick),
          baseQuoteTickOffset: tickOffsetBetweenLevels,
          firstAskIndex: BigInt(levelsInt),
          pricePoints: BigInt(levelsInt * 2),
          stepSize: BigInt(parseInt(step)),
          market: marketParams,
          bidGives: bidGivesForProvision,
          askGives: askGivesForProvision,
        });

        // Per-offer provision for each OLKey
        const perAsk = await getProvision(
          base,
          quote,
          tickSpacing,
          gasreqBigInt
        );
        const perBid = await getProvision(
          quote,
          base,
          tickSpacing,
          gasreqBigInt
        );

        // Use ACTUAL counts for provision calculation
        // const askCnt = BigInt(askCount);
        const askCnt = BigInt(askCount);
        // const bidCnt = BigInt(bidCount);
        const bidCnt = BigInt(bidCount);
        const actualTotalNeeded = perAsk * askCnt + perBid * bidCnt;

        setProvision({
          perOffer: perAsk > perBid ? perAsk : perBid,
          total: actualTotalNeeded,
          missing: missing(actualTotalNeeded, BigInt(0), userFreeBalance),
        });
      } catch (error) {
        // Set to 0 on any error - no fallback estimates
        setProvision({
          perOffer: BigInt(0),
          total: BigInt(0),
          missing: missing(BigInt(0), BigInt(0), userFreeBalance),
        });
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [
    gasreq,
    levelsPerSide,
    configLoading,
    base,
    quote,
    tickSpacing,
    getProvision,
    // Add these for distribution calculation:
    minPrice,
    maxPrice,
    step,
    baseAmount,
    quoteAmount,
    tokensInfo, // Need for token decimals
    density, // For minVolume validation
    offerGasbase, // For minVolume validation
    // Add missing dependencies for inventory handling:
    kandelReserves,
    isEditing,
    addInventory,
    userFreeBalance, // User's balance for missing provision calculation
    missing, // Missing calculation function
  ]);

  const validateForm = (): string | null => {
    // Basic required field validation
    if (!minPrice.trim()) {
      return 'Min price is required';
    }
    if (!maxPrice.trim()) {
      return 'Max price is required';
    }

    // Amount validation - only required when not in edit mode OR when addInventory is checked OR when no reserves exist
    const amountRequired = !isEditing || addInventory || forceAddInventory;
    if (amountRequired && !baseAmount.trim()) {
      return 'Base amount is required';
    }
    if (amountRequired && !quoteAmount.trim()) {
      return 'Quote amount is required';
    }

    // Validate levels per side
    const levels = parseInt(levelsPerSide);
    if (!isFinite(levels) || levels <= 0) {
      return 'Levels per side must be a positive number';
    }

    // Validate amounts only if required
    if (amountRequired) {
      const baseAmt = parseFloat(baseAmount);
      const quoteAmt = parseFloat(quoteAmount);

      if (!isFinite(baseAmt) || baseAmt <= 0) {
        return 'Base amount must be a positive number';
      }
      if (!isFinite(quoteAmt) || quoteAmt <= 0) {
        return 'Quote amount must be a positive number';
      }
    }

    // Check if token information is loaded
    if (!baseTokenInfo || !quoteTokenInfo) {
      return 'Token information not loaded. Please wait...';
    }

    return null;
  };

  // Simplified handleSubmit: always retractAll when editing, always use populateFromOffset
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    // Ensure token information is loaded before proceeding
    if (tokensLoading || !hasValidTokens) {
      setError('Loading token information, please wait...');
      return;
    }

    if (!hasValidTokens) {
      setError(
        'Invalid token addresses. Please ensure tokens are properly loaded.'
      );
      return;
    }

    if (tokensLoading) {
      setError('Loading token information, please wait...');
      return;
    }

    setLoading(true);

    try {
      let address = kandelAddress;

      // Build token objects with dynamic configuration from blockchain
      const baseTokenInfo = tokensInfo.find(
        (t) => t?.address.toLowerCase() === base.toLowerCase()
      );
      const quoteTokenInfo = tokensInfo.find(
        (t) => t?.address.toLowerCase() === quote.toLowerCase()
      );

      // Ensure we have proper token info before proceeding
      if (!baseTokenInfo || !quoteTokenInfo) {
        throw new Error(
          'Token data is still loading. Please wait a moment and try again.'
        );
      }

      if (!address) {
        // Create new Kandel
        address = await create({
          base,
          quote,
          tickSpacing,
        });
      } else if (isEditing) {
        // Always retract all offers when editing to ensure fresh, up-to-date offers
        await kandel.retractAll({ deprovision: false });
      }

      const baseTokenDec = baseTokenInfo.decimals;
      const quoteTokenDec = quoteTokenInfo.decimals;

      // Parse user input amounts to proper wei/units
      // In edit mode with addInventory=false, use Kandel inventory if available
      let baseAmountWei = BigInt(0);
      let quoteAmountWei = BigInt(0);

      if (!isEditing) {
        // Create mode: Use user input amounts
        baseAmountWei = parseAmount(baseAmount, baseTokenInfo.decimals);
        quoteAmountWei = parseAmount(quoteAmount, quoteTokenInfo.decimals);

        // Add missing approvals in create mode
        if (baseAmountWei > BigInt(0)) {
          await erc20Approve(base, address, baseAmountWei);
        }
        if (quoteAmountWei > BigInt(0)) {
          await erc20Approve(quote, address, quoteAmountWei);
        }
      } else if (addInventory) {
        // Edit mode with addInventory=true: Add user amounts to existing inventory
        const userBaseWei = parseAmount(baseAmount, baseTokenDec);
        const userQuoteWei = parseAmount(quoteAmount, quoteTokenDec);
        baseAmountWei = (kandelReserves?.baseQty || BigInt(0)) + userBaseWei;
        quoteAmountWei = (kandelReserves?.quoteQty || BigInt(0)) + userQuoteWei;

        // Approve tokens only for the user's additional amounts (not the total)
        if (userBaseWei > BigInt(0)) {
          await erc20Approve(base, address, userBaseWei);
        }
        if (userQuoteWei > BigInt(0)) {
          await erc20Approve(quote, address, userQuoteWei);
        }
      } else if (
        isEditing &&
        !addInventory &&
        kandelReserves &&
        (kandelReserves.baseQty > BigInt(0) ||
          kandelReserves.quoteQty > BigInt(0))
      ) {
        // Use Kandel inventory amounts (editing without adding inventory, when reserves exist)
        baseAmountWei = kandelReserves.baseQty;
        quoteAmountWei = kandelReserves.quoteQty;
        // Note: No token approval needed since inventory is already in the contract
      } else {
        // If editing empty Kandel with user amounts, we need approvals for those amounts
        if (
          isEditing &&
          baseAmount &&
          parseAmount(baseAmount, baseTokenDec) > BigInt(0)
        ) {
          const userBaseWei = parseAmount(baseAmount, baseTokenDec);
          await erc20Approve(base, address, userBaseWei);
        }

        if (
          isEditing &&
          quoteAmount &&
          parseAmount(quoteAmount, quoteTokenDec) > BigInt(0)
        ) {
          const userQuoteWei = parseAmount(quoteAmount, quoteTokenDec);
          await erc20Approve(quote, address, userQuoteWei);
        }
      }

      // Separate amounts for contract call vs distribution creation
      let baseAmountForContract = BigInt(0);
      let quoteAmountForContract = BigInt(0);

      if (!isEditing) {
        // Create mode - use parsed user amounts
        baseAmountForContract = baseAmountWei;
        quoteAmountForContract = quoteAmountWei;
      } else if (addInventory) {
        // Edit mode with addInventory=true - send only user amounts to contract
        baseAmountForContract = parseAmount(baseAmount, baseTokenDec);
        quoteAmountForContract = parseAmount(quoteAmount, quoteTokenDec);
      } else {
        // Edit mode without adding inventory - use 0 amounts, unless Kandel is empty
        if (
          kandelReserves &&
          kandelReserves.baseQty === BigInt(0) &&
          kandelReserves.quoteQty === BigInt(0)
        ) {
          // Empty Kandel - use user amounts as contract amounts
          baseAmountForContract = baseAmount
            ? parseAmount(baseAmount, baseTokenDec)
            : BigInt(0);
          quoteAmountForContract = quoteAmount
            ? parseAmount(quoteAmount, quoteTokenDec)
            : BigInt(0);
        } else {
          // Kandel has existing inventory - use 0 amounts
          baseAmountForContract = BigInt(0);
          quoteAmountForContract = BigInt(0);
        }
      }

      // Calculate parameters for distribution
      const minP = parseFloat(minPrice);
      const maxP = parseFloat(maxPrice);
      const levels = parseInt(levelsPerSide);
      const pricePoints = levels * 2;

      // Get gasreq as BigInt for provision calculations
      const gasreqBigInt = BigInt(gasreq);

      // Always calculate parameters for populateFromOffset
      let minTick: bigint;
      let maxTick: bigint;
      let tickOffsetBetweenLevels: bigint;
      let bidGivesPerLevel: bigint;
      let askGivesPerLevel: bigint;

      // Calculate ticks - use exact contract values when available and prices untouched
      if (
        isEditing &&
        !minPriceTouched &&
        !maxPriceTouched &&
        initialValues.current.baseQuoteTickOffset !== null &&
        initialValues.current.baseQuoteTickIndex0 !== null
      ) {
        // Use exact contract values when prices untouched
        const levelsCount = BigInt(levels);
        const baseOffset = initialValues.current.baseQuoteTickOffset;
        const baseIndex0 = initialValues.current.baseQuoteTickIndex0;

        // Calculate min/max ticks using the exact formula
        minTick = baseIndex0 - levelsCount * baseOffset;
        maxTick = baseIndex0 + (levelsCount - BigInt(1)) * baseOffset;
        tickOffsetBetweenLevels = baseOffset;
      } else if (
        isEditing &&
        !minPriceTouched &&
        !maxPriceTouched &&
        initialValues.current.minTick !== null &&
        initialValues.current.maxTick !== null
      ) {
        // Fallback to stored min/max ticks if we don't have baseQuoteTickOffset
        minTick = initialValues.current.minTick;
        maxTick = initialValues.current.maxTick;
        const totalTickRange = maxTick - minTick;
        tickOffsetBetweenLevels = totalTickRange / BigInt(pricePoints - 1);
      } else {
        // Recalculate from user input (create mode or prices edited)
        minTick = BigInt(minPriceToTick(minP));
        maxTick = BigInt(maxPriceToTick(maxP));
        const totalTickRange = maxTick - minTick;
        tickOffsetBetweenLevels = totalTickRange / BigInt(pricePoints - 1);
      }

      // Guard against zero offset (from PATCH safety measures)
      if (tickOffsetBetweenLevels === BigInt(0)) {
        tickOffsetBetweenLevels = BigInt(1);
      }

      // Calculate per-level amounts
      if (
        isEditing &&
        !addInventory &&
        kandelReserves &&
        (kandelReserves.baseQty > BigInt(0) ||
          kandelReserves.quoteQty > BigInt(0))
      ) {
        // Safety check: ensure levels is not zero before division
        if (levels <= 0) {
          throw new Error('Number of price levels must be at least 1.');
        }
        // Use existing Kandel reserves divided by levels
        // Handle cases where only one token has inventory
        bidGivesPerLevel =
          kandelReserves.quoteQty > BigInt(0)
            ? kandelReserves.quoteQty / BigInt(levels)
            : BigInt(1);
        askGivesPerLevel =
          kandelReserves.baseQty > BigInt(0)
            ? kandelReserves.baseQty / BigInt(levels)
            : BigInt(1);

        // Validate reserves can cover the grid requirements (only check tokens with inventory)
        const totalBaseRequired = askGivesPerLevel * BigInt(levels);
        const totalQuoteRequired = bidGivesPerLevel * BigInt(levels);

        const hasInsufficientBase =
          kandelReserves.baseQty > BigInt(0) &&
          kandelReserves.baseQty < totalBaseRequired;
        const hasInsufficientQuote =
          kandelReserves.quoteQty > BigInt(0) &&
          kandelReserves.quoteQty < totalQuoteRequired;

        if (hasInsufficientBase || hasInsufficientQuote) {
          let errorMsg = `Not enough tokens in reserve for ${levels} price levels. `;
          if (hasInsufficientBase) {
            errorMsg += `Need ${formatTokenAmount(
              totalBaseRequired,
              baseTokenInfo.decimals
            )} ${baseTokenInfo.symbol} `;
          }
          if (hasInsufficientQuote) {
            errorMsg += `Need ${formatTokenAmount(
              totalQuoteRequired,
              quoteTokenInfo.decimals
            )} ${quoteTokenInfo.symbol} `;
          }
          errorMsg += `Enable "Deposit entered amounts into Kandel inventory" to add more funds.`;
          throw new Error(errorMsg);
        }
      } else {
        // Safety check: ensure levels is not zero before division
        if (levels <= 0) {
          throw new Error('Number of price levels must be at least 1.');
        }

        // Use combined amounts (for create mode or addInventory=true with total inventory)
        // For edit mode with empty reserves, parse user inputs for distribution
        let distributionBaseAmount = baseAmountWei;
        let distributionQuoteAmount = quoteAmountWei;

        if (
          isEditing &&
          baseAmountWei === BigInt(0) &&
          quoteAmountWei === BigInt(0)
        ) {
          // Empty Kandel being edited - use user input amounts for distribution
          distributionBaseAmount = baseAmount
            ? parseAmount(baseAmount, baseTokenDec)
            : BigInt(0);
          distributionQuoteAmount = quoteAmount
            ? parseAmount(quoteAmount, quoteTokenDec)
            : BigInt(0);
        }

        bidGivesPerLevel = distributionQuoteAmount / BigInt(levels);
        askGivesPerLevel = distributionBaseAmount / BigInt(levels);
      }

      // Safety check: ensure we have amounts for the grid
      if (bidGivesPerLevel === BigInt(0) && askGivesPerLevel === BigInt(0)) {
        throw new Error(
          'Cannot create Kandel with both bid and ask amounts being zero. ' +
            'Either add funds via "Deposit entered amounts into Kandel inventory" or ensure the Kandel has existing inventory.'
        );
      }

      // Validate parameter ranges for Solidity types
      if (Number(gasreqBigInt) > 16777215) {
        throw new Error(
          'Gas requirement is too high. Please use a lower value (maximum: 16,777,215).'
        );
      }
      if (parseInt(step) > 4294967295) {
        throw new Error('Step size is too large. Please use a smaller value.');
      }
      if (pricePoints > 4294967295) {
        throw new Error(
          'Too many price levels requested. Please reduce the number of levels.'
        );
      }

      // All changes use populateFromOffset - works with or without distribution

      // Pass 0 for gasreq if unchanged (tells contract to keep existing value)
      const gasreqForContract =
        isEditing && gasreq === initialValues.current.gasreq
          ? 0
          : Number(gasreqBigInt);

      await kandel.populateFromOffset({
        from: BigInt(0), // start index
        to: BigInt(pricePoints), // end index
        minTick, // baseQuoteTickIndex0
        tickOffsetBetweenLevels, // _baseQuoteTickOffset
        firstAskIndex: BigInt(levels), // firstAskIndex
        bidGivesPerLevel, // bidGives
        askGivesPerLevel, // askGives
        params: {
          gasprice: 0, // Use market gas price (0 = use default)
          gasreq: gasreqForContract, // 0 = keep existing, else update
          stepSize: parseInt(step), // Must be uint32
          pricePoints: pricePoints, // Must be uint32
        },
        baseAmount: baseAmountForContract, // baseAmount to add to inventory
        quoteAmount: quoteAmountForContract, // quoteAmount to add to inventory
        provisionValue: provision.missing,
      });

      if (onSuccess) {
        onSuccess(address);
      }
    } catch (err: unknown) {
      let userMessage = 'Transaction failed. Please try again.';

      if (err instanceof Error) {
        const message = err.message.toLowerCase();

        // Check for common error patterns and provide better messages
        if (
          message.includes('insufficient funds') ||
          message.includes('insufficient balance')
        ) {
          userMessage =
            'Insufficient funds to complete the transaction. Please check your wallet balance.';
        } else if (
          message.includes('user rejected') ||
          message.includes('user denied')
        ) {
          userMessage = 'Transaction was cancelled.';
        } else if (message.includes('gas') && message.includes('too low')) {
          userMessage =
            'Transaction failed due to low gas. Please try again with higher gas settings.';
        } else if (message.includes('provision')) {
          userMessage =
            'The required ETH provision amount was insufficient. Please try with a higher provision.';
        } else if (message.includes('slippage') || message.includes('price')) {
          userMessage =
            'Price changed during transaction. Please retry with updated values.';
        } else {
          userMessage = err.message;
        }
      }

      setError(userMessage);
    } finally {
      setLoading(false);
    }
  };

  // Show loading state while tokens are loading
  if (tokensLoading && hasValidTokens) {
    return (
      <div className='flex items-center justify-center py-8'>
        <div className='text-slate-400'>Loading token information...</div>
      </div>
    );
  }

  // Check if we have complete token info
  if (!baseTokenInfo || !quoteTokenInfo) {
    return (
      <div className='flex items-center justify-center py-8'>
        <div className='text-slate-400'>Loading token details...</div>
      </div>
    );
  }

  // Show loading state while configuration is loading
  if (configLoading && hasValidTokens) {
    return (
      <div className='flex items-center justify-center py-8'>
        <div className='text-slate-400'>Loading configuration...</div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className='space-y-6'>
      <div className='card'>
        <h3 className='text-lg font-semibold text-slate-200 mb-4'>
          Market Parameters
        </h3>

        <div className='grid grid-cols-2 gap-4'>
          <div>
            <label className='label'>
              <TokenDisplay address={base as `0x${string}`} fallback='Token' />{' '}
              Address
            </label>
            <input
              type='text'
              value={base}
              disabled
              className='input opacity-50'
            />
          </div>

          <div>
            <label className='label'>
              <TokenDisplay address={quote as `0x${string}`} fallback='Token' />{' '}
              Address
            </label>
            <input
              type='text'
              value={quote}
              disabled
              className='input opacity-50'
            />
          </div>

          <div>
            <label className='label'>
              Min Price ({baseTokenInfo?.symbol || 'BASE'}/
              {quoteTokenInfo?.symbol || 'QUOTE'})
            </label>
            <input
              type='text'
              value={minPrice}
              onChange={(e) =>
                handlePriceChange(
                  e.target.value,
                  setMinPrice,
                  setMinPriceTouched
                )
              }
              placeholder='e.g. 1000'
              required
              className='input'
            />
          </div>

          <div>
            <label className='label'>
              Max Price ({baseTokenInfo?.symbol || 'BASE'}/
              {quoteTokenInfo?.symbol || 'QUOTE'})
            </label>
            <input
              type='text'
              value={maxPrice}
              onChange={(e) =>
                handlePriceChange(
                  e.target.value,
                  setMaxPrice,
                  setMaxPriceTouched
                )
              }
              placeholder='e.g. 2000'
              required
              className='input'
            />
          </div>
        </div>

        {priceRangeError && (
          <p className='text-red-400 text-sm mt-2'>{priceRangeError}</p>
        )}
      </div>

      <div className='card'>
        <h3 className='text-lg font-semibold text-slate-200 mb-4'>
          Advanced Parameters
        </h3>

        <div className='grid grid-cols-2 gap-4'>
          <div>
            <label className='label'>Step</label>
            <input
              type='number'
              value={step}
              onChange={(e) => setStep(e.target.value)}
              min='1'
              max='100'
              step='1'
              required
              className='input'
            />
            {stepSizeError && (
              <p className='text-red-400 text-sm mt-1'>{stepSizeError}</p>
            )}
          </div>

          <div>
            <label className='label'>Levels Per Side</label>
            <input
              type='number'
              value={levelsPerSide}
              onChange={(e) => setLevelsPerSide(e.target.value)}
              min='1'
              max='50'
              required
              className='input'
            />
            {levelsPerSideError && (
              <p className='text-red-400 text-sm mt-1'>{levelsPerSideError}</p>
            )}
          </div>
        </div>
      </div>

      <div className='card'>
        <h3 className='text-lg font-semibold text-slate-200 mb-4'>
          Initial Inventory
        </h3>

        {isEditing && (
          <div className='flex items-center gap-2 mb-4'>
            <input
              id='addInv'
              type='checkbox'
              checked={addInventory || forceAddInventory}
              onChange={() => setAddInventory(!addInventory)}
              disabled={forceAddInventory}
              className={`w-4 h-4 text-blue-600 bg-slate-700 border-slate-600 rounded focus:ring-blue-500 focus:ring-2 ${
                forceAddInventory ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            />
            <label htmlFor='addInv' className='text-sm text-slate-300'>
              Deposit entered amounts into Kandel inventory
              {forceAddInventory && (
                <span className='block text-xs text-yellow-400 mt-1'>
                  (Required - no existing reserves found)
                </span>
              )}
            </label>
          </div>
        )}

        <div className='grid grid-cols-2 gap-4'>
          <div>
            <label className='label'>
              <TokenDisplay address={base as `0x${string}`} fallback='Token' />{' '}
              Amount
            </label>
            <input
              type='number'
              value={baseAmount}
              onChange={(e) => setBaseAmount(e.target.value)}
              placeholder='e.g. 100'
              step='0.000000001'
              min='0'
              required={!isEditing || addInventory || forceAddInventory}
              disabled={isEditing && !addInventory && !forceAddInventory}
              className={`input ${
                isEditing && !addInventory && !forceAddInventory
                  ? 'opacity-50'
                  : ''
              }`}
            />
            {kandelReserves && baseTokenInfo && (
              <div className='text-xs text-slate-400 mt-1'>
                Kandel Balance:{' '}
                {formatTokenAmount(
                  kandelReserves.baseQty,
                  baseTokenInfo.decimals
                )}{' '}
                {baseTokenInfo.symbol}
              </div>
            )}
          </div>

          <div>
            <label className='label'>
              <TokenDisplay address={quote as `0x${string}`} fallback='Token' />{' '}
              Amount
            </label>
            <input
              type='number'
              value={quoteAmount}
              onChange={(e) => setQuoteAmount(e.target.value)}
              placeholder='e.g. 150000'
              step='0.000000001'
              min='0'
              required={!isEditing || addInventory || forceAddInventory}
              disabled={isEditing && !addInventory && !forceAddInventory}
              className={`input ${
                isEditing && !addInventory && !forceAddInventory
                  ? 'opacity-50'
                  : ''
              }`}
            />
            {kandelReserves && quoteTokenInfo && (
              <div className='text-xs text-slate-400 mt-1'>
                Kandel Balance:{' '}
                {formatTokenAmount(
                  kandelReserves.quoteQty,
                  quoteTokenInfo.decimals
                )}{' '}
                {quoteTokenInfo.symbol}
              </div>
            )}
          </div>
        </div>
        {minVolumeError && (
          <p className='text-red-400 text-sm mt-2'>{minVolumeError}</p>
        )}
      </div>

      <div className='card'>
        <h3 className='text-lg font-semibold text-slate-200 mb-4'>
          Advanced Settings
        </h3>

        <div className='space-y-4'>
          <div>
            <label className='label'>Gas Requirement</label>
            <input
              type='number'
              value={gasreq}
              onChange={(e) => setGasreq(e.target.value)}
              required
              className='input'
            />
          </div>
        </div>
      </div>

      <div className='card'>
        <h3 className='text-lg font-semibold text-slate-200 mb-4'>
          Provision Summary
        </h3>
        <div className='space-y-2 text-sm'>
          <div className='flex justify-between font-semibold'>
            <span className='text-slate-400'>Total Provision Needed:</span>
            <span className='text-slate-200'>
              {configLoading
                ? 'Calculating...'
                : `${formatEthAmount(provision.missing)} ETH`}
            </span>
          </div>
        </div>
      </div>

      {error && (
        <div className='bg-red-500/20 border border-red-500/50 rounded-lg p-4'>
          <p className='text-red-400'>{error}</p>
        </div>
      )}

      {/* Check if any field has changes in edit mode */}
      {(() => {
        const hasAnyChanges = dirty && Object.values(dirty).some(Boolean);

        return (
          <button
            type='submit'
            disabled={
              loading ||
              parseInt(levelsPerSide) === 0 ||
              stepSizeError !== null ||
              levelsPerSideError !== null ||
              minVolumeError !== null ||
              priceRangeError !== null ||
              (isEditing && !hasAnyChanges)
            }
            className='btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed'
          >
            {loading
              ? 'Processing...'
              : kandelAddress
              ? 'Update Kandel'
              : 'Create Kandel'}
          </button>
        );
      })()}
    </form>
  );
}
