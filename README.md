# Kandel Position Manager

A minimal functional dApp for managing Kandel positions on Mangrove Protocol.

## Prerequisites

1. Node.js 18+ and npm
2. MetaMask browser extension
3. Local Anvil chain running on port 8545

## Setup Instructions

1. **Start Anvil and deploy contracts** (in the parent directory):
   ```bash
   # Install Bun if not already installed
   curl -fsSL https://bun.sh/install | bash

   # In the parent directory (mangrove-local-main)
   cd ..
   bun install
   bun run src/index.ts
   ```

2. **Update contract addresses**:
   After running the deployment script, copy the printed addresses to `src/lib/deployments.local.json`

3. **Install dependencies**:
   ```bash
   npm install
   ```

4. **Start the development server**:
   ```bash
   npm run dev
   ```

5. **Configure MetaMask**:
   - Add custom network:
     - Network Name: Anvil
     - RPC URL: http://127.0.0.1:8545
     - Chain ID: 31337
     - Currency Symbol: ETH
   - Import one of the Anvil test accounts using private keys

## Features

- ✅ MetaMask wallet connection
- ✅ Two-column order book display (Bids/Asks)
- ✅ Create new Kandel positions
- ✅ View and manage existing positions
- ✅ Edit position parameters
- ✅ Retract offers and withdraw funds
- ✅ Provision calculation and validation
- ✅ Density enforcement
- ✅ Dark theme UI inspired by Mangrove Exchange

## Architecture

See `README_REPORT.md` for detailed architecture overview and APR calculation proposal.

## Development

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint

## Notes

- Default deployment uses mock ERC20 tokens as BASE and QUOTE
- Provision is automatically calculated based on gas requirements
- Minimum volume (density) is enforced to prevent spam offers