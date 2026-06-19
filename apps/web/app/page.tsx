'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function Home() {
  const searchParams = useSearchParams();
  const [userInfo, setUserInfo] = useState<{ email: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const zklogin = searchParams.get('zklogin');
    const errorParam = searchParams.get('error');
    
    if (errorParam) {
      setError(`Authentication error: ${errorParam}`);
    }
    
    if (zklogin) {
      try {
        const decoded = JSON.parse(Buffer.from(zklogin, 'base64').toString());
        setUserInfo({ email: decoded.email, name: decoded.name });
      } catch (e) {
        console.error('Failed to decode zklogin token:', e);
      }
    }
  }, [searchParams]);

  return (
    <main>
      <h1 style={{ fontSize: 30, fontWeight: 800 }}>Veil</h1>
      <p style={{ color: '#525252', marginTop: 8 }}>
        Confidential global payroll on Sui — salary amounts stay private on-chain, recipients get paid in
        seconds with zero gas and no seed phrase.
      </p>
      
      {userInfo && (
        <div className="card" style={{ marginTop: 16, background: '#f0fdf4', border: '1px solid #86efac' }} role="status" aria-live="polite">
          <strong style={{ color: '#166534' }}>✓ Signed in with Google</strong>
          <div style={{ fontSize: 14, color: '#166534', marginTop: 4 }}>
            Welcome, {userInfo.name || userInfo.email}
          </div>
        </div>
      )}
      
      {error && (
        <div className="card" style={{ marginTop: 16, background: '#fef2f2', border: '1px solid #fca5a5' }} role="alert">
          <strong style={{ color: '#991b1b' }}>✗ {error}</strong>
        </div>
      )}
      
      <nav style={{ display: 'grid', gap: 16, marginTop: 24 }} aria-label="Main navigation">
        <Link className="card" href="/employer" aria-label="Go to employer console">
          <strong>Employer console →</strong>
          <div style={{ color: '#737373' }}>Create a payroll run, add recipients, execute a confidential batch payout.</div>
        </Link>
        <Link className="card" href="/audit" aria-label="Go to auditor dashboard">
          <strong>Auditor dashboard →</strong>
          <div style={{ color: '#737373' }}>Reconcile a run and export a report.</div>
        </Link>
        <div className="card" role="region" aria-label="Recipient claim information">
          <strong>Recipient claim</strong>
          <div style={{ color: '#737373' }}>Recipients open a personal claim link (e.g. /claim/&lt;token&gt;) from their email.</div>
        </div>
      </nav>
    </main>
  );
}
