'use client';

import { useState } from 'react';
import { useAccount, useBalance } from 'wagmi';
import { TokenDisplay } from './TokenDisplay';
import { parseAmount } from '../lib/pricing';
import { TokenInfo } from '../hooks/token/useTokenInfo';
import type { Address } from 'viem';
import { useDepositFunds } from '@/hooks/kandel/mutations/useDepositFunds';
import { useFundMaker } from '@/hooks/mangrove/mutations/useFundMaker';

interface KandelDepositPanelProps {
  kandelAddress: Address;
  baseTokenInfo: TokenInfo;
  quoteTokenInfo: TokenInfo;
}

export function KandelDepositPanel({
  kandelAddress,
  baseTokenInfo,
  quoteTokenInfo,
}: KandelDepositPanelProps) {
  const { address: userAddress } = useAccount();
  const { depositFunds, isLoading: isLoadingTokenDeposit } = useDepositFunds();
  const { fundMaker, isLoading: isLoadingEthDeposit } = useFundMaker();

  const [baseDepositAmount, setBaseDepositAmount] = useState('');
  const [quoteDepositAmount, setQuoteDepositAmount] = useState('');
  const [ethDepositAmount, setEthDepositAmount] = useState('');

  const { data: baseBalance } = useBalance({
    address: userAddress,
    token: baseTokenInfo.address as Address,
    query: { enabled: !!userAddress },
  });

  const { data: quoteBalance } = useBalance({
    address: userAddress,
    token: quoteTokenInfo.address as Address,
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

    try {
      await depositFunds({
        kandel: kandelAddress,
        baseToken: baseTokenInfo.address,
        quoteToken: quoteTokenInfo.address,
        baseAmount,
        quoteAmount,
      });

      setBaseDepositAmount('');
      setQuoteDepositAmount('');
    } catch (error) {
      console.error('Failed to deposit tokens:', error);
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

    try {
      await fundMaker(kandelAddress, amountWei);

      setEthDepositAmount('');
    } catch (error) {
      console.error('Failed to deposit ETH:', error);
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
              <TokenDisplay tokenInfo={baseTokenInfo} /> Amount
            </label>
            <input
              type='text'
              value={baseDepositAmount}
              onChange={(e) => setBaseDepositAmount(e.target.value)}
              placeholder='0.0'
              className='input'
              disabled={isLoadingTokenDeposit || isLoadingEthDeposit}
            />
          </div>
          <div>
            <label className='label text-sm'>
              <TokenDisplay tokenInfo={quoteTokenInfo} /> Amount
            </label>
            <input
              type='text'
              value={quoteDepositAmount}
              onChange={(e) => setQuoteDepositAmount(e.target.value)}
              placeholder='0.0'
              className='input'
              disabled={isLoadingTokenDeposit || isLoadingEthDeposit}
            />
          </div>
        </div>

        <button
          onClick={handleTokenDeposit}
          disabled={
            isLoadingTokenDeposit || (!baseDepositAmount && !quoteDepositAmount)
          }
          className='btn-primary w-full disabled:opacity-50'
        >
          {isLoadingTokenDeposit ? 'Depositing...' : 'Deposit Tokens'}
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
              disabled={isLoadingTokenDeposit || isLoadingEthDeposit}
            />
          </div>

          <button
            onClick={handleEthDeposit}
            disabled={isLoadingEthDeposit || !ethDepositAmount}
            className='btn-secondary w-full mt-2 disabled:opacity-50'
          >
            {isLoadingEthDeposit ? 'Depositing...' : 'Deposit ETH'}
          </button>
        </div>
      </div>
    </div>
  );
}
