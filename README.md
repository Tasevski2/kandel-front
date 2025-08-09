# Kandel Position Manager

A minimal functional dApp for managing Kandel positions on Mangrove Protocol.

## Prerequisites

1. Node.js 18+ and npm
2. MetaMask browser extension
3. Local Anvil chain running on port 8545

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

## Development

- `npm run dev` - Start development server
- `npm run build` - Build for production

## Notes

- Default deployment uses mock ERC20 tokens as BASE and QUOTE
- Provision is automatically calculated based on gas requirements
- Minimum volume (density) is enforced to prevent spam offers
