'use client';

import { useState } from 'react';
import { useAccount, useBalance } from 'wagmi';
import { TokenDisplay } from './TokenDisplay';
import { useTokens } from '../hooks/useTokens';
import { useKandel } from '../hooks/useKandel';
import { parseAmount } from '../lib/pricing';
import { TokenInfo } from '../hooks/useTokenInfo';
import { useMangrove } from '@/hooks/useMangrove';

interface KandelDepositPanelProps {
  kandelAddress: `0x${string}`;
  baseTokenInfo: TokenInfo;
  quoteTokenInfo: TokenInfo;
}

export function KandelDepositPanel({
  kandelAddress,
  baseTokenInfo,
  quoteTokenInfo,
}: KandelDepositPanelProps) {
  const { address: userAddress } = useAccount();
  const { erc20Approve } = useTokens();
  const kandel = useKandel(kandelAddress);
  const { fundMaker } = useMangrove();

  const [baseDepositAmount, setBaseDepositAmount] = useState('');
  const [quoteDepositAmount, setQuoteDepositAmount] = useState('');
  const [ethDepositAmount, setEthDepositAmount] = useState('');

  const [tokenDepositLoading, setTokenDepositLoading] = useState(false);
  const [ethDepositLoading, setEthDepositLoading] = useState(false);

  const { data: baseBalance } = useBalance({
    address: userAddress,
    token: baseTokenInfo.address as `0x${string}`,
    query: { enabled: !!userAddress },
  });

  const { data: quoteBalance } = useBalance({
    address: userAddress,
    token: quoteTokenInfo.address as `0x${string}`,
    query: { enabled: !!userAddress },
  });

  const { data: ethBalance } = useBalance({
    address: userAddress,
    query: { enabled: !!userAddress },
  });

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

    const amountWei = parseAmount(amountStr, decimals);
    if (amountWei > balanceData.value) {
      return `Insufficient ${tokenSymbol} balance`;
    }

    return null;
  }

  const handleTokenDeposit = async () => {
    if (!userAddress) return;

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

    // Parse amounts
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
      if (baseAmount > BigInt(0)) {
        await erc20Approve(
          baseTokenInfo.address as `0x${string}`,
          kandelAddress,
          baseAmount
        );
      }
      if (quoteAmount > BigInt(0)) {
        await erc20Approve(
          quoteTokenInfo.address as `0x${string}`,
          kandelAddress,
          quoteAmount
        );
      }

      if (baseAmount > BigInt(0)) {
        await kandel.depositFunds(
          baseTokenInfo.address as `0x${string}`,
          baseAmount,
          userAddress
        );
      }
      if (quoteAmount > BigInt(0)) {
        await kandel.depositFunds(
          quoteTokenInfo.address as `0x${string}`,
          quoteAmount,
          userAddress
        );
      }

      setBaseDepositAmount('');
      setQuoteDepositAmount('');
    } catch (error) {
      console.error('Failed to deposit tokens:', error);
    } finally {
      setTokenDepositLoading(false);
    }
  };

  const handleEthDeposit = async () => {
    if (!ethDepositAmount || !userAddress) return;

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

    const amountWei = parseAmount(ethDepositAmount, 18);

    if (amountWei === BigInt(0)) {
      alert('Please enter ETH amount to deposit');
      return;
    }

    setEthDepositLoading(true);
    try {
      await fundMaker(kandelAddress, amountWei);

      setEthDepositAmount('');
    } catch (error) {
      console.error('Failed to deposit ETH:', error);
    } finally {
      setEthDepositLoading(false);
    }
  };

  return (
    <div className='card'>
      <h3 className='text-lg font-semibold text-slate-200 mb-4'>
        Deposit Funds
      </h3>

      <div className='space-y-4'>
        <div className='grid grid-cols-2 gap-4'>
          <div>
            <label className='label text-sm'>
              <TokenDisplay address={baseTokenInfo.address as `0x${string}`} />{' '}
              Amount
            </label>
            <input
              type='text'
              value={baseDepositAmount}
              onChange={(e) => setBaseDepositAmount(e.target.value)}
              placeholder='0.0'
              className='input'
              disabled={tokenDepositLoading || ethDepositLoading}
            />
          </div>
          <div>
            <label className='label text-sm'>
              <TokenDisplay address={quoteTokenInfo.address as `0x${string}`} />{' '}
              Amount
            </label>
            <input
              type='text'
              value={quoteDepositAmount}
              onChange={(e) => setQuoteDepositAmount(e.target.value)}
              placeholder='0.0'
              className='input'
              disabled={tokenDepositLoading || ethDepositLoading}
            />
          </div>
        </div>

        <button
          onClick={handleTokenDeposit}
          disabled={
            tokenDepositLoading || (!baseDepositAmount && !quoteDepositAmount)
          }
          className='btn-primary w-full disabled:opacity-50'
        >
          {tokenDepositLoading ? 'Depositing...' : 'Deposit Tokens'}
        </button>

        <div className='border-t border-slate-600 pt-4'>
          <div>
            <label className='label text-sm'>ETH Amount (Provision)</label>
            <input
              type='text'
              value={ethDepositAmount}
              onChange={(e) => setEthDepositAmount(e.target.value)}
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
  );
}
