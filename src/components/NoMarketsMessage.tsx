import { MARKET_LABELS } from '../lib/ui-constants';

export function NoMarketsMessage() {
  return (
    <div className='text-center py-8'>
      <div className='text-slate-400 text-lg mb-2'>
        {MARKET_LABELS.noMarketsFound}
      </div>
      <p className='text-slate-500'>
        There are currently no active markets.
      </p>
    </div>
  );
}