# Kandel Frontend

## Introduction

This project is a web interface for managing Kandel automated market making strategy on the Mangrove DEX protocol. Kandel enables users to deploy geometric liquidity distributions that capture spreads through algorithmic market making, providing automated trading strategies that adapt to market conditions.

The application interfaces directly with Mangrove's smart contracts to manage provisions, deposit funds, create and edit Kandel strategy.

**Technology Stack:**

- **Frontend Framework:** Next.js 15 with React 19 and TypeScript
- **Web3 Integration:** Wagmi v2 and Viem for Ethereum interactions and wallet connectivity
- **State Management:** TanStack Query for state management and caching
- **Styling:** Tailwind CSS v4 for responsive, utility-first styling
- **Notifications:** React Toastify for transaction feedback and user notifications

## Features

✅ **MetaMask Wallet Connection**
✅ **Market Selection & Discovery**
✅ **Create Kandel Strategy**
✅ **Edit Existing Kandel With Immediate Effects**
✅ **Edit Existing Kandel Params (gasreq, stepSize)**
✅ **Order Book Display**
✅ **Inventory Management**
✅ **Deposit Funds**  
✅ **Withdraw Tokens**
✅ **Provision Management**
✅ **Free ETH Withdrawal**
✅ **Retract All Kandel Offers**
✅ **Retractl All Kandel Offers & Withdraw All Funds**
✅ **Live Offer Tracking**
✅ **Strategy Parameters Display**  
✅ **Provision Status Monitoring**

## Pages

**`/` (Home Page)** - Displays market selection dropdown and order book for the selected market. Features a Kandel dropdown of the users created Kandel strategies.

**`/kandel/new`** - Dedicated strategy creation flow with market selection and parameter configuration.

**`/kandel/[address]`** - Comprehensive position management dashboard for existing Kandel strategy. Provides editing capabilities, fund management, provision control, and detailed display of the Kandel strategy configurations.

## Hooks

### Kandel Strategy Hooks

**Mutations:**

- `useDepositFunds` - Deposits base and quote tokens into a Kandel's inventory
- `useKandelSeeder` - Creates new Kandel instances with initial
- `usePopulateFromOffset` - Populates or repopulates offers in a Kandel strategy with given parameters
- `useRetractAll` - Retracts all active offers from a Kandel and optionally recovers provisions
- `useRetractAndWithdrawAll` - Complete shutdown operation that retracts offers and withdraws all funds
- `useSetGasReq` - Updates the gas requirement parameter
- `useSetStepSize` - Updates the step size parameter
- `useWithdrawToken` - Withdraws specified amounts of base or quote tokens (currently withdraws all deposited tokens)

**Queries:**

- `useGetBaseQuoteTickIndex0` - Retrieves the central tick
- `useGetBaseQuoteTickOffset` - Gets the tick offset between price levels
- `useGetKandelInfo` - Fetches comprehensive all Kandel's data data and combines it in one object
- `useGetKandelParams` - Retrieves Kandel's strategy parameters
- `useGetKandelStaticParams` - Gets immutable Kandel's parameters set at deployment
- `useGetKandelsOfferedVolumes` - Calculates total offered volumes for asks and bids
- `useGetReserveBalances` - Fetches current base and quote token balances in Kandel's reserves

**Management:**

- `useKandels` - Local storage management for user's Kandel strategies

### Mangrove Protocol Hooks

**Mutations:**

- `useFundMaker` - Deposits ETH into Mangrove to increase maker's provision balance
- `useWithdrawEth` - Withdraws free ETH provisions from Mangrove maker balance

**Queries:**

- `useGetLocalConfigs` - Retrieves market-specific configuration parameters from Mangrove
- `useGetMakerFreeBalance` - Gets the maker's free (unlocked) provision balance in Mangrove
- `useGetMarkets` - Fetches all available markets with token information
- `useGetNumOfOpenMarkets` - Returns count of currently active trading markets
- `useGetOffers` - Retrieves offers from one side (asks or bids) for a given base/quote pair via reader contract
- `useGetOrderBook` - Combines ask and bid offers to provide complete order book data
- `useProvision` - Calculates provision requirements for offers

### Token & Infrastructure Hooks

- `useErc20Approve` - Handles ERC20 token approvals for contract interactions
- `useTokensInfo` - Fetches tokens metadata (symbol, name, decimals) for given addresses
- `useGetTokensBalances` - Fetches balances for multiple tokens
- `useChain` - Provides current blockchain network information and utilities
- `useInvalidateQueries` - Manages cache invalidation after successful mutations
- `useTxToast` - Displays transaction status notifications with loading/success/error states

## Technical Understanding

### Mangrove Core Engine

**Order Book Architecture:** Mangrove operates as a hybrid order book where offers can be either simple promises (EOA-backed) or smart offers (contract-backed). Smart offers execute custom logic during the market making process, enabling reactive liquidity and complex trading strategies.

**Provision System:** Each offer requires native token provisions held by Mangrove (not by individual maker contracts). These provisions serve as bounties to compensate takers and cleaning bots when offers fail during execution. The provision amount is calculated using the formula: `max(gaspricemgv, gaspriceofr) × (gasreq + gasbasemgv) × 10^6`, where gasreq represents the gas units required for offer execution and gasbasemgv is the market's base gas cost.

**Maker Balance Management:** Makers maintain ETH balances within Mangrove that exist in two states: locked provisions (reserved against active offers) and free provisions (available for new offers or withdrawal). When offers are posted, the required provision becomes locked; when offers are taken or retracted, the provision returns to the free state.

### Kandel Strategy Mechanics

**Geometric Distribution:** Kandel deploys offers across a geometric price distribution, creating a grid of buy and sell orders at exponentially spaced price levels. The distribution is defined by parameters including the number of levels per side, step size (affecting price spacing), and the overall price range.

**Liquidity Movement & Spread Capture:** As prices move and offers are taken, the strategy earns the **bid–ask spread** on fills and rebalances inventory around mid. This is different from passive holding because returns come from executed spread, not protocol swap fees.

**Provision Management:** Unlike automated market makers, Kandel requires manual provision management. When (re)populating offers (due to parameter changes or structural edits), users must ensure sufficient free provisions are available either by pre-funding via `Mangrove.fund()` or by attaching ETH value to populate transactions.

### APR Calculation Proposal (simple, quote-denominated)

**Token-Based Spread Tracking Methodology:**

To calculate an indicative APR for a Kandel position based on generated spread in terms of tokens rather than USD values, I propose the following approach:

**Inventory Change Analysis:** Track the evolution of the position's token inventory over time, measuring how the ratio of base to quote tokens changes as the strategy executes trades. The key insight is that successful market making should accumulate tokens through spread capture, regardless of price movements in external markets.

**Spread Earnings Calculation:**

1. **Baseline Calculation:** Establish the initial token inventory (B₀ base tokens, Q₀ quote tokens) and their ratio (R₀ = B₀/Q₀)
2. **Performance Tracking:** At time intervals, measure current inventory (Bₜ, Qₜ) and calculate the effective token accumulation
3. **Spread Attribution:** Compare the current token values against a "hodl" baseline to isolate earnings from spread capture versus price appreciation

**Return Methodology:**
The APR would be calculated as: `APR = ((Total_Token_Value_t / Initial_Token_Value_0) - 1) * (365/days_elapsed) * 100`, where token values are measured in terms of the quote token to normalize for price movements. Also, we need to factor in gas costs and provision requirements to provide net returns, giving users a comprehensive view of strategy profitability in token terms rather than relying on potentially volatile USD conversions.
