import { Connect } from './Connect';
import { TokenBalances } from './TokenBalances';

export function ConnectWithBalances() {
  return (
    <div className='flex items-center gap-4'>
      <Connect />
      <TokenBalances />
    </div>
  );
}
