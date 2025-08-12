'use client';

import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type State, WagmiProvider } from 'wagmi';
import { config } from '@/config/wagmiConfig';

const queryClient = new QueryClient();

type Props = {
  children: ReactNode;
  wagmiInitialState: State | undefined;
};

export function Providers({ children, wagmiInitialState }: Props) {
  return (
    <WagmiProvider config={config} initialState={wagmiInitialState}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
