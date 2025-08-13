'use client';

import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type State, WagmiProvider } from 'wagmi';
import { config } from '@/config/wagmiConfig';
import { ToastContainer } from 'react-toastify/unstyled';
import 'react-toastify/ReactToastify.css';

const queryClient = new QueryClient();

type Props = {
  children: ReactNode;
  wagmiInitialState: State | undefined;
};

export function Providers({ children, wagmiInitialState }: Props) {
  return (
    <WagmiProvider config={config} initialState={wagmiInitialState}>
      <QueryClientProvider client={queryClient}>
        {children}
        <ToastContainer
          position='top-right'
          autoClose={3000}
          closeButton={false}
          newestOnTop
          rtl={false}
          draggable
          pauseOnHover
          pauseOnFocusLoss={false}
          theme='dark'
          toastStyle={{
            backgroundColor: '#1e293b', // slate-800
            color: '#e2e8f0', // slate-200
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        />
      </QueryClientProvider>
    </WagmiProvider>
  );
}
