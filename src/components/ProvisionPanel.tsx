import { formatEthAmount } from '../lib/formatting';

interface ProvisionPanelProps {
  gasprice: bigint;
  offerGasbase: bigint;
  gasreq: bigint;
  nOffers: bigint;
  totalProvisionNeeded: bigint;
  lockedProvision: bigint;
  missingProvision: bigint;
  freeBalance: bigint;
  perAskProvision: bigint;
  perBidProvision: bigint;
}

export function ProvisionPanel({
  gasprice,
  offerGasbase,
  gasreq,
  nOffers,
  totalProvisionNeeded,
  lockedProvision,
  missingProvision,
  freeBalance,
  perAskProvision,
  perBidProvision,
}: ProvisionPanelProps) {
  return (
    <div className='card'>
      <h3 className='text-lg font-semibold text-slate-200 mb-4'>
        Provision Details
      </h3>

      {missingProvision > BigInt(0) && (
        <div className='bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-4'>
          <p className='text-red-400 font-medium'>
            Missing Provision: {formatEthAmount(missingProvision)} ETH
          </p>
          <p className='text-red-300 text-sm mt-1'>
            You need to add more ETH to cover the provision requirements
          </p>
        </div>
      )}

      <div className='space-y-3'>
        <div className='flex justify-between'>
          <span className='text-slate-400'>Gas Price (wei/gas):</span>
          <span className='text-slate-200 font-mono'>
            {gasprice.toString()}
          </span>
        </div>

        <div className='flex justify-between'>
          <span className='text-slate-400'>Offer Gasbase:</span>
          <span className='text-slate-200 font-mono'>
            {offerGasbase.toString()}
          </span>
        </div>

        <div className='flex justify-between'>
          <span className='text-slate-400'>Gas Requirement:</span>
          <span className='text-slate-200 font-mono'>{gasreq.toString()}</span>
        </div>

        <div className='flex justify-between'>
          <span className='text-slate-400'>Number of Offers:</span>
          <span className='text-slate-200 font-mono'>{nOffers.toString()}</span>
        </div>

        <div className='border-t border-white/10 pt-3'>
          <div className='flex justify-between'>
            <span className='text-slate-400'>Per Ask Provision:</span>
            <span className='text-slate-200'>
              {formatEthAmount(perAskProvision)} ETH
            </span>
          </div>

          <div className='flex justify-between'>
            <span className='text-slate-400'>Per Bid Provision:</span>
            <span className='text-slate-200'>
              {formatEthAmount(perBidProvision)} ETH
            </span>
          </div>

          <div className='flex justify-between'>
            <span className='text-slate-400'>Total Needed:</span>
            <span className='text-slate-200'>
              {formatEthAmount(totalProvisionNeeded)} ETH
            </span>
          </div>

          <div className='flex justify-between'>
            <span className='text-slate-400'>Locked Provision:</span>
            <span className='text-slate-200'>
              {formatEthAmount(lockedProvision)} ETH
            </span>
          </div>

          <div className='flex justify-between'>
            <span className='text-slate-400'>Free Balance:</span>
            <span className='text-slate-200'>
              {formatEthAmount(freeBalance)} ETH
            </span>
          </div>

          <div className='flex justify-between font-semibold mt-2 pt-2 border-t border-white/10'>
            <span className='text-slate-300'>Missing:</span>
            <span
              className={
                missingProvision > BigInt(0) ? 'text-red-400' : 'text-green-400'
              }
            >
              {formatEthAmount(missingProvision)} ETH
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
