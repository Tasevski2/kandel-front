'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAccount } from 'wagmi';
import { useKandelSeeder } from '@/hooks/kandel/mutations/useKandelSeeder';
import { useRetractAll } from '@/hooks/kandel/mutations/useRetractAll';
import { usePopulateFromOffset } from '@/hooks/kandel/mutations/usePopulateFromOffset';
import { useProvision } from '@/hooks/mangrove/queries/useProvision';
import { useGetLocalConfigs } from '@/hooks/mangrove/queries/useGetLocalConfigs';
import { useGetReserveBalances } from '@/hooks/kandel/queries/useGetReserveBalances';
import { useTokensInfo } from '@/hooks/token/useTokenInfo';
import type { KandelInfo } from '@/hooks/kandel/queries/useGetKandelInfo';
import {
  DEFAULT_STEP,
  DEFAULT_LEVELS_PER_SIDE,
  DEFAULT_MAX_PRICE,
  DEFAULT_MIN_PRICE,
  DEFAULT_GAS_REQ_WEI,
} from '@/lib/constants';
import {
  createGeometricDistribution,
  type MarketParams,
} from '@mangrovedao/mgv';
import { maxPriceToTick, minPriceToTick, parseAmount } from '@/lib/pricing';
import { formatEthAmount, formatTokenAmount } from '@/lib/formatting';
import { minGivesUnits, missingProvisionWei } from '@/lib/provision';
import type { Market } from '@/hooks/mangrove/queries/useGetMarkets';
import {
  validateStepSize,
  validateLevelsPerSide,
  validatePriceRange,
  validateGasreq,
} from '@/lib/validation';
import { Address } from 'viem';
import { useErc20Approve } from '@/hooks/token/useErc20Approve';
import { useGetMakerFreeBalance } from '@/hooks/mangrove/queries/useGetMakerFreeBalance';
import {
  VALIDATION_ERRORS,
  TRANSACTION_ERRORS,
  ERROR_PATTERNS,
} from './errorMessages';

type KandelFormProps = {
  onSuccess?: (address: Address) => void;
} & (
  | {
      // Edit mode
      isEditing: true;
      kandelInfo: KandelInfo;
    }
  | {
      // Create mode
      isEditing?: false;
      market: Market;
    }
);

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

