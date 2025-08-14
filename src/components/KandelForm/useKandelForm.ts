'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useAccount } from 'wagmi';
import { useKandelSeeder } from '@/hooks/kandel/mutations/useKandelSeeder';
import { useRetractAll } from '@/hooks/kandel/mutations/useRetractAll';
import { usePopulateFromOffset } from '@/hooks/kandel/mutations/usePopulateFromOffset';
import { useProvision } from '@/hooks/mangrove/queries/useProvision';
import { useGetLocalConfigs } from '@/hooks/mangrove/queries/useGetLocalConfigs';
import { useGetReserveBalances } from '@/hooks/kandel/queries/useGetReserveBalances';
import { useGetOrderBook } from '@/hooks/mangrove/queries/useGetOrderBook';
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
import { formatTokenAmount } from '@/lib/formatting';
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
      isEditing: true;
      kandelInfo: KandelInfo;
    }
  | {
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

/**
 * Complex form hook for managing Kandel position creation and editing.
 * Handles real-time validation, price calculations, provision estimates,
 * and transaction orchestration for both create and edit modes.
 */
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
    return market?.baseTokenInfo?.address;
  }, [isEditing, kandelInfo, market]);

  const quote = useMemo<Address | undefined>(() => {
    if (isEditing && kandelInfo) {
      return kandelInfo.quote.address;
    }
    return market?.quoteTokenInfo?.address;
  }, [isEditing, kandelInfo, market]);

  const tickSpacing = useMemo<bigint>(() => {
    if (isEditing && kandelInfo) {
      return kandelInfo.tickSpacing;
    }
    return market?.tickSpacing || BigInt(1);
  }, [isEditing, kandelInfo, market]);

  const baseTokenInfo = useMemo(() => {
    if (isEditing && kandelInfo) {
      return kandelInfo.base;
    }
    if (!isEditing && market) {
      return market.baseTokenInfo;
    }
    return undefined;
  }, [isEditing, kandelInfo, market]);

  const quoteTokenInfo = useMemo(() => {
    if (isEditing && kandelInfo) {
      return kandelInfo.quote;
    }
    if (!isEditing && market) {
      return market.quoteTokenInfo;
    }
    return undefined;
  }, [isEditing, kandelInfo, market]);

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

  const [minVolumeError, setMinVolumeError] = useState<string | null>(null);
  const [stepSizeError, setStepSizeError] = useState<string | null>(null);
  const [priceRangeError, setPriceRangeError] = useState<string | null>(null);
  const [levelsPerSideError, setLevelsPerSideError] = useState<string | null>(
    null
  );
  const [gasreqError, setGasreqError] = useState<string | null>(null);

  const [minPriceTouched, setMinPriceTouched] = useState(false);
  const [maxPriceTouched, setMaxPriceTouched] = useState(false);

  const [addInventory, setAddInventory] = useState(!isEditing);
  const [showAdvanced, setShowAdvanced] = useState(false);

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

  const { balanceWei: userFreeBalance } = useGetMakerFreeBalance(userAddress);

  const {
    ask,
    bid,
    isLoading: configLoading,
  } = useGetLocalConfigs({
    base: baseTokenInfo?.address,
    quote: quoteTokenInfo?.address,
    tickSpacing,
  });

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

  const { asks, bids } = useGetOrderBook({
    base: baseTokenInfo?.address,
    quote: quoteTokenInfo?.address,
    baseDec: baseTokenInfo?.decimals,
    quoteDec: quoteTokenInfo?.decimals,
    tickSpacing,
    maker: kandelAddress,
  });

  /**
   * Validates and sanitizes price input to allow only numeric values with single decimal point.
   * Prevents multiple decimal points and tracks field modification state for edit mode.
   */
  const handlePriceChange = (
    value: string,
    setter: (val: string) => void,
    touchSetter?: (val: boolean) => void
  ) => {
    const numericValue = value.replace(/[^0-9.]/g, '');

    const parts = numericValue.split('.');
    if (parts.length > 2) {
      return;
    }

    setter(numericValue);

    if (touchSetter && isEditing) {
      touchSetter(true);
    }
  };

  useEffect(() => {
    setLevelsPerSideError(null);

    if (!levelsPerSide.trim()) return;

    const levelsInt = parseInt(levelsPerSide);

    if (isNaN(levelsInt)) {
      setLevelsPerSideError(VALIDATION_ERRORS.LEVELS_MUST_BE_NUMBER);
      return;
    }

    const validation = validateLevelsPerSide(levelsInt);
    if (validation) {
      setLevelsPerSideError(validation);
    }
  }, [levelsPerSide]);

  useEffect(() => {
    setStepSizeError(null);

    if (!step.trim() || !levelsPerSide.trim()) return;

    const stepSizeInt = parseInt(step);
    const levelsInt = parseInt(levelsPerSide);

    if (isNaN(levelsInt) || levelsInt <= 0) {
      return;
    }

    const pricePoints = levelsInt * 2;

    const stepSizeValidation = validateStepSize(stepSizeInt, pricePoints);
    if (stepSizeValidation) {
      setStepSizeError(stepSizeValidation);
    }
  }, [step, levelsPerSide]);

  useEffect(() => {
    const validationError = validateGasreq(gasreq);
    setGasreqError(validationError);
  }, [gasreq]);

  useEffect(() => {
    setPriceRangeError(null);

    if (!minPrice.trim() || !maxPrice.trim()) return;

    const minP = parseFloat(minPrice);
    const maxP = parseFloat(maxPrice);

    if (!isFinite(minP)) {
      setPriceRangeError(VALIDATION_ERRORS.MIN_PRICE_INVALID);
      return;
    }
    if (!isFinite(maxP)) {
      setPriceRangeError(VALIDATION_ERRORS.MAX_PRICE_INVALID);
      return;
    }

    if (minP <= 0) {
      setPriceRangeError(VALIDATION_ERRORS.MIN_PRICE_POSITIVE);
      return;
    }

    if (maxP <= minP) {
      setPriceRangeError(VALIDATION_ERRORS.MAX_PRICE_GREATER);
      return;
    }
  }, [minPrice, maxPrice]);

  useEffect(() => {
    setMinVolumeError(null);

    if (!baseAmount.trim() || !quoteAmount.trim() || !levelsPerSide.trim())
      return;
    if (configLoading || !ask.density || !bid.density) return;

    if (gasreqError) return;

    if (!baseTokenInfo || !quoteTokenInfo) return;

    try {
      const baseAmountWei = parseAmount(baseAmount, baseTokenInfo.decimals);
      const quoteAmountWei = parseAmount(quoteAmount, quoteTokenInfo.decimals);
      const levelsInt = parseInt(levelsPerSide);
      const gasreqBigInt = BigInt(gasreq);

      const minRequiredGivesAsk = minGivesUnits(
        ask.density,
        ask.offerGasbase,
        gasreqBigInt
      );
      const minRequiredGivesBid = minGivesUnits(
        bid.density,
        bid.offerGasbase,
        gasreqBigInt
      );

      const perLevelBase = baseAmountWei / BigInt(levelsInt);
      const perLevelQuote = quoteAmountWei / BigInt(levelsInt);

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
    } catch (error) {}
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

  const [provision, setProvision] = useState({
    perOffer: BigInt(0),
    total: BigInt(0),
    missing: BigInt(0),
  });

  // Calculate provision per side (asks and bids) - debounced to avoid excessive calls
  useEffect(() => {
    const timeoutId = setTimeout(async () => {
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

        const levelsInt = parseInt(levelsPerSide);

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

        const rangeValidationError = validatePriceRange(minTick, maxTick);
        if (rangeValidationError) {
          throw new Error(rangeValidationError);
        }

        const totalTickRange = maxTick - minTick;
        const tickOffsetBetweenLevels = BigInt(
          Math.floor(totalTickRange / (levelsInt * 2 - 1))
        );

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

        let bidGivesForProvision: bigint;
        let askGivesForProvision: bigint;

        if (canUseUserAmounts) {
          bidGivesForProvision = quoteAmountWei / BigInt(levelsInt);
          askGivesForProvision = baseAmountWei / BigInt(levelsInt);
        } else {
          bidGivesForProvision =
            kandelReserves!.quoteQty > BigInt(0)
              ? kandelReserves!.quoteQty / BigInt(levelsInt)
              : BigInt(1);
          askGivesForProvision =
            kandelReserves!.baseQty > BigInt(0)
              ? kandelReserves!.baseQty / BigInt(levelsInt)
              : BigInt(1);
        }

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

        const perAsk = provisionData.perAsk || BigInt(0);
        const perBid = provisionData.perBid || BigInt(0);

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

  const canUseUserAmounts = useMemo(() => {
    const amountRequired = !isEditing || addInventory || forceAddInventory;
    return amountRequired && baseAmount.trim() && quoteAmount.trim();
  }, [isEditing, addInventory, forceAddInventory, baseAmount, quoteAmount]);

  const validateForm = (): string | null => {
    if (!baseTokenInfo || !quoteTokenInfo) {
      return VALIDATION_ERRORS.LOADING_TOKENS;
    }
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

    if (!minPrice.trim() || !maxPrice.trim() || !levelsPerSide.trim()) {
      return VALIDATION_ERRORS.REQUIRED_FIELDS;
    }

    const amountRequired = !isEditing || addInventory || forceAddInventory;
    if (amountRequired && (!baseAmount.trim() || !quoteAmount.trim())) {
      return VALIDATION_ERRORS.REQUIRED_AMOUNTS(
        baseTokenInfo.symbol,
        quoteTokenInfo.symbol
      );
    }

    return null;
  };

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

      if (!baseTokenInfo || !quoteTokenInfo || !base || !quote) {
        throw new Error(VALIDATION_ERRORS.TOKEN_DATA_LOADING);
      }

      if (!address) {
        address = await create({
          base,
          quote,
          tickSpacing,
        });
      } else if (isEditing && kandelInfo) {
        const contractPricePoints = kandelInfo.levelsPerSide * 2;

        const hasLiveOffers =
          (asks && asks.length > 0) || (bids && bids.length > 0);

        if (hasLiveOffers) {
          await retractAll({
            kandelAddr: address!,
            pricePoints: contractPricePoints,
            deprovision: false,
          });
        }
      }

      const baseTokenDec = baseTokenInfo.decimals;
      const quoteTokenDec = quoteTokenInfo.decimals;

      let baseAmountWei = BigInt(0);
      let quoteAmountWei = BigInt(0);

      if (!isEditing) {
        baseAmountWei = parseAmount(baseAmount, baseTokenInfo.decimals);
        quoteAmountWei = parseAmount(quoteAmount, quoteTokenInfo.decimals);

        await erc20Approve(base, address!, baseAmountWei);
        await erc20Approve(quote, address!, quoteAmountWei);
      } else if (addInventory) {
        const userBaseWei = parseAmount(baseAmount, baseTokenDec);
        const userQuoteWei = parseAmount(quoteAmount, quoteTokenDec);
        baseAmountWei = (kandelReserves?.baseQty || BigInt(0)) + userBaseWei;
        quoteAmountWei = (kandelReserves?.quoteQty || BigInt(0)) + userQuoteWei;

        await erc20Approve(base, address!, userBaseWei);
        await erc20Approve(quote, address!, userQuoteWei);
      } else if (
        isEditing &&
        !addInventory &&
        kandelReserves &&
        (kandelReserves.baseQty > BigInt(0) ||
          kandelReserves.quoteQty > BigInt(0))
      ) {
        baseAmountWei = kandelReserves.baseQty;
        quoteAmountWei = kandelReserves.quoteQty;
      } else {
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

      let baseAmountForContract = BigInt(0);
      let quoteAmountForContract = BigInt(0);

      if (!isEditing) {
        baseAmountForContract = baseAmountWei;
        quoteAmountForContract = quoteAmountWei;
      } else if (addInventory) {
        baseAmountForContract = parseAmount(baseAmount, baseTokenDec);
        quoteAmountForContract = parseAmount(quoteAmount, quoteTokenDec);
      } else {
        if (
          kandelReserves &&
          kandelReserves.baseQty === BigInt(0) &&
          kandelReserves.quoteQty === BigInt(0)
        ) {
          baseAmountForContract = baseAmount
            ? parseAmount(baseAmount, baseTokenDec)
            : BigInt(0);
          quoteAmountForContract = quoteAmount
            ? parseAmount(quoteAmount, quoteTokenDec)
            : BigInt(0);
        } else {
          baseAmountForContract = BigInt(0);
          quoteAmountForContract = BigInt(0);
        }
      }

      const minP = parseFloat(minPrice);
      const maxP = parseFloat(maxPrice);
      const levels = parseInt(levelsPerSide);
      const pricePoints = levels * 2;

      const gasreqBigInt = BigInt(gasreq);

      let minTick: bigint;
      let maxTick: bigint;
      let tickOffsetBetweenLevels: bigint;
      let bidGivesPerLevel: bigint;
      let askGivesPerLevel: bigint;

      if (
        isEditing &&
        !minPriceTouched &&
        !maxPriceTouched &&
        initialValues.current.baseQuoteTickOffset !== null &&
        initialValues.current.baseQuoteTickIndex0 !== null
      ) {
        const levelsCount = BigInt(levels);
        const baseOffset = initialValues.current.baseQuoteTickOffset;
        const baseIndex0 = initialValues.current.baseQuoteTickIndex0;

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
        minTick = initialValues.current.minTick;
        maxTick = initialValues.current.maxTick;
        const totalTickRange = maxTick - minTick;
        tickOffsetBetweenLevels = totalTickRange / BigInt(pricePoints - 1);
      } else {
        minTick = BigInt(minPriceToTick(minP));
        maxTick = BigInt(maxPriceToTick(maxP));
        const totalTickRange = maxTick - minTick;
        tickOffsetBetweenLevels = totalTickRange / BigInt(pricePoints - 1);
      }

      if (tickOffsetBetweenLevels === BigInt(0)) {
        tickOffsetBetweenLevels = BigInt(1);
      }

      if (
        isEditing &&
        !addInventory &&
        kandelReserves &&
        (kandelReserves.baseQty > BigInt(0) ||
          kandelReserves.quoteQty > BigInt(0))
      ) {
        if (levels <= 0) {
          throw new Error(VALIDATION_ERRORS.LEVELS_POSITIVE);
        }
        bidGivesPerLevel =
          kandelReserves.quoteQty > BigInt(0)
            ? kandelReserves.quoteQty / BigInt(levels)
            : BigInt(1);
        askGivesPerLevel =
          kandelReserves.baseQty > BigInt(0)
            ? kandelReserves.baseQty / BigInt(levels)
            : BigInt(1);

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
        if (levels <= 0) {
          throw new Error(VALIDATION_ERRORS.LEVELS_POSITIVE);
        }

        let distributionBaseAmount = baseAmountWei;
        let distributionQuoteAmount = quoteAmountWei;

        if (
          isEditing &&
          baseAmountWei === BigInt(0) &&
          quoteAmountWei === BigInt(0)
        ) {
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

      if (bidGivesPerLevel === BigInt(0) && askGivesPerLevel === BigInt(0)) {
        throw new Error(VALIDATION_ERRORS.ZERO_AMOUNTS);
      }

      const gasreqForContract =
        isEditing && gasreq === initialValues.current.gasreq
          ? 0
          : Number(gasreqBigInt);

      await populateFromOffset({
        kandelAddr: address!,
        from: BigInt(0),
        to: BigInt(pricePoints),
        minTick,
        tickOffsetBetweenLevels,
        firstAskIndex: BigInt(levels),
        bidGivesPerLevel,
        askGivesPerLevel,
        params: {
          gasprice: 0,
          gasreq: gasreqForContract,
          stepSize: parseInt(step),
          pricePoints: pricePoints,
        },
        baseAmount: baseAmountForContract,
        quoteAmount: quoteAmountForContract,
        provisionValue: provision.missing,
      });

      if (onSuccess) {
        onSuccess(address!);
      }
    } catch (err: unknown) {
      let userMessage = TRANSACTION_ERRORS.DEFAULT;

      if (err instanceof Error) {
        const message = err.message.toLowerCase();

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

  const computed = useMemo(
    () => ({
      hasValidTokens: !!(baseTokenInfo && quoteTokenInfo),
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

  const status = useMemo(
    () => ({
      loading,
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
