import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'Veil — Confidential Payroll on Sui',
  description: 'Private salary amounts on-chain. Email login. Zero gas. Instant FX.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <div style={{ maxWidth: 880, margin: '0 auto', padding: '32px 20px' }}>{children}</div>
        </Providers>
      </body>
    </html>
  );
}
