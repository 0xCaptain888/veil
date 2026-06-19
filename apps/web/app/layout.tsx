import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'Veil — Confidential Payroll on Sui',
  description: 'Private salary amounts on-chain. Email login. Zero gas. Instant FX.',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=5',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a href="#main-content" className="skip-link" style={{
          position: 'absolute',
          left: '-9999px',
          top: 'auto',
          width: '1px',
          height: '1px',
          overflow: 'hidden',
        }}>
          Skip to main content
        </a>
        <Providers>
          <div id="main-content" style={{ maxWidth: 880, margin: '0 auto', padding: '32px 20px' }} tabIndex={-1}>
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
