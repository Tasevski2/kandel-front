import { getContracts, getDeployment } from './deployment-loader';

const contracts = getContracts();

export const ADDRESSES = {
  mangrove: contracts.mangrove,
  mgvReader: contracts.mgvReader,
  kandelSeeder: contracts.kandelSeeder,
} as const;

export const CHAIN_ID = getDeployment().chainId;