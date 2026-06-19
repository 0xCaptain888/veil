'use client';
import { useEffect, useState } from 'react';
import { ConnectButton, useCurrentAccount } from '@mysten/dapp-kit';
import { RELAYER_URL } from '../../../lib/veil';

export default function ClaimPage({ params }: { params: { token: string } }) {
  const account = useCurrentAccount();
  const [info, setInfo] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [targetCurrency, setTargetCurrency] = useState('');

  // Available currencies for DeepBook swap
  const currencies = [
    { value: '', label: 'SUI (default)' },
    { value: '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC', label: 'USDC' },
    { value: '0xc060006111016b8a020ad5b33834984a437aaa7d3c74c18e09a95d48aceab08c::coin::COIN', label: 'WUSDT' },
    { value: '0xdeeb7a4662eec9f2f3def03fb937a663dddaa2e215b8078a284d026b7946c270::deep::DEEP', label: 'DEEP' },
  ];

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
      // Step 1: Build the transaction
      const buildBody: any = { recipientAddress: account.address };
      if (targetCurrency) {
        buildBody.targetCoinType = targetCurrency;
      }
      
      const buildRes = await fetch(`${RELAYER_URL}/claims/${params.token}/build`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(buildBody),
      });
      
      if (!buildRes.ok) {
        const err = await buildRes.json();
        throw new Error(err.error || 'Failed to build transaction');
      }
      
      const buildData = await buildRes.json();
      const { txBytes } = buildData;
      
      // Step 2: Sign the transaction with the wallet
      // In production with zkLogin, this would use the zkLogin proof
      // For now, we use the wallet's signAndExecuteTransaction
      const { Transaction } = await import('@mysten/sui/transactions');
      const tx = Transaction.from(txBytes);
      
      // Use the wallet to sign and execute (demo mode - relayer will sponsor)
      const { signAndExecuteTransaction } = await import('@mysten/dapp-kit');
      
      // For now, fall back to the simple claim flow (relayer executes)
      // TODO: Implement proper sponsored transaction flow with wallet signing
      const claimRes = await fetch(`${RELAYER_URL}/claims/${params.token}/claim`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(buildBody),
      });
      
      const d = await claimRes.json();
      if (d.digest) {
        const swapMsg = d.swapped ? ` (swapped to ${d.targetCoinType?.split('::').pop() || 'target currency'})` : '';
        setMsg(`Received! Transaction: ${d.digest}${swapMsg}`);
      } else {
        setMsg(`Error: ${d.error ?? 'unknown'}`);
      }
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
        
        {/* DeepBook currency selector */}
        <div style={{ marginTop: 16 }}>
          <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
            Receive in currency (optional)
          </label>
          <select
            value={targetCurrency}
            onChange={(e) => setTargetCurrency(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              fontSize: 14,
              border: '1px solid #e5e5e5',
              borderRadius: 6,
              backgroundColor: 'white',
              cursor: 'pointer',
            }}
          >
            {currencies.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          {targetCurrency && (
            <p style={{ fontSize: 12, color: '#737373', marginTop: 4 }}>
              Your payment will be automatically swapped via DeepBook V3 at claim time.
            </p>
          )}
        </div>

        <button className="btn" disabled={busy || info?.status === 'claimed' || !account} onClick={claim} style={{ marginTop: 12 }}>
          {info?.status === 'claimed' ? 'Already claimed' : busy ? 'Receiving…' : 'Receive payment'}
        </button>
        {msg && <p style={{ marginTop: 10, fontSize: 14 }}>{msg}</p>}
      </div>
    </main>
  );
}
