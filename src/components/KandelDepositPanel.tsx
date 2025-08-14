'use client';

import { useState, useEffect } from 'react';
import { useAccount, useBalance } from 'wagmi';
import { TokenDisplay } from './TokenDisplay';
import { parseAmount } from '../lib/pricing';
import { formatTokenAmount } from '../lib/formatting';
import { TokenInfo } from '../hooks/token/useTokensInfo';
import { useGetTokensBalances } from '../hooks/token/useGetTokensBalances';
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
  const [baseDepositError, setBaseDepositError] = useState<string | null>(null);
  const [quoteDepositError, setQuoteDepositError] = useState<string | null>(
    null
  );
  const [ethDepositError, setEthDepositError] = useState<string | null>(null);

  const { balances, isLoading: balancesLoading } = useGetTokensBalances({
    tokenAddresses: [baseTokenInfo.address, quoteTokenInfo.address],
    userAddress,
  });

  const { data: ethBalance } = useBalance({
    address: userAddress,
    query: { enabled: !!userAddress },
  });

  useEffect(() => {
    setBaseDepositError(null);
    if (!baseDepositAmount.trim() || !userAddress) return;

    const amount = parseFloat(baseDepositAmount);
    if (isNaN(amount) || amount <= 0) {
      setBaseDepositError(
        `${baseTokenInfo.symbol} amount must be greater than 0`
      );
      return;
    }

    const inputAmount = parseAmount(baseDepositAmount, baseTokenInfo.decimals);
    const userBalance = balances[baseTokenInfo.address] || BigInt(0);

    if (inputAmount > userBalance) {
      const formattedBalance = formatTokenAmount(
        userBalance,
        baseTokenInfo.decimals
      );
      setBaseDepositError(
        `Insufficient balance. Available: ${formattedBalance} ${baseTokenInfo.symbol}`
      );
    }
  }, [baseDepositAmount, balances, baseTokenInfo, userAddress]);

  // Validate quote token amount on change
  useEffect(() => {
    setQuoteDepositError(null);
    if (!quoteDepositAmount.trim() || !userAddress) return;

    const amount = parseFloat(quoteDepositAmount);
    if (isNaN(amount) || amount <= 0) {
      setQuoteDepositError(
        `${quoteTokenInfo.symbol} amount must be greater than 0`
      );
      return;
    }

    const inputAmount = parseAmount(
      quoteDepositAmount,
      quoteTokenInfo.decimals
    );
    const userBalance = balances[quoteTokenInfo.address] || BigInt(0);

    if (inputAmount > userBalance) {
      const formattedBalance = formatTokenAmount(
        userBalance,
        quoteTokenInfo.decimals
      );
      setQuoteDepositError(
        `Insufficient balance. Available: ${formattedBalance} ${quoteTokenInfo.symbol}`
      );
    }
  }, [quoteDepositAmount, balances, quoteTokenInfo, userAddress]);

  // Validate ETH amount on change
  useEffect(() => {
    setEthDepositError(null);
    if (!ethDepositAmount.trim() || !userAddress) return;

    const amount = parseFloat(ethDepositAmount);
    if (isNaN(amount) || amount <= 0) {
      setEthDepositError('ETH amount must be greater than 0');
      return;
    }

    if (!ethBalance) return;

    const inputAmount = parseAmount(ethDepositAmount, 18);
    if (inputAmount > ethBalance.value) {
      const formattedBalance = formatTokenAmount(ethBalance.value, 18);
      setEthDepositError(
        `Insufficient balance. Available: ${formattedBalance} ETH`
      );
    }
  }, [ethDepositAmount, ethBalance, userAddress]);

  const handleTokenDeposit = async () => {
    if (!userAddress) return;

    if (baseDepositError || quoteDepositError) {
      return;
    }

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

    // Check for validation error
    if (ethDepositError) {
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
            {balances && baseTokenInfo && (
              <div className='text-xs text-slate-500 mt-1'>
                Your Balance:{' '}
                {formatTokenAmount(
                  balances[baseTokenInfo.address] || BigInt(0),
                  baseTokenInfo.decimals
                )}{' '}
                {baseTokenInfo.symbol}
              </div>
            )}
            {baseDepositError && (
              <p className='text-red-400 text-sm mt-1'>{baseDepositError}</p>
            )}
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
            {balances && quoteTokenInfo && (
              <div className='text-xs text-slate-500 mt-1'>
                Your Balance:{' '}
                {formatTokenAmount(
                  balances[quoteTokenInfo.address] || BigInt(0),
                  quoteTokenInfo.decimals
                )}{' '}
                {quoteTokenInfo.symbol}
              </div>
            )}
            {quoteDepositError && (
              <p className='text-red-400 text-sm mt-1'>{quoteDepositError}</p>
            )}
          </div>
        </div>

        <button
          onClick={handleTokenDeposit}
          disabled={
            isLoadingTokenDeposit ||
            (!baseDepositAmount && !quoteDepositAmount) ||
            !!baseDepositError ||
            !!quoteDepositError ||
            balancesLoading
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
            {ethBalance && (
              <div className='text-xs text-slate-500 mt-1'>
                Your Balance: {formatTokenAmount(ethBalance.value, 18)} ETH
              </div>
            )}
            {ethDepositError && (
              <p className='text-red-400 text-sm mt-1'>{ethDepositError}</p>
            )}
          </div>

          <button
            onClick={handleEthDeposit}
            disabled={
              isLoadingEthDeposit || !ethDepositAmount || !!ethDepositError
            }
            className='btn-secondary w-full mt-2 disabled:opacity-50'
          >
            {isLoadingEthDeposit ? 'Depositing...' : 'Deposit ETH'}
          </button>
        </div>
      </div>
    </div>
  );
}
