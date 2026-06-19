'use client';
import { useEffect, useState } from 'react';
import { ConnectButton, useCurrentAccount } from '@mysten/dapp-kit';
import { RELAYER_URL } from '../../../lib/veil';

export default function ClaimPage({ params }: { params: { token: string } }) {
  const account = useCurrentAccount();
  const [info, setInfo] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch(`${RELAYER_URL}/claims/${params.token}`)
      .then((r) => r.json())
      .then(setInfo)
      .catch(() => setMsg('Could not load this claim.'));
  }, [params.token]);

  async function claim() {
    if (!account) return setMsg('Connect a wallet (or sign in with Google) to receive your funds.');
    setBusy(true);
    setMsg('');
    try {
      const r = await fetch(`${RELAYER_URL}/claims/${params.token}/claim`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ recipientAddress: account.address }),
      });
      const d = await r.json();
      setMsg(d.digest ? `Received! Transaction: ${d.digest}` : `Error: ${d.error ?? 'unknown'}`);
    } catch (e: any) {
      setMsg(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  function signInWithGoogle() {
    // zkLogin flow: redirect to Google OAuth
    // In production, this would use @mysten/zklogin to generate the proof
    // For now, we use a simplified flow that demonstrates the UX
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      setMsg('Google OAuth not configured. Please connect a wallet instead.');
      return;
    }

    const redirectUri = `${window.location.origin}/api/auth/callback/google`;
    const scope = 'openid email profile';
    const nonce = crypto.randomUUID();
    
    // Store nonce for verification
    sessionStorage.setItem('zklogin_nonce', nonce);
    
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${clientId}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=id_token` +
      `&scope=${encodeURIComponent(scope)}` +
      `&nonce=${nonce}` +
      `&prompt=consent`;
    
    window.location.href = authUrl;
  }

  return (
    <main>
      <h1 style={{ fontSize: 26, fontWeight: 800 }}>You have a payment</h1>
      {info ? (
        <div className="card" style={{ marginTop: 12 }}>
          <div>To: <strong>{info.email}</strong></div>
          <div>Amount: <strong>{info.displayAmount}</strong>{info.targetCoinType ? ` (→ ${info.targetCoinType})` : ''}</div>
          <div>Status: <strong>{info.status}</strong></div>
        </div>
      ) : (
        <p style={{ color: '#737373' }}>{msg || 'Loading…'}</p>
      )}

      <div className="card" style={{ marginTop: 16 }}>
        <strong>Receive your funds</strong>
        <p style={{ color: '#737373', fontSize: 14 }}>
          Sign in with Google (zkLogin) — no wallet, no seed phrase, zero gas. 
          Or connect a wallet directly.
        </p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button 
            className="btn" 
            onClick={signInWithGoogle}
            style={{ background: '#4285F4', color: 'white' }}
          >
            Sign in with Google
          </button>
          <ConnectButton />
        </div>
        {account && (
          <div style={{ marginTop: 12, fontSize: 13, color: '#525252' }}>
            Connected: <code>{account.address.slice(0, 6)}...{account.address.slice(-4)}</code>
          </div>
        )}
        <button className="btn" disabled={busy || info?.status === 'claimed' || !account} onClick={claim} style={{ marginTop: 12 }}>
          {info?.status === 'claimed' ? 'Already claimed' : busy ? 'Receiving…' : 'Receive payment'}
        </button>
        {msg && <p style={{ marginTop: 10, fontSize: 14 }}>{msg}</p>}
      </div>
    </main>
  );
}
