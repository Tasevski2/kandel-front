'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount, useWriteContract, useBalance } from 'wagmi';
import { Connect } from '@/components/ConnectWrapper';
import { OrderBook } from '@/components/OrderBook';
import { ProvisionPanel } from '@/components/ProvisionPanel';
import { InventoryCard } from '@/components/InventoryCard';
import { KandelForm } from '@/components/KandelForm';
import { ChainGuard } from '@/components/ChainGuard';
import { KandelParams, useKandel } from '@/hooks/useKandel';
import { useMangrove } from '@/hooks/useMangrove';
import { useMgvReader } from '@/hooks/useMgvReader';
import { useTokens } from '@/hooks/useTokens';
import { useTokensInfo } from '@/hooks/useTokenInfo';
import { formatAmount, formatEthAmount } from '@/lib/formatting';
import { parseAmount } from '@/lib/pricing';
import { useProvision } from '@/hooks/useProvision';
import { TokenDisplay } from '@/components/TokenDisplay';
import { KandelABI } from '@/abi/kandel';
import { MangroveABI } from '@/abi/mangrove';
import { ADDRESSES } from '@/lib/addresses';
import { validateStepSize } from '@/lib/validation';

interface PageProps {
  params: Promise<{
    address: string;
  }>;
}

export default function KandelDetailPage({ params }: PageProps) {
  const router = useRouter();
  const { address: userAddress } = useAccount();
  const resolvedParams = use(params);
  const kandelAddress = resolvedParams.address as `0x${string}`;

  const kandel = useKandel(kandelAddress);
  const { getLocalConfig, getMakerFreeBalance, fundMaker, getProvision } =
    useMangrove();
  const { getBook } = useMgvReader();
  const { missing } = useProvision();
  const { writeContractAsync } = useWriteContract();
  const { erc20Approve } = useTokens();

  const [loading, setLoading] = useState(true);
  const [showEditForm, setShowEditForm] = useState(false);
  const [kandelParams, setKandelParams] = useState<KandelParams>();

  // Get token information for decimals
  const { tokensInfo } = useTokensInfo(
    kandelParams ? [kandelParams.base, kandelParams.quote] : []
  );
  const [baseTokenInfo, quoteTokenInfo] = tokensInfo || [null, null];

  // Get user balances
  const { data: baseBalance } = useBalance({
    address: userAddress,
    token: kandelParams?.base,
    query: { enabled: !!userAddress && !!kandelParams?.base },
  });

  const { data: quoteBalance } = useBalance({
    address: userAddress,
    token: kandelParams?.quote,
    query: { enabled: !!userAddress && !!kandelParams?.quote },
  });

  const { data: ethBalance } = useBalance({
    address: userAddress,
    query: { enabled: !!userAddress },
  });

  const [marketTickSpacing, setMarketTickSpacing] = useState<bigint>(BigInt(1));
  const [inventory, setInventory] = useState({
    baseQty: BigInt(0),
    quoteQty: BigInt(0),
  });
  const [liveOffers, setLiveOffers] = useState(0);
  const [offerGasbase, setOfferGasbase] = useState(BigInt(0));
  const [freeBalance, setFreeBalance] = useState(BigInt(0));
  const [missingProvision, setMissingProvision] = useState(BigInt(0));
  const [lockedProvision, setLockedProvision] = useState(BigInt(0));
  const [perAskProvision, setPerAskProvision] = useState(BigInt(0));
  const [perBidProvision, setPerBidProvision] = useState(BigInt(0));
  const [totalProvisionNeeded, setTotalProvisionNeeded] = useState(BigInt(0));

  // Inline editing state
  const [editingStepSize, setEditingStepSize] = useState(false);
  const [editingGasreq, setEditingGasreq] = useState(false);
  const [tempStepSize, setTempStepSize] = useState('');
  const [tempGasreq, setTempGasreq] = useState('');
  const [stepSizeError, setStepSizeError] = useState<string | null>(null);
  const [gasreqError, setGasreqError] = useState<string | null>(null);

  // Deposit funds state
  const [baseDepositAmount, setBaseDepositAmount] = useState('');
  const [quoteDepositAmount, setQuoteDepositAmount] = useState('');
  const [ethDepositAmount, setEthDepositAmount] = useState('');
  const [tokenDepositLoading, setTokenDepositLoading] = useState(false);
  const [ethDepositLoading, setEthDepositLoading] = useState(false);

  function validateGasreq(gasreq: number): string | null {
    if (gasreq < 1) return 'Gas requirement must be at least 1';
    if (gasreq > 16777215)
      return 'Gas requirement is too high (maximum: 16,777,215)';
    return null;
  }

  // Deposit validation function
  function validateDepositAmount(
    amountStr: string,
    balanceData: { value: bigint } | null | undefined,
    tokenSymbol: string,
    decimals: number = 18
  ): string | null {
    if (!amountStr || amountStr.trim() === '') return null;

    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      return `${tokenSymbol} amount must be greater than 0`;
    }

    if (!balanceData) {
      return `Unable to verify ${tokenSymbol} balance`;
    }

    // Convert string to BigInt for comparison using correct decimals
    const amountWei = parseAmount(amountStr, decimals);
    if (amountWei > balanceData.value) {
      return `Insufficient ${tokenSymbol} balance`;
    }

    return null; // Valid
  }

  // Inline editing handlers
  const handleStepSizeEdit = () => {
    if (!kandelParams) return;
    setTempStepSize(kandelParams.stepSize.toString());
    setEditingStepSize(true);
    setStepSizeError(null);
  };

  const handleStepSizeSave = async () => {
    if (!kandelParams || !tempStepSize) return;

    const newStepSize = parseInt(tempStepSize);
    const pricePoints = kandelParams.levelsPerSide * 2;
    const error = validateStepSize(newStepSize, pricePoints);

    if (error) {
      setStepSizeError(error);
      return;
    }

    try {
      await writeContractAsync({
        address: kandelAddress,
        abi: KandelABI,
        functionName: 'setStepSize',
        args: [BigInt(newStepSize)],
      });

      setEditingStepSize(false);
      setStepSizeError(null);
      await fetchData(); // Refresh data
    } catch (error) {
      setStepSizeError('Failed to update step size');
    }
  };

  const handleStepSizeCancel = () => {
    setEditingStepSize(false);
    setTempStepSize('');
    setStepSizeError(null);
  };

  const handleGasreqEdit = () => {
    if (!kandelParams) return;
    setTempGasreq(kandelParams.gasreq.toString());
    setEditingGasreq(true);
    setGasreqError(null);
  };

  const handleGasreqSave = async () => {
    if (!kandelParams || !tempGasreq) return;

    const newGasreq = parseInt(tempGasreq);
    const error = validateGasreq(newGasreq);

    if (error) {
      setGasreqError(error);
      return;
    }

    try {
      await writeContractAsync({
        address: kandelAddress,
        abi: KandelABI,
        functionName: 'setGasreq',
        args: [BigInt(newGasreq)],
      });

      setEditingGasreq(false);
      setGasreqError(null);
      await fetchData(); // Refresh data
    } catch (error) {
      setGasreqError('Failed to update gas requirement');
    }
  };

  const handleGasreqCancel = () => {
    setEditingGasreq(false);
    setTempGasreq('');
    setGasreqError(null);
  };

  const fetchData = useCallback(
    async (showLoading?: boolean) => {
      try {
        setLoading(!!showLoading);

        // First fetch params and tickSpacing
        const [params, tickSpacing] = await Promise.all([
          kandel.getParams(),
          kandel.getTickSpacing(),
        ]);
        setMarketTickSpacing(tickSpacing);

        // Then fetch remaining data in parallel
        const [inv, orderBook, fb] = await Promise.all([
          kandel.getInventory(),
          getBook(params.base, params.quote, tickSpacing, [kandelAddress]),
          getMakerFreeBalance(kandelAddress),
        ]);

        // Count only this Kandel's offers
        const kandelAsks = orderBook.asks.filter((o) => o.isMine).length;
        const kandelBids = orderBook.bids.filter((o) => o.isMine).length;
        const offers = kandelAsks + kandelBids;

        setKandelParams(params);
        setInventory(inv);
        setLiveOffers(offers);
        setFreeBalance(fb);

        // Fetch local config
        const config = await getLocalConfig(
          params.base,
          params.quote,
          tickSpacing
        );
        setOfferGasbase(config.offerGasbase);

        // Calculate provision details using contract-based provision
        // Get per-offer provision for both ask and bid sides
        const [askProvision, bidProvision] = await Promise.all([
          getProvision(
            params.base,
            params.quote,
            tickSpacing,
            BigInt(params.gasreq)
          ),
          getProvision(
            params.quote,
            params.base,
            tickSpacing,
            BigInt(params.gasreq)
          ),
        ]);

        // For Kandel, assume equal distribution between asks and bids
        const askOffers = Math.ceil(offers / 2);
        const bidOffers = Math.floor(offers / 2);

        const totalNeeded =
          askProvision * BigInt(askOffers) + bidProvision * BigInt(bidOffers);
        const lockedAmount = totalNeeded; // All needed provision should be locked for active offers
        const missingAmount = missing(totalNeeded, lockedAmount, fb);

        setPerAskProvision(askProvision);
        setPerBidProvision(bidProvision);
        setTotalProvisionNeeded(totalNeeded);
        setLockedProvision(lockedAmount);
        setMissingProvision(missingAmount);
      } catch (error) {
        console.error('Failed to fetch Kandel data:', error);
      } finally {
        setLoading(false);
      }
    },
    [kandelAddress]
  );

  useEffect(() => {
    fetchData(true);
  }, [fetchData]);

  const handleRetract = async () => {
    try {
      await kandel.retractAll({ deprovision: false });

      await fetchData();
    } catch (error) {
      console.error('Failed to retract offers:', error);
    }
  };

  const handleWithdrawEth = async () => {
    if (!userAddress) {
      console.error('No user address available');
      return;
    }

    try {
      await kandel.withdrawEthToUser(userAddress);

      await fetchData();
    } catch (error) {
      console.error('Failed to withdraw ETH:', error);
    }
  };

  const handleWithdrawBaseToken = async () => {
    if (!userAddress) {
      return;
    }

    try {
      await kandel.withdrawBaseToken(undefined, userAddress);

      await fetchData();
    } catch (error) {
      console.error('Failed to withdraw base token:', error);
    }
  };

  const handleWithdrawQuoteToken = async () => {
    if (!userAddress) {
      return;
    }

    try {
      await kandel.withdrawQuoteToken(undefined, userAddress);

      await fetchData();
    } catch (error) {
      console.error('Failed to withdraw quote token:', error);
    }
  };

  const handleCompleteShutdown = async () => {
    if (!userAddress) {
      return;
    }

    if (
      !confirm(
        'This will permanently shut down your Kandel position, withdraw all provisions, and remove all offers. This action cannot be undone. Continue?'
      )
    ) {
      return;
    }

    try {
      await kandel.retractAndWithdrawAll(userAddress);

      await fetchData();
    } catch (error) {
      console.error('Failed to shutdown Kandel position:', error);
    }
  };

  // Deposit funds handlers
  const handleTokenDeposit = async () => {
    if (!kandelParams || !userAddress || !baseTokenInfo || !quoteTokenInfo)
      return;

    // Validate base amount
    if (baseDepositAmount) {
      const baseError = validateDepositAmount(
        baseDepositAmount,
        baseBalance,
        baseTokenInfo.symbol,
        baseTokenInfo.decimals
      );
      if (baseError) {
        alert(baseError);
        return;
      }
    }

    // Validate quote amount
    if (quoteDepositAmount) {
      const quoteError = validateDepositAmount(
        quoteDepositAmount,
        quoteBalance,
        quoteTokenInfo.symbol,
        quoteTokenInfo.decimals
      );
      if (quoteError) {
        alert(quoteError);
        return;
      }
    }

    // Use dynamic decimals
    const baseAmount = baseDepositAmount
      ? parseAmount(baseDepositAmount, baseTokenInfo.decimals)
      : BigInt(0);
    const quoteAmount = quoteDepositAmount
      ? parseAmount(quoteDepositAmount, quoteTokenInfo.decimals)
      : BigInt(0);

    if (baseAmount === BigInt(0) && quoteAmount === BigInt(0)) {
      alert('Please enter at least one token amount to deposit');
      return;
    }

    setTokenDepositLoading(true);
    try {
      // Approve tokens if needed
      if (baseAmount > BigInt(0)) {
        await erc20Approve(kandelParams.base, kandelAddress, baseAmount);
      }
      if (quoteAmount > BigInt(0)) {
        await erc20Approve(kandelParams.quote, kandelAddress, quoteAmount);
      }

      // Use kandel.depositFunds which handles the logic internally
      if (baseAmount > BigInt(0)) {
        await kandel.depositFunds(kandelParams.base, baseAmount, userAddress);
      }
      if (quoteAmount > BigInt(0)) {
        await kandel.depositFunds(kandelParams.quote, quoteAmount, userAddress);
      }

      // Clear inputs and refresh data
      setBaseDepositAmount('');
      setQuoteDepositAmount('');
      await fetchData();
    } catch (error) {
      console.error('Failed to deposit tokens:', error);
    } finally {
      setTokenDepositLoading(false);
    }
  };

  const handleEthDeposit = async () => {
    if (!ethDepositAmount || !userAddress) return;

    // Validate ETH amount
    const ethError = validateDepositAmount(
      ethDepositAmount,
      ethBalance,
      'ETH',
      18
    );
    if (ethError) {
      alert(ethError);
      return;
    }

    const ethAmount = parseAmount(ethDepositAmount, 18);

    if (ethAmount === BigInt(0)) {
      alert('Please enter ETH amount to deposit');
      return;
    }

    setEthDepositLoading(true);
    try {
      // Use Mangrove's fund function to deposit ETH for the Kandel
      await writeContractAsync({
        address: ADDRESSES.mangrove,
        abi: MangroveABI,
        functionName: 'fund',
        args: [kandelAddress],
        value: ethAmount,
      });

      // Clear input and refresh data
      setEthDepositAmount('');
      await fetchData();
    } catch (error) {
      console.error('Failed to deposit ETH:', error);
    } finally {
      setEthDepositLoading(false);
    }
  };

  const handleFundProvision = async () => {
    try {
      await fundMaker(kandelAddress, missingProvision);

      await fetchData();
    } catch (error) {
      console.error('Failed to fund provision:', error);
    }
  };

  if (loading) {
    return (
      <div className='min-h-screen p-8 flex items-center justify-center'>
        <div className='text-slate-400'>Loading Kandel details...</div>
      </div>
    );
  }

  if (!kandelParams) {
    return (
      <div className='min-h-screen p-8 flex items-center justify-center'>
        <div className='text-red-400'>Failed to load Kandel</div>
      </div>
    );
  }

  return (
    <div className='min-h-screen p-8'>
      <div className='max-w-7xl mx-auto'>
        <header className='flex justify-between items-center mb-8'>
          <div>
            <button
              onClick={() => router.push('/')}
              className='text-slate-400 hover:text-slate-200 mb-2 transition-colors cursor-pointer'
            >
              ← Back to Markets
            </button>
            <h1 className='text-3xl font-bold text-slate-100'>
              Kandel Position
            </h1>
            <p className='text-slate-400 font-mono text-sm mt-1'>
              {kandelAddress}
            </p>
          </div>
          <Connect />
        </header>

        <ChainGuard>
          {showEditForm ? (
            <div className='space-y-6'>
              <div className='flex justify-between items-center'>
                <h2 className='text-xl font-semibold text-slate-200'>
                  Edit Kandel
                </h2>
                <button
                  onClick={() => setShowEditForm(false)}
                  className='btn-secondary'
                >
                  Cancel
                </button>
              </div>
              <KandelForm
                kandelAddress={kandelAddress}
                isEditing={true}
                onSuccess={async () => {
                  setShowEditForm(false);
                  await fetchData();
                }}
              />
            </div>
          ) : (
            <div className='space-y-6'>
              <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
                <div className='lg:col-span-2 space-y-6'>
                  <div className='card'>
                    <h2 className='text-xl font-semibold text-slate-200 mb-6'>
                      Position Parameters
                    </h2>

                    {/* Market Information */}
                    <div className='space-y-4'>
                      <div className='pb-4 border-b border-slate-600/30'>
                        <h3 className='text-sm font-medium text-slate-300 mb-3 flex items-center gap-2'>
                          <span className='w-2 h-2 bg-blue-400 rounded-full'></span>
                          Market Information
                        </h3>
                        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                          <div className='flex flex-col'>
                            <span className='text-xs text-slate-500 mb-1'>
                              Token Pair
                            </span>
                            <div className='text-slate-200 font-medium'>
                              <TokenDisplay address={kandelParams.base} />
                              <span className='text-slate-400 mx-2'>→</span>
                              <TokenDisplay address={kandelParams.quote} />
                            </div>
                          </div>
                          <div className='flex flex-col'>
                            <span className='text-xs text-slate-500 mb-1'>
                              Price Range
                            </span>
                            <div className='text-slate-200 font-medium'>
                              {kandelParams.minPrice === 0 ||
                              kandelParams.maxPrice === 0 ? (
                                <span className='text-slate-400'>Not Set</span>
                              ) : (
                                <>
                                  {formatAmount(kandelParams.minPrice)}
                                  <span className='text-slate-400 mx-2'>→</span>
                                  {formatAmount(kandelParams.maxPrice)}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className='mt-3'>
                          <span className='text-xs text-slate-500'>
                            Contract Addresses
                          </span>
                          <div className='space-y-1 mt-1'>
                            <div className='text-slate-300 font-mono text-sm flex items-center gap-2'>
                              <TokenDisplay address={kandelParams.base} />:
                              <span className='text-slate-400'>
                                {kandelParams.base}
                              </span>
                            </div>
                            <div className='text-slate-300 font-mono text-sm flex items-center gap-2'>
                              <TokenDisplay address={kandelParams.quote} />:
                              <span className='text-slate-400'>
                                {kandelParams.quote}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Strategy Parameters */}
                      <div className='pb-4 border-b border-slate-600/30'>
                        <h3 className='text-sm font-medium text-slate-300 mb-3 flex items-center gap-2'>
                          <span className='w-2 h-2 bg-green-400 rounded-full'></span>
                          Strategy Parameters
                        </h3>
                        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                          <div className='flex flex-col'>
                            <span className='text-xs text-slate-500 mb-1'>
                              Levels per Side
                            </span>
                            <div className='text-slate-200 font-medium text-lg'>
                              {kandelParams.levelsPerSide}
                            </div>
                          </div>
                          <div className='flex flex-col'>
                            <span className='text-xs text-slate-500 mb-1'>
                              Step Size
                            </span>
                            <div className='flex items-center gap-2'>
                              {editingStepSize ? (
                                <>
                                  <input
                                    type='number'
                                    value={tempStepSize}
                                    onChange={(e) =>
                                      setTempStepSize(e.target.value)
                                    }
                                    className='input text-sm w-20 h-8'
                                    min='1'
                                    max={Math.max(
                                      kandelParams.levelsPerSide * 2 - 1,
                                      1
                                    )}
                                  />
                                  <button
                                    onClick={handleStepSizeSave}
                                    className='text-green-400 hover:text-green-300 text-sm px-2 py-1 rounded'
                                  >
                                    ✓
                                  </button>
                                  <button
                                    onClick={handleStepSizeCancel}
                                    className='text-red-400 hover:text-red-300 text-sm px-2 py-1 rounded'
                                  >
                                    ✕
                                  </button>
                                </>
                              ) : (
                                <>
                                  <span className='text-slate-200 font-medium text-lg'>
                                    {kandelParams.stepSize}
                                  </span>
                                  <button
                                    onClick={handleStepSizeEdit}
                                    className='text-slate-400 hover:text-slate-200 text-sm px-2 py-1 rounded hover:bg-slate-700/50'
                                    title='Edit step size'
                                  >
                                    ✏️
                                  </button>
                                </>
                              )}
                            </div>
                            {stepSizeError && (
                              <div className='text-red-400 text-xs mt-1'>
                                {stepSizeError}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Execution Settings */}
                      <div>
                        <h3 className='text-sm font-medium text-slate-300 mb-3 flex items-center gap-2'>
                          <span className='w-2 h-2 bg-orange-400 rounded-full'></span>
                          Execution Settings
                        </h3>
                        <div className='flex flex-col max-w-sm'>
                          <span className='text-xs text-slate-500 mb-1'>
                            Gas Requirement
                          </span>
                          <div className='flex items-center gap-2'>
                            {editingGasreq ? (
                              <>
                                <input
                                  type='number'
                                  value={tempGasreq}
                                  onChange={(e) =>
                                    setTempGasreq(e.target.value)
                                  }
                                  className='input text-sm w-24 h-8'
                                  min='1'
                                  max='16777215'
                                />
                                <button
                                  onClick={handleGasreqSave}
                                  className='text-green-400 hover:text-green-300 text-sm px-2 py-1 rounded'
                                >
                                  ✓
                                </button>
                                <button
                                  onClick={handleGasreqCancel}
                                  className='text-red-400 hover:text-red-300 text-sm px-2 py-1 rounded'
                                >
                                  ✕
                                </button>
                              </>
                            ) : (
                              <>
                                <span className='text-slate-200 font-medium text-lg'>
                                  {kandelParams.gasreq.toLocaleString()}
                                </span>
                                <button
                                  onClick={handleGasreqEdit}
                                  className='text-slate-400 hover:text-slate-200 text-sm px-2 py-1 rounded hover:bg-slate-700/50'
                                  title='Edit gas requirement'
                                >
                                  ✏️
                                </button>
                              </>
                            )}
                          </div>
                          {gasreqError && (
                            <div className='text-red-400 text-xs mt-1'>
                              {gasreqError}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <ProvisionPanel
                    gasprice={BigInt(kandelParams.gasprice)}
                    offerGasbase={offerGasbase}
                    gasreq={BigInt(kandelParams.gasreq)}
                    nOffers={BigInt(liveOffers)}
                    lockedProvision={lockedProvision}
                    freeBalance={freeBalance}
                    perAskProvision={perAskProvision}
                    perBidProvision={perBidProvision}
                    totalProvisionNeeded={totalProvisionNeeded}
                  />

                  <div className='card'>
                    <h3 className='text-lg font-semibold text-slate-200 mb-4'>
                      Actions
                    </h3>
                    <div className='grid grid-cols-2 gap-4'>
                      <button
                        onClick={() => setShowEditForm(true)}
                        className='btn-primary'
                      >
                        Edit Position
                      </button>
                      <button onClick={handleRetract} className='btn-danger'>
                        Retract All Offers
                      </button>
                      <button
                        onClick={handleWithdrawEth}
                        className='btn-secondary'
                        disabled={freeBalance === BigInt(0)}
                      >
                        Withdraw ETH
                      </button>
                      <button
                        onClick={handleWithdrawBaseToken}
                        className='btn-secondary'
                        disabled={inventory.baseQty === BigInt(0)}
                      >
                        Withdraw <TokenDisplay address={kandelParams.base} />
                      </button>
                      <button
                        onClick={handleWithdrawQuoteToken}
                        className='btn-secondary'
                        disabled={inventory.quoteQty === BigInt(0)}
                      >
                        Withdraw <TokenDisplay address={kandelParams.quote} />
                      </button>
                      {missingProvision > BigInt(0) && (
                        <button
                          onClick={handleFundProvision}
                          className='btn-warning col-span-2'
                        >
                          💰 Fund Missing Provision (
                          {formatEthAmount(missingProvision)} ETH)
                        </button>
                      )}
                      <button
                        onClick={handleCompleteShutdown}
                        className='btn-danger col-span-2'
                      >
                        Complete Shutdown & Withdraw All
                      </button>
                    </div>
                  </div>
                </div>

                <div className='space-y-6'>
                  <InventoryCard
                    baseQty={inventory.baseQty}
                    quoteQty={inventory.quoteQty}
                    liveOffers={liveOffers}
                    baseToken={kandelParams.base}
                    quoteToken={kandelParams.quote}
                  />

                  <div className='card'>
                    <h3 className='text-lg font-semibold text-slate-200 mb-4'>
                      Deposit Funds
                    </h3>

                    {/* Token Deposits */}
                    <div className='space-y-4'>
                      <div className='grid grid-cols-2 gap-4'>
                        <div>
                          <label className='label text-sm'>
                            <TokenDisplay address={kandelParams.base} /> Amount
                          </label>
                          <input
                            type='text'
                            value={baseDepositAmount}
                            onChange={(e) =>
                              setBaseDepositAmount(e.target.value)
                            }
                            placeholder='0.0'
                            className='input'
                            disabled={tokenDepositLoading || ethDepositLoading}
                          />
                        </div>
                        <div>
                          <label className='label text-sm'>
                            <TokenDisplay address={kandelParams.quote} /> Amount
                          </label>
                          <input
                            type='text'
                            value={quoteDepositAmount}
                            onChange={(e) =>
                              setQuoteDepositAmount(e.target.value)
                            }
                            placeholder='0.0'
                            className='input'
                            disabled={tokenDepositLoading || ethDepositLoading}
                          />
                        </div>
                      </div>

                      <button
                        onClick={handleTokenDeposit}
                        disabled={
                          tokenDepositLoading ||
                          (!baseDepositAmount && !quoteDepositAmount)
                        }
                        className='btn-primary w-full disabled:opacity-50'
                      >
                        {tokenDepositLoading
                          ? 'Depositing...'
                          : 'Deposit Tokens'}
                      </button>

                      {/* ETH Deposit */}
                      <div className='border-t border-slate-600 pt-4'>
                        <div>
                          <label className='label text-sm'>
                            ETH Amount (Provision)
                          </label>
                          <input
                            type='text'
                            value={ethDepositAmount}
                            onChange={(e) =>
                              setEthDepositAmount(e.target.value)
                            }
                            placeholder='0.0'
                            className='input'
                            disabled={tokenDepositLoading || ethDepositLoading}
                          />
                        </div>

                        <button
                          onClick={handleEthDeposit}
                          disabled={ethDepositLoading || !ethDepositAmount}
                          className='btn-secondary w-full mt-2 disabled:opacity-50'
                        >
                          {ethDepositLoading ? 'Depositing...' : 'Deposit ETH'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h2 className='text-xl font-semibold text-slate-200 mb-4'>
                  Order Book (Highlighting Your Offers For The Current Kandel)
                </h2>
                <OrderBook
                  base={kandelParams.base}
                  quote={kandelParams.quote}
                  tickSpacing={marketTickSpacing}
                  highlightMakers={[kandelAddress]}
                  key='orderBook-single-kandel'
                />
              </div>
            </div>
          )}
        </ChainGuard>
      </div>
    </div>
  );
}
