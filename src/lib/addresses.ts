import { getContracts, getDeployment } from './deployment-loader';

// Get contracts from deployment configuration
const contracts = getContracts();

export const ADDRESSES = {
  mangrove: contracts.mangrove,
  mgvReader: contracts.mgvReader,
  kandelSeeder: contracts.kandelSeeder,
} as const;

// Get chain ID from deployment
export const CHAIN_ID = getDeployment().chainId;