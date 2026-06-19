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
    if (!account) return setMsg('Connect a wallet (or sign in) to receive your funds.');
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
          In production you sign in with Google (zkLogin) — no wallet, no seed phrase, zero gas. For this demo,
          connect a wallet to provide a receiving address (the relayer pays gas).
        </p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn" disabled style={{ background: '#a3a3a3' }} title="Coming in W3">Sign in with Google (zkLogin) — W3</button>
          <ConnectButton />
        </div>
        <button className="btn" disabled={busy || info?.status === 'claimed'} onClick={claim} style={{ marginTop: 12 }}>
          {info?.status === 'claimed' ? 'Already claimed' : busy ? 'Receiving…' : 'Receive payment'}
        </button>
        {msg && <p style={{ marginTop: 10, fontSize: 14 }}>{msg}</p>}
      </div>
    </main>
  );
}
