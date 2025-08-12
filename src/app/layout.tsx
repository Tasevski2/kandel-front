import { type ReactNode } from 'react';
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { cookieToInitialState } from 'wagmi';
import { headers } from 'next/headers';
import { config } from '@/config/wagmiConfig';
import { Providers } from './providers';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Kandel Position Manager',
  description: 'Manage Kandel positions on Mangrove',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const wagmiInitialState = cookieToInitialState(
    config,
    (await headers()).get('cookie')
  );

  return (
    <html lang='en'>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning={true}
      >
        <Providers wagmiInitialState={wagmiInitialState}>{children}</Providers>
      </body>
    </html>
  );
}
