import { createConfig, http } from 'wagmi';
import { metaMask } from 'wagmi/connectors';
import { getActiveNetwork } from '../config/networks';

// Get the active network based on environment
const activeNetwork = getActiveNetwork();

export const config = createConfig({
  chains: [activeNetwork],
  connectors: [metaMask()],
  transports: {
    [activeNetwork.id]: http(activeNetwork.rpcUrls.default.http[0]),
  },
});

// Export the active network for backward compatibility
export const anvil = activeNetwork;
