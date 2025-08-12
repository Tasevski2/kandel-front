'use client';
import { useState, use, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import { Connect } from '@/components/ConnectWrapper';
import { OrderBook } from '@/components/OrderBook';
import { ProvisionPanel } from '@/components/ProvisionPanel';
import { InventoryCard } from '@/components/InventoryCard';
import { KandelDepositPanel } from '@/components/KandelDepositPanel';
import { KandelForm } from '@/components/KandelForm/index';
import { ChainGuard } from '@/components/ChainGuard';
import { InlineEditField } from '@/components/InlineEditField';
import { useSetStepSize } from '@/hooks/kandel/mutations/useSetStepSize';
import { useSetGasReq } from '@/hooks/kandel/mutations/useSetGasReq';
import { useRetractAll } from '@/hooks/kandel/mutations/useRetractAll';
import { useWithdrawEth } from '@/hooks/mangrove/mutations/useWithdrawEth';
import { useWithdrawToken } from '@/hooks/kandel/mutations/useWithdrawToken';
import { useRetractAndWithdrawAll } from '@/hooks/kandel/mutations/useRetractAndWithdrawAll';
import { formatAmount, formatEthAmount } from '@/lib/formatting';
import { useProvision } from '@/hooks/mangrove/queries/useProvision';
import { TokenDisplay } from '@/components/TokenDisplay';
import { validateGasreq, validateStepSize } from '@/lib/validation';
import type { Address } from 'viem';
import { missingProvisionWei } from '@/lib/provision';
import { useGetMakerFreeBalance } from '@/hooks/mangrove/queries/useGetMakerFreeBalance';
import { useGetReserveBalances } from '@/hooks/kandel/queries/useGetReserveBalances';
import { useGetLocalConfigs } from '@/hooks/mangrove/queries/useGetLocalConfigs';
import { useFundMaker } from '@/hooks/mangrove/mutations/useFundMaker';
import { useGetOrderBook } from '@/hooks/mangrove/queries/useGetOrderBook';
import { useGetKandelInfo } from '@/hooks/kandel/queries/useGetKandelInfo';

interface PageProps {
  params: Promise<{
    address: string;
  }>;
}

export default function KandelDetailPage({ params }: PageProps) {
  const router = useRouter();
  const { address: userAddress } = useAccount();

  const resolvedParams = use(params);
  const kandelAddress = resolvedParams.address as Address;

  const { fundMaker, isLoading: isFundingProvision } = useFundMaker();

  const { setStepSize } = useSetStepSize();
  const { setGasReq } = useSetGasReq();
  const { retractAll } = useRetractAll();
  const { withdrawEth } = useWithdrawEth();
  const { withdrawToken } = useWithdrawToken();
  const { retractAndWithdrawAll } = useRetractAndWithdrawAll();
  const { kandelInfo } = useGetKandelInfo(kandelAddress);

  const [showEditForm, setShowEditForm] = useState(false);

  const baseTokenInfo = kandelInfo?.base;
  const quoteTokenInfo = kandelInfo?.quote;

  const { provision } = useProvision({
    base: baseTokenInfo?.address,
    quote: quoteTokenInfo?.address,
    tickSpacing: kandelInfo?.tickSpacing,
    gasreq: kandelInfo?.gasreq,
  });

  const { balanceWei: freeBalance } = useGetMakerFreeBalance(kandelAddress);
  const { baseBalance: baseReserveBalance, quoteBalance: quoteReserveBalance } =
    useGetReserveBalances(kandelAddress);

  const {
    ask: { offerGasbase: askOfferGasbase },
    bid: { offerGasbase: bidOfferGasbase },
  } = useGetLocalConfigs({
    base: baseTokenInfo?.address,
    quote: quoteTokenInfo?.address,
    tickSpacing: kandelInfo?.tickSpacing,
  });

  const { asks, bids } = useGetOrderBook({
    base: baseTokenInfo?.address,
    quote: quoteTokenInfo?.address,
    baseDec: baseTokenInfo?.decimals,
    quoteDec: quoteTokenInfo?.decimals,
    tickSpacing: kandelInfo?.tickSpacing,
    maker: kandelAddress,
  });
  const nLiveOffers =
    asks !== undefined && bids !== undefined ? asks.length + bids.length : 0; // helper for UI

  const calculatedProvisions = useMemo(() => {
    if (
      provision?.perAsk === undefined ||
      provision.perBid === undefined ||
      freeBalance === undefined ||
      asks === undefined ||
      bids === undefined
    ) {
      return { totalNeeded: BigInt(0), locked: BigInt(0), missing: BigInt(0) };
    }

    const totalNeeded =
      provision.perAsk * BigInt(asks.length) +
      provision.perBid * BigInt(bids.length);
    const locked = totalNeeded;
    const missing = missingProvisionWei(totalNeeded, locked, freeBalance);

    return {
      totalNeeded,
      locked,
      missing,
    };
  }, [provision, freeBalance, asks, bids]);

  const validateStepSizeInput = (value: string) => {
    const newStepSize = parseInt(value);
    const pricePoints = kandelInfo!.levelsPerSide * 2;
    return validateStepSize(newStepSize, pricePoints);
  };

  const validateGasreqInput = (value: string) => {
    return validateGasreq(value);
  };

  const handleStepSizeSave = async (value: string) => {
    const newStepSize = parseInt(value);
    try {
      await setStepSize({ kandelAddr: kandelAddress, stepSize: newStepSize });

      // await fetchData();
    } catch (error) {
      console.error('Failed to set step size.');
    }
  };

  const handleGasreqSave = async (value: string) => {
    const newGasreq = parseInt(value);

    try {
      await setGasReq({ kandelAddr: kandelAddress, gasreq: newGasreq });

      // await fetchData();
    } catch (error) {
      console.error('Failed to set gas requirement.');
    }
  };

  const handleRetract = async () => {
    try {
      await retractAll({
        kandelAddr: kandelAddress,
        pricePoints: kandelInfo!.levelsPerSide * 2,
        deprovision: true,
      });

      // await fetchData();
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
      await withdrawEth({ kandelAddr: kandelAddress, recipient: userAddress });

      // await fetchData();
    } catch (error) {
      console.error('Failed to withdraw ETH:', error);
    }
  };

  const handleWithdrawBaseToken = async () => {
    if (!userAddress) {
      return;
    }

    try {
      await withdrawToken({
        kandelAddr: kandelAddress,
        tokenType: 'base',
        recipient: userAddress,
      });

      // await fetchData();
    } catch (error) {
      console.error('Failed to withdraw base token:', error);
    }
  };

  const handleWithdrawQuoteToken = async () => {
    if (!userAddress) {
      return;
    }

    try {
      await withdrawToken({
        kandelAddr: kandelAddress,
        tokenType: 'quote',
        recipient: userAddress,
      });

      // await fetchData();
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
      await retractAndWithdrawAll({
        kandelAddr: kandelAddress,
        recipient: userAddress,
        pricePoints: kandelInfo!.levelsPerSide * 2,
      });

      // await fetchData();
    } catch (error) {
      console.error('Failed to shutdown Kandel position:', error);
    }
  };

  const handleFundProvision = async () => {
    try {
      await fundMaker(kandelAddress, calculatedProvisions.missing);

      // await fetchData();
    } catch (error) {
      console.error('Failed to fund provision:', error);
    }
  };

  if (!kandelInfo) {
    return (
      <div className='min-h-screen p-8 flex items-center justify-center'>
        <div className='text-slate-400'>Loading Kandel details...</div>
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
                kandelInfo={kandelInfo}
                isEditing={true}
                onSuccess={async () => {
                  setShowEditForm(false);
                  // Refresh data can be handled by parent component if needed
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
                              <TokenDisplay tokenInfo={baseTokenInfo} />
                              <span className='text-slate-400 mx-2'>→</span>
                              <TokenDisplay tokenInfo={quoteTokenInfo} />
                            </div>
                          </div>
                          <div className='flex flex-col'>
                            <span className='text-xs text-slate-500 mb-1'>
                              Price Range
                            </span>
                            <div className='text-slate-200 font-medium'>
                              {kandelInfo?.minPrice === undefined ||
                              kandelInfo?.maxPrice === undefined ? (
                                <span className='text-slate-400'>Not Set</span>
                              ) : (
                                <>
                                  {formatAmount(kandelInfo.minPrice)}
                                  <span className='text-slate-400 mx-2'>→</span>
                                  {formatAmount(kandelInfo.maxPrice)}
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
                              <TokenDisplay tokenInfo={baseTokenInfo} />:
                              <span className='text-slate-400'>
                                {baseTokenInfo?.address ?? ''}
                              </span>
                            </div>
                            <div className='text-slate-300 font-mono text-sm flex items-center gap-2'>
                              <TokenDisplay tokenInfo={quoteTokenInfo} />:
                              <span className='text-slate-400'>
                                {quoteTokenInfo?.address ?? ''}
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
                              {kandelInfo?.levelsPerSide}
                            </div>
                          </div>
                          <InlineEditField
                            label='Step Size'
                            value={kandelInfo.stepSize}
                            onSave={handleStepSizeSave}
                            validate={validateStepSizeInput}
                            inputType='number'
                            inputClass='w-20'
                            min={1}
                            max={Math.max(kandelInfo.levelsPerSide * 2 - 1, 1)}
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
                            value={kandelInfo.gasreq}
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
                    gasprice={BigInt(kandelInfo.gasprice)}
                    offerGasbase={
                      askOfferGasbase > bidOfferGasbase
                        ? askOfferGasbase
                        : bidOfferGasbase
                    } // just show the max offer gas base
                    gasreq={BigInt(kandelInfo.gasreq)}
                    nOffers={BigInt(nLiveOffers)}
                    totalProvisionNeeded={calculatedProvisions.totalNeeded}
                    lockedProvision={calculatedProvisions.locked}
                    missingProvision={calculatedProvisions.missing}
                    freeBalance={freeBalance || BigInt(0)}
                    perAskProvision={provision?.perAsk || BigInt(0)}
                    perBidProvision={provision?.perBid || BigInt(0)}
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
                      <button 
                        onClick={handleRetract} 
                        className='btn-danger'
                        disabled={nLiveOffers === 0}
                      >
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
                        disabled={baseReserveBalance === BigInt(0)}
                      >
                        Withdraw <TokenDisplay tokenInfo={baseTokenInfo} />
                      </button>
                      <button
                        onClick={handleWithdrawQuoteToken}
                        className='btn-secondary'
                        disabled={quoteReserveBalance === BigInt(0)}
                      >
                        Withdraw <TokenDisplay tokenInfo={quoteTokenInfo} />
                      </button>
                      {calculatedProvisions.missing > BigInt(0) && (
                        <button
                          onClick={handleFundProvision}
                          className='btn-warning col-span-2'
                          disabled={isFundingProvision}
                        >
                          💰 Fund Missing Provision (
                          {formatEthAmount(calculatedProvisions.missing)} ETH)
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
                    baseQty={baseReserveBalance}
                    quoteQty={quoteReserveBalance}
                    nOffers={nLiveOffers}
                    baseTokenInfo={baseTokenInfo}
                    quoteTokenInfo={quoteTokenInfo}
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
                  base={baseTokenInfo?.address}
                  quote={quoteTokenInfo?.address}
                  tickSpacing={kandelInfo?.tickSpacing}
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