export function useKandelForm(props: KandelFormProps) {
  const { onSuccess } = props;
  const isEditing = 'isEditing' in props && props.isEditing === true;
  const kandelInfo = isEditing ? props.kandelInfo : undefined;
  const market = !isEditing ? props.market : undefined;
  const kandelAddress = isEditing ? props.kandelInfo.address : undefined;

  const { address: userAddress } = useAccount();

  const base = useMemo<Address | undefined>(() => {
    if (isEditing && kandelInfo) {
      return kandelInfo.base.address;
    }
    return market?.baseToken;
  }, [isEditing, kandelInfo, market]);

  const quote = useMemo<Address | undefined>(() => {
    if (isEditing && kandelInfo) {
      return kandelInfo.quote.address;
    }
    return market?.quoteToken;
  }, [isEditing, kandelInfo, market]);

  const tickSpacing = useMemo<bigint>(() => {
    if (isEditing && kandelInfo) {
      return kandelInfo.tickSpacing;
    }
    return market?.tickSpacing || BigInt(1);
  }, [isEditing, kandelInfo, market]);

  const hasValidTokens = base !== undefined && quote !== undefined;
  const tokenAddresses = useMemo(
    () => (hasValidTokens ? [base!, quote!] : []),
    [base, quote, hasValidTokens]
  );
  // in edit mode it won't do additional http request, will get the data from cache
  const { tokensInfo, isLoading: tokensLoading } =
    useTokensInfo(tokenAddresses);

  // Use kandelInfo tokens when available, otherwise fetch
  const baseTokenInfo =
    isEditing && kandelInfo
      ? kandelInfo.base
      : tokensInfo && base
      ? tokensInfo[base]
      : undefined;
  const quoteTokenInfo =
    isEditing && kandelInfo
      ? kandelInfo.quote
      : tokensInfo && quote
      ? tokensInfo[quote]
      : undefined;

  // Initialize form fields - use kandelInfo when editing
  const [minPrice, setMinPrice] = useState(() => {
    if (isEditing && kandelInfo?.minPrice) {
      return kandelInfo.minPrice.toString();
    }
    return DEFAULT_MIN_PRICE.toString();
  });

  const [maxPrice, setMaxPrice] = useState(() => {
    if (isEditing && kandelInfo?.maxPrice) {
      return kandelInfo.maxPrice.toString();
    }
    return DEFAULT_MAX_PRICE.toString();
  });

  const [step, setStep] = useState(() => {
    if (isEditing && kandelInfo) {
      return kandelInfo.stepSize.toString();
    }
    return DEFAULT_STEP.toString();
  });

  const [levelsPerSide, setLevelsPerSide] = useState(() => {
    if (isEditing && kandelInfo) {
      return kandelInfo.levelsPerSide.toString();
    }
    return DEFAULT_LEVELS_PER_SIDE.toString();
  });

  const [gasreq, setGasreq] = useState(() => {
    if (isEditing && kandelInfo) {
      return kandelInfo.gasreq.toString();
    }
    return DEFAULT_GAS_REQ_WEI.toString();
  });

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
  const [gasreqError, setGasreqError] = useState<string | null>(null);

  // Track whether user has edited price fields
  const [minPriceTouched, setMinPriceTouched] = useState(false);
  const [maxPriceTouched, setMaxPriceTouched] = useState(false);

  // Edit mode state
  const [addInventory, setAddInventory] = useState(!isEditing);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Fetch Kandel reserve balances using the new hook
  const { baseBalance: kandelBaseReserve, quoteBalance: kandelQuoteReserve } =
    useGetReserveBalances(kandelAddress);

  const kandelReserves = useMemo(() => {
    if (
      kandelAddress &&
      (kandelBaseReserve !== undefined || kandelQuoteReserve !== undefined)
    ) {
      return {
        baseQty: kandelBaseReserve || BigInt(0),
        quoteQty: kandelQuoteReserve || BigInt(0),
      };
    }
    return null;
  }, [kandelAddress, kandelBaseReserve, kandelQuoteReserve]);

  const hasReserves =
    kandelReserves &&
    (kandelReserves.baseQty > BigInt(0) || kandelReserves.quoteQty > BigInt(0));
  const forceAddInventory = isEditing && !hasReserves;

  // Initial values reference for dirty field detection
  const initialValues = useRef({
    minPrice:
      isEditing && kandelInfo?.minPrice ? kandelInfo.minPrice.toString() : '',
    maxPrice:
      isEditing && kandelInfo?.maxPrice ? kandelInfo.maxPrice.toString() : '',
    levelsPerSide:
      isEditing && kandelInfo ? kandelInfo.levelsPerSide.toString() : '',
    step: isEditing && kandelInfo ? kandelInfo.stepSize.toString() : '',
    gasreq: isEditing && kandelInfo ? kandelInfo.gasreq.toString() : '',
    minTick: isEditing && kandelInfo?.minTick ? kandelInfo.minTick : null,
    maxTick: isEditing && kandelInfo?.maxTick ? kandelInfo.maxTick : null,
    baseQuoteTickOffset:
      isEditing && kandelInfo?.baseQuoteTickOffset
        ? kandelInfo.baseQuoteTickOffset
        : null,
    baseQuoteTickIndex0:
      isEditing && kandelInfo?.baseQuoteTickIndex0
        ? kandelInfo.baseQuoteTickIndex0
        : null,
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

  const { create } = useKandelSeeder();
  const { retractAll } = useRetractAll();
  const { populateFromOffset } = usePopulateFromOffset();
  const { erc20Approve } = useErc20Approve();

  // Get user's free balance for missing provision calculation
  const { balanceWei: userFreeBalance } = useGetMakerFreeBalance(userAddress);

  // Get local configs using the new hook
  const {
    ask,
    bid,
    isLoading: configLoading,
  } = useGetLocalConfigs({
    base: baseTokenInfo?.address,
    quote: quoteTokenInfo?.address,
    tickSpacing,
  });

  // Get provision using the new hook - only when gasreq is valid
  const gasreqNumber = useMemo(() => {
    if (gasreqError || !gasreq.trim()) return undefined;
    const parsed = parseInt(gasreq);
    return isNaN(parsed) ? undefined : parsed;
  }, [gasreq, gasreqError]);

  const { provision: provisionData, isLoading: provisionLoading } =
    useProvision({
      base: baseTokenInfo?.address,
      quote: quoteTokenInfo?.address,
      tickSpacing,
      gasreq: gasreqNumber,
    });

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

  // Real-time levels per side validation - runs first to establish valid base
  useEffect(() => {
    // Clear previous error
    setLevelsPerSideError(null);

    // Skip if value is empty
    if (!levelsPerSide.trim()) return;

    const levelsInt = parseInt(levelsPerSide);

    // Check if it's a valid number
    if (isNaN(levelsInt)) {
      setLevelsPerSideError(VALIDATION_ERRORS.LEVELS_MUST_BE_NUMBER);
      return;
    }

    // Validate using the validation function
    const validation = validateLevelsPerSide(levelsInt);
    if (validation) {
      setLevelsPerSideError(validation);
    }
  }, [levelsPerSide]);

  // Real-time stepSize validation - only runs when levels per side is valid
  useEffect(() => {
    // Clear previous error
    setStepSizeError(null);

    // Skip if values are empty
    if (!step.trim() || !levelsPerSide.trim()) return;

    const stepSizeInt = parseInt(step);
    const levelsInt = parseInt(levelsPerSide);

    // Only validate stepSize if levels per side is valid first
    if (isNaN(levelsInt) || levelsInt <= 0) {
      // If levels is invalid, clear stepSize error and let levels validation show first
      return;
    }

    const pricePoints = levelsInt * 2;

    // Validate stepSize immediately
    const stepSizeValidation = validateStepSize(stepSizeInt, pricePoints);
    if (stepSizeValidation) {
      setStepSizeError(stepSizeValidation);
    }
  }, [step, levelsPerSide]);

  // Real-time gasreq validation
  useEffect(() => {
    const validationError = validateGasreq(gasreq);
    setGasreqError(validationError);
  }, [gasreq]);

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
      setPriceRangeError(VALIDATION_ERRORS.MIN_PRICE_INVALID);
      return;
    }
    if (!isFinite(maxP)) {
      setPriceRangeError(VALIDATION_ERRORS.MAX_PRICE_INVALID);
      return;
    }

    // Check if min price is positive
    if (minP <= 0) {
      setPriceRangeError(VALIDATION_ERRORS.MIN_PRICE_POSITIVE);
      return;
    }

    // Check if max price is greater than min price
    if (maxP <= minP) {
      setPriceRangeError(VALIDATION_ERRORS.MAX_PRICE_GREATER);
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
    if (configLoading || !ask.density || !bid.density) return;

    // Skip if gasreq has validation errors
    if (gasreqError) return;

    if (!baseTokenInfo || !quoteTokenInfo) return;

    try {
      // Parse amounts and calculate per-level amounts
      const baseAmountWei = parseAmount(baseAmount, baseTokenInfo.decimals);
      const quoteAmountWei = parseAmount(quoteAmount, quoteTokenInfo.decimals);
      const levelsInt = parseInt(levelsPerSide);
      const gasreqBigInt = BigInt(gasreq);

      // Calculate minimum required gives for each direction
      const minRequiredGivesAsk = minGivesUnits(
        ask.density,
        ask.offerGasbase,
        gasreqBigInt
      ); // base->quote (asks)
      const minRequiredGivesBid = minGivesUnits(
        bid.density,
        bid.offerGasbase,
        gasreqBigInt
      ); // quote->base (bids)

      // Calculate per-level amounts
      const perLevelBase = baseAmountWei / BigInt(levelsInt);
      const perLevelQuote = quoteAmountWei / BigInt(levelsInt);

      // Validate base amount per level (for asks: base->quote)
      if (perLevelBase < minRequiredGivesAsk) {
        setMinVolumeError(
          VALIDATION_ERRORS.BASE_BELOW_MINIMUM(
            formatTokenAmount(perLevelBase, baseTokenInfo.decimals),
            baseTokenInfo.symbol,
            formatTokenAmount(minRequiredGivesAsk, baseTokenInfo.decimals)
          )
        );
        return;
      }

      // Validate quote amount per level (for bids: quote->base)
      if (perLevelQuote < minRequiredGivesBid) {
        setMinVolumeError(
          VALIDATION_ERRORS.QUOTE_BELOW_MINIMUM(
            formatTokenAmount(perLevelQuote, quoteTokenInfo.decimals),
            quoteTokenInfo.symbol,
            formatTokenAmount(minRequiredGivesBid, quoteTokenInfo.decimals)
          )
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
    baseTokenInfo,
    quoteTokenInfo,
    ask,
    bid,
    gasreq,
    configLoading,
  ]);

  // Calculate provision with new hook data
  const [provision, setProvision] = useState({
    perOffer: BigInt(0),
    total: BigInt(0),
    missing: BigInt(0),
  });

  // Calculate provision per side (asks and bids) - debounced to avoid excessive calls
  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      // Skip if gasreq has validation errors
      if (gasreqError) {
        setProvision({
          perOffer: BigInt(0),
          total: BigInt(0),
          missing: missingProvisionWei(
            BigInt(0),
            BigInt(0),
            userFreeBalance || BigInt(0)
          ),
        });
        return;
      }

      const levels = BigInt(parseInt(levelsPerSide) || 0);

      if (configLoading || !provisionData || levels === BigInt(0)) {
        setProvision({
          perOffer: BigInt(0),
          total: BigInt(0),
          missing: missingProvisionWei(
            BigInt(0),
            BigInt(0),
            userFreeBalance || BigInt(0)
          ),
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
          missing: missingProvisionWei(
            BigInt(0),
            BigInt(0),
            userFreeBalance || BigInt(0)
          ),
        });
        return;
      }

      try {
        if (!baseTokenInfo || !quoteTokenInfo || !base || !quote) {
          // Set to 0 when token info not available or addresses missing
          setProvision({
            perOffer: BigInt(0),
            total: BigInt(0),
            missing: missingProvisionWei(
              BigInt(0),
              BigInt(0),
              userFreeBalance || BigInt(0)
            ),
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
            missing: missingProvisionWei(
              BigInt(0),
              BigInt(0),
              userFreeBalance || BigInt(0)
            ),
          });
          return;
        }

        // Parse form values and create distribution parameters
        const minP = parseFloat(minPrice);
        const maxP = parseFloat(maxPrice);
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
            missing: missingProvisionWei(
              BigInt(0),
              BigInt(0),
              userFreeBalance || BigInt(0)
            ),
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

        // Use provision data from hook
        const perAsk = provisionData.perAsk || BigInt(0);
        const perBid = provisionData.perBid || BigInt(0);

        // Use ACTUAL counts for provision calculation
        const askCnt = BigInt(askCount);
        const bidCnt = BigInt(bidCount);
        const actualTotalNeeded = perAsk * askCnt + perBid * bidCnt;

        setProvision({
          perOffer: perAsk > perBid ? perAsk : perBid,
          total: actualTotalNeeded,
          missing: missingProvisionWei(
            actualTotalNeeded,
            BigInt(0),
            userFreeBalance || BigInt(0)
          ),
        });
      } catch (error) {
        // Set to 0 on any error - no fallback estimates
        setProvision({
          perOffer: BigInt(0),
          total: BigInt(0),
          missing: missingProvisionWei(
            BigInt(0),
            BigInt(0),
            userFreeBalance || BigInt(0)
          ),
        });
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [
    gasreq,
    gasreqError,
    levelsPerSide,
    configLoading,
    provisionData,
    base,
    quote,
    tickSpacing,
    minPrice,
    maxPrice,
    step,
    baseAmount,
    quoteAmount,
    baseTokenInfo,
    quoteTokenInfo,
    kandelReserves,
    isEditing,
    addInventory,
    userFreeBalance,
  ]);

  // Computed values
  const canUseUserAmounts = useMemo(() => {
    const amountRequired = !isEditing || addInventory || forceAddInventory;
    return amountRequired && baseAmount.trim() && quoteAmount.trim();
  }, [isEditing, addInventory, forceAddInventory, baseAmount, quoteAmount]);

  // Form validation function
  const validateForm = (): string | null => {
    // Final loading state checks - ensure everything is still loaded
    if (tokensLoading || !baseTokenInfo || !quoteTokenInfo) {
      return VALIDATION_ERRORS.LOADING_TOKENS;
    }
    // Check if any real-time validation errors exist
    if (priceRangeError) {
      return priceRangeError;
    }
    if (minVolumeError) {
      return minVolumeError;
    }
    if (stepSizeError) {
      return stepSizeError;
    }
    if (levelsPerSideError) {
      return levelsPerSideError;
    }
    if (gasreqError) {
      return gasreqError;
    }

    // Check if required fields are empty (basic completeness)
    if (!minPrice.trim() || !maxPrice.trim() || !levelsPerSide.trim()) {
      return VALIDATION_ERRORS.REQUIRED_FIELDS;
    }

    // Amount validation - only required when not in edit mode OR when addInventory is checked OR when no reserves exist
    const amountRequired = !isEditing || addInventory || forceAddInventory;
    if (amountRequired && (!baseAmount.trim() || !quoteAmount.trim())) {
      return VALIDATION_ERRORS.REQUIRED_AMOUNTS(
        baseTokenInfo.symbol,
        quoteTokenInfo.symbol
      );
    }

    return null;
  };

  // Complete handleSubmit implementation
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      let address = kandelAddress;

      // Ensure we have proper token info and addresses before proceeding
      if (!baseTokenInfo || !quoteTokenInfo || !base || !quote) {
        throw new Error(VALIDATION_ERRORS.TOKEN_DATA_LOADING);
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
        const pricePoints = parseInt(levelsPerSide) * 2;
        await retractAll({ kandelAddr: address!, pricePoints, deprovision: false });
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
        await erc20Approve(base, address!, baseAmountWei);
        await erc20Approve(quote, address!, quoteAmountWei);
      } else if (addInventory) {
        // Edit mode with addInventory=true: Add user amounts to existing inventory
        const userBaseWei = parseAmount(baseAmount, baseTokenDec);
        const userQuoteWei = parseAmount(quoteAmount, quoteTokenDec);
        baseAmountWei = (kandelReserves?.baseQty || BigInt(0)) + userBaseWei;
        quoteAmountWei = (kandelReserves?.quoteQty || BigInt(0)) + userQuoteWei;

        // Approve tokens only for the user's additional amounts (not the total)
        await erc20Approve(base, address!, userBaseWei);
        await erc20Approve(quote, address!, userQuoteWei);
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
          await erc20Approve(base, address!, userBaseWei);
        }

        if (
          isEditing &&
          quoteAmount &&
          parseAmount(quoteAmount, quoteTokenDec) > BigInt(0)
        ) {
          const userQuoteWei = parseAmount(quoteAmount, quoteTokenDec);
          await erc20Approve(quote, address!, userQuoteWei);
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
          throw new Error(VALIDATION_ERRORS.LEVELS_POSITIVE);
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
          let errorMsg = VALIDATION_ERRORS.INSUFFICIENT_RESERVES(levels);
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
          errorMsg += VALIDATION_ERRORS.ENABLE_DEPOSIT_SUGGESTION;
          throw new Error(errorMsg);
        }
      } else {
        // Safety check: ensure levels is not zero before division
        if (levels <= 0) {
          throw new Error(VALIDATION_ERRORS.LEVELS_POSITIVE);
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
        throw new Error(VALIDATION_ERRORS.ZERO_AMOUNTS);
      }

      // Solidity type validations are now handled by the validation functions

      // All changes use populateFromOffset - works with or without distribution

      // Pass 0 for gasreq if unchanged (tells contract to keep existing value)
      const gasreqForContract =
        isEditing && gasreq === initialValues.current.gasreq
          ? 0
          : Number(gasreqBigInt);

      await populateFromOffset({
        kandelAddr: address!,
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
        onSuccess(address!);
      }
    } catch (err: unknown) {
      let userMessage = TRANSACTION_ERRORS.DEFAULT;

      if (err instanceof Error) {
        const message = err.message.toLowerCase();

        // Check for common error patterns and provide better messages
        if (
          ERROR_PATTERNS.INSUFFICIENT.some((pattern) =>
            message.includes(pattern)
          )
        ) {
          userMessage = TRANSACTION_ERRORS.INSUFFICIENT_FUNDS;
        } else if (
          ERROR_PATTERNS.USER_REJECTION.some((pattern) =>
            message.includes(pattern)
          )
        ) {
          userMessage = TRANSACTION_ERRORS.CANCELLED;
        } else if (
          ERROR_PATTERNS.GAS_ISSUES.some((pattern) => message.includes(pattern))
        ) {
          userMessage = TRANSACTION_ERRORS.LOW_GAS;
        } else if (
          ERROR_PATTERNS.PROVISION.some((pattern) => message.includes(pattern))
        ) {
          userMessage = TRANSACTION_ERRORS.PROVISION_INSUFFICIENT;
        } else {
          userMessage = err.message;
        }
      }

      setError(userMessage);
    } finally {
      setLoading(false);
    }
  };

  // Memoize form state - only recreate when form values change
  const formState = useMemo(
    () => ({
      minPrice,
      maxPrice,
      levelsPerSide,
      step,
      gasreq,
      baseAmount,
      quoteAmount,
      addInventory,
      showAdvanced,
      loading,
    }),
    [
      minPrice,
      maxPrice,
      levelsPerSide,
      step,
      gasreq,
      baseAmount,
      quoteAmount,
      addInventory,
      showAdvanced,
      loading,
    ]
  );

  // Memoize actions - most setters are stable, but it is more readable this way
  const actions = useMemo(
    () => ({
      setMinPrice,
      setMaxPrice,
      setLevelsPerSide,
      setStep,
      setGasreq,
      setBaseAmount,
      setQuoteAmount,
      setAddInventory,
      setShowAdvanced,
      setMinPriceTouched,
      setMaxPriceTouched,
      handlePriceChange,
      handleSubmit,
    }),
    [handlePriceChange, handleSubmit]
  );

  // Memoize computed values - only recreate when computed values actually change
  const computed = useMemo(
    () => ({
      hasValidTokens,
      baseTokenInfo,
      quoteTokenInfo,
      base,
      quote,
      tickSpacing,
      isEditing,
      kandelAddress,
      kandelReserves,
      hasReserves,
      forceAddInventory,
      canUseUserAmounts,
      provision,
      dirty,
    }),
    [
      hasValidTokens,
      baseTokenInfo,
      quoteTokenInfo,
      base,
      quote,
      tickSpacing,
      isEditing,
      kandelAddress,
      kandelReserves,
      hasReserves,
      forceAddInventory,
      canUseUserAmounts,
      provision,
      dirty,
    ]
  );

  // Memoize status - only recreate when status values change
  const status = useMemo(
    () => ({
      loading,
      tokensLoading,
      configLoading,
      provisionLoading,
      error,
      priceRangeError,
      minVolumeError,
      levelsPerSideError,
      stepSizeError,
      gasreqError,
    }),
    [
      loading,
      tokensLoading,
      configLoading,
      provisionLoading,
      error,
      priceRangeError,
      minVolumeError,
      levelsPerSideError,
      stepSizeError,
      gasreqError,
    ]
  );

  return {
    formState,
    actions,
    computed,
    status,
  };
}
