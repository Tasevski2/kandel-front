import { Address } from 'viem';
import { isDevelopment } from '../config/networks';
import anvilDeployment from './deployments/anvil.json';
import baseDeployment from './deployments/base.json';

export interface DeploymentConfig {
  chainId: number;
  chainName: string;
  contracts: {
    mangrove: Address;
    mgvReader: Address;
    kandelSeeder: Address;
  };
}

let cachedDeployment: DeploymentConfig | null = null;

/**
 * Get the deployment configuration for the current environment
 */
export function getDeployment(): DeploymentConfig {
  if (cachedDeployment) {
    return cachedDeployment;
  }

  const deployment = isDevelopment() ? anvilDeployment : baseDeployment;

  cachedDeployment = {
    chainId: deployment.chainId,
    chainName: deployment.chainName,
    contracts: {
      mangrove: deployment.contracts.mangrove as Address,
      mgvReader: deployment.contracts.mgvReader as Address,
      kandelSeeder: deployment.contracts.kandelSeeder as Address,
    },
  };

  return cachedDeployment;
}

/**
 * Get contract addresses for the current environment
 */
export function getContracts() {
  const deployment = getDeployment();
  return deployment.contracts;
}
