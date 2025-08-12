import {
  cookieStorage,
  createConfig,
  createStorage,
  fallback,
  http,
} from 'wagmi';
import { base, anvil } from 'viem/chains';
import { metaMask } from 'wagmi/connectors';
import { getActiveNetwork } from '../config/networks';

const activeNetwork = getActiveNetwork();

const transports = activeNetwork.rpcUrls.default.http
  .filter((url) => url.trim())
  .map((url) => http(url, { timeout: 5_000, retryCount: 2 }));

export const config = createConfig({
  chains: [activeNetwork],
  ssr: true,
  storage: createStorage({
    storage: cookieStorage,
  }),
  connectors: [metaMask()],
  transports: {
    [base.id]: fallback(transports),
    [anvil.id]: fallback(transports),
  },
});
