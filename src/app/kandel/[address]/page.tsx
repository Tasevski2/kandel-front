'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import { Connect } from '@/components/ConnectWrapper';
import { OrderBook } from '@/components/OrderBook';
import { ProvisionPanel } from '@/components/ProvisionPanel';
import { InventoryCard } from '@/components/InventoryCard';
import { KandelDepositPanel } from '@/components/KandelDepositPanel';
import { KandelForm } from '@/components/KandelForm';
import { ChainGuard } from '@/components/ChainGuard';
import { InlineEditField } from '@/components/InlineEditField';
import { KandelParams, useKandel } from '@/hooks/useKandel';
import { useMangrove } from '@/hooks/useMangrove';
import { useMgvReader } from '@/hooks/useMgvReader';
import { useTokensInfo } from '@/hooks/useTokenInfo';
import { formatAmount, formatEthAmount } from '@/lib/formatting';
import { useProvision } from '@/hooks/useProvision';
import { TokenDisplay } from '@/components/TokenDisplay';
import { validateGasreq, validateStepSize } from '@/lib/validation';

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

  const [loading, setLoading] = useState(true);
  const [showEditForm, setShowEditForm] = useState(false);
  const [kandelParams, setKandelParams] = useState<KandelParams>();

  const { tokensInfo } = useTokensInfo(
    kandelParams ? [kandelParams.base, kandelParams.quote] : []
  );
  const [baseTokenInfo, quoteTokenInfo] = tokensInfo || [null, null];

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

  const validateStepSizeInput = (value: string) => {
    if (!kandelParams) return 'Kandel params not loaded';
    const newStepSize = parseInt(value);
    const pricePoints = kandelParams.levelsPerSide * 2;
    return validateStepSize(newStepSize, pricePoints);
  };

  const validateGasreqInput = (value: string) => {
    const newGasreq = parseInt(value);
    return validateGasreq(newGasreq);
  };

  const handleStepSizeSave = async (value: string) => {
    if (!kandelParams) throw new Error('Kandel params not loaded');

    const newStepSize = parseInt(value);
    try {
      await kandel.setStepSize(newStepSize);

      await fetchData();
    } catch (error) {
      console.error('Failed to set step size.');
    }
  };

  const handleGasreqSave = async (value: string) => {
    if (!kandelParams) throw new Error('Kandel params not loaded');

    const newGasreq = parseInt(value);

    try {
      await kandel.setGasReq(newGasreq);

      await fetchData();
    } catch (error) {
      console.error('Failed to set gas requirement.');
    }
  };

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

  const handleFundProvision = async () => {
    try {
      await fundMaker(kandelAddress, missingProvision);

      await fetchData();
    } catch (error) {
      console.error('Failed to fund provision:', error);
    }
  };

  useEffect(() => {
    fetchData(true);
  }, [fetchData]);

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
                          <InlineEditField
                            label='Step Size'
                            value={kandelParams.stepSize}
                            onSave={handleStepSizeSave}
                            validate={validateStepSizeInput}
                            inputType='number'
                            inputClass='w-20'
                            min={1}
                            max={Math.max(
                              kandelParams.levelsPerSide * 2 - 1,
                              1
                            )}
                            editTooltip='Edit step size'
                          />
                        </div>
                      </div>

                      {/* Execution Settings */}
                      <div>
                        <h3 className='text-sm font-medium text-slate-300 mb-3 flex items-center gap-2'>
                          <span className='w-2 h-2 bg-orange-400 rounded-full'></span>
                          Execution Settings
                        </h3>
                        <div className='max-w-sm'>
                          <InlineEditField
                            label='Gas Requirement'
                            value={kandelParams.gasreq}
                            onSave={handleGasreqSave}
                            validate={validateGasreqInput}
                            inputType='number'
                            inputClass='w-24'
                            min={1}
                            max={16777215}
                            displayFormatter={(value) => value.toLocaleString()}
                            editTooltip='Edit gas requirement'
                          />
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
                  {/* Actions */}
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

                  {baseTokenInfo && quoteTokenInfo && (
                    <KandelDepositPanel
                      kandelAddress={kandelAddress}
                      baseTokenInfo={baseTokenInfo}
                      quoteTokenInfo={quoteTokenInfo}
                    />
                  )}
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
