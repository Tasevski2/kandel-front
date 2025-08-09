import { isDevelopment } from '../config/networks';
import anvilDeployment from './deployments/anvil.json';
import baseDeployment from './deployments/base.json';

export interface DeploymentConfig {
  chainId: number;
  chainName: string;
  contracts: {
    mangrove: `0x${string}`;
    mgvReader: `0x${string}`;
    kandelSeeder: `0x${string}`;
  };
}

// Cache for deployment config
let cachedDeployment: DeploymentConfig | null = null;

/**
 * Get the deployment configuration for the current environment
 */
export function getDeployment(): DeploymentConfig {
  if (cachedDeployment) {
    return cachedDeployment;
  }

  const deployment = isDevelopment() ? anvilDeployment : baseDeployment;
  
  // Validate and type-cast the deployment
  cachedDeployment = {
    chainId: deployment.chainId,
    chainName: deployment.chainName,
    contracts: {
      mangrove: deployment.contracts.mangrove as `0x${string}`,
      mgvReader: deployment.contracts.mgvReader as `0x${string}`,
      kandelSeeder: deployment.contracts.kandelSeeder as `0x${string}`,
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

/**
 * Clear the cached deployment (useful for testing or environment changes)
 */
export function clearDeploymentCache() {
  cachedDeployment = null;
}