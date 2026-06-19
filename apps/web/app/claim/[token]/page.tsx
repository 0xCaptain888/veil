'use client';
import { useEffect, useState } from 'react';
import { ConnectButton, useCurrentAccount } from '@mysten/dapp-kit';
import { RELAYER_URL, formatAmount, coinTypeLabel } from '../../../lib/veil';

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
      const buildBody: any = { recipientAddress: account.address };
      if (targetCurrency) {
        buildBody.targetCoinType = targetCurrency;
      }

      // Try the sponsored transaction flow first (production path)
      // Step 1: Build the transaction
      const buildRes = await fetch(`${RELAYER_URL}/claims/${params.token}/build`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(buildBody),
      });

      if (buildRes.ok) {
        const buildData = await buildRes.json();
        const { txBytes } = buildData;

        if (txBytes) {
          try {
            // Step 2: Sign with wallet (in production: zkLogin)
            const { Transaction } = await import('@mysten/sui/transactions');
            const tx = Transaction.from(txBytes);

            // Use wallet's signTransaction to get the signature
            // @ts-ignore - signTransaction may not be in all wallet types
            if (account.signTransaction) {
              // @ts-ignore
              const signed = await account.signTransaction({ transaction: tx });
              
              // Step 3: Submit as sponsored transaction
              const sponsoredRes = await fetch(`${RELAYER_URL}/claims/${params.token}/execute-sponsored`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                  txBytes: signed.bytes,
                  signature: signed.signature,
                }),
              });

              if (sponsoredRes.ok) {
                const d = await sponsoredRes.json();
                if (d.digest) {
                  const swapLabel = targetCurrency ? ` (swapped to ${coinTypeLabel(targetCurrency)})` : '';
                  setMsg(`Received! Transaction: ${d.digest}${swapLabel}`);
                  setInfo({ ...info, status: 'claimed' });
                  setBusy(false);
                  return;
                }
              }
            }
          } catch (signErr) {
            // Fall through to simple claim flow
            console.log('Sponsored flow failed, falling back to simple claim:', signErr);
          }
        }
      }

      // Fallback: simple claim flow (relayer executes on behalf of recipient)
      const claimRes = await fetch(`${RELAYER_URL}/claims/${params.token}/claim`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(buildBody),
      });

      const d = await claimRes.json();
      if (d.digest) {
        const swapLabel = targetCurrency ? ` (swapped to ${coinTypeLabel(targetCurrency)})` : '';
        setMsg(`Received! Transaction: ${d.digest}${swapLabel}`);
        setInfo({ ...info, status: 'claimed' });
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
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      setMsg('Google OAuth not configured. Please connect a wallet instead.');
      return;
    }

    const redirectUri = `${window.location.origin}/api/auth/callback/google`;
    const scope = 'openid email profile';
    const nonce = crypto.randomUUID();

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

  // Format the display amount with locale-aware formatting
  const displayAmountFormatted = info?.displayAmount
    ? formatAmount(info.displayAmount, 9, coinTypeLabel(info.targetCoinType))
    : '';

  return (
    <main>
      <h1 style={{ fontSize: 26, fontWeight: 800 }}>You have a payment</h1>
      {info ? (
        <div className="card" style={{ marginTop: 12 }}>
          <div>To: <strong>{info.email}</strong></div>
          <div>
            Amount: <strong>{displayAmountFormatted || info.displayAmount}</strong>
            {targetCurrency && info.targetCoinType !== targetCurrency
              ? ` → ${coinTypeLabel(targetCurrency)}`
              : info.targetCoinType
                ? ` (${coinTypeLabel(info.targetCoinType)})`
                : ''}
          </div>
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
            aria-label="Sign in with Google"
          >
            Sign in with Google
          </button>
          <ConnectButton />
        </div>
        {account && (
          <div style={{ marginTop: 12, fontSize: 13, color: '#525252' }} role="status" aria-live="polite">
            Connected: <code>{account.address.slice(0, 6)}...{account.address.slice(-4)}</code>
          </div>
        )}

        {/* DeepBook currency selector */}
        <div style={{ marginTop: 16 }}>
          <label htmlFor="currency-select" style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
            Receive in currency (optional)
          </label>
          <select
            id="currency-select"
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
            aria-describedby="currency-help"
          >
            {currencies.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <p id="currency-help" style={{ fontSize: 12, color: '#737373', marginTop: 4 }}>
            {targetCurrency
              ? `Your payment will be automatically swapped via DeepBook V3 at claim time. Slippage protection is enabled.`
              : 'Default: receive in SUI. You can choose a different currency.'}
          </p>
        </div>

        <button
          className="btn"
          disabled={busy || info?.status === 'claimed' || !account}
          onClick={claim}
          style={{ marginTop: 12 }}
          aria-label={info?.status === 'claimed' ? 'Already claimed' : 'Receive payment'}
        >
          {info?.status === 'claimed' ? 'Already claimed' : busy ? 'Receiving…' : 'Receive payment'}
        </button>
        {msg && <p style={{ marginTop: 10, fontSize: 14 }} role="alert">{msg}</p>}
      </div>
    </main>
  );
}
