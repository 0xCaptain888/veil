'use client';
import { useEffect, useState } from 'react';
import { ConnectButton, useCurrentAccount } from '@mysten/dapp-kit';
import { RELAYER_URL, formatAmount, coinTypeLabel } from '../../../lib/veil';
import { useTranslation, SUPPORTED_LOCALES, type Locale } from '../../../lib/i18n';

export default function ClaimPage({ params }: { params: { token: string } }) {
  const account = useCurrentAccount();
  const { t, locale: detectedLocale } = useTranslation();
  const [locale, setLocale] = useState<Locale>(detectedLocale);
  const [info, setInfo] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [targetCurrency, setTargetCurrency] = useState('');

  // Re-import translations when locale changes
  const { t: tr } = (() => {
    const { getTranslations } = require('../../../lib/i18n');
    return { t: getTranslations(locale) };
  })();

  // Available currencies for DeepBook swap
  const currencies = [
    { value: '', label: tr('claim.currency.default') },
    { value: '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC', label: 'USDC' },
    { value: '0xc060006111016b8a020ad5b33834984a437aaa7d3c74c18e09a95d48aceab08c::coin::COIN', label: 'WUSDT' },
    { value: '0xdeeb7a4662eec9f2f3def03fb937a663dddaa2e215b8078a284d026b7946c270::deep::DEEP', label: 'DEEP' },
  ];

  useEffect(() => {
    fetch(`${RELAYER_URL}/claims/${params.token}`)
      .then((r) => r.json())
      .then(setInfo)
      .catch(() => setMsg(tr('claim.loadError')));
  }, [params.token]);

  async function claim() {
    if (!account) return setMsg(tr('claim.error.wallet'));
    setBusy(true);
    setMsg('');
    try {
      const buildBody: any = { recipientAddress: account.address };
      if (targetCurrency) {
        buildBody.targetCoinType = targetCurrency;
      }

      // Try the sponsored transaction flow first (production path)
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
            const { Transaction } = await import('@mysten/sui/transactions');
            const tx = Transaction.from(txBytes);

            // @ts-ignore - signTransaction may not be in all wallet types
            if (account.signTransaction) {
              // @ts-ignore
              const signed = await account.signTransaction({ transaction: tx });
              
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
                  const swapLabel = targetCurrency ? ` (${tr('claim.swapped')} ${coinTypeLabel(targetCurrency)})` : '';
                  setMsg(`${tr('claim.success')} Transaction: ${d.digest}${swapLabel}`);
                  setInfo({ ...info, status: 'claimed' });
                  setBusy(false);
                  return;
                }
              }
            }
          } catch (signErr) {
            console.log('Sponsored flow failed, falling back to simple claim:', signErr);
          }
        }
      }

      // Fallback: simple claim flow
      const claimRes = await fetch(`${RELAYER_URL}/claims/${params.token}/claim`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(buildBody),
      });

      const d = await claimRes.json();
      if (d.digest) {
        const swapLabel = targetCurrency ? ` (${tr('claim.swapped')} ${coinTypeLabel(targetCurrency)})` : '';
        setMsg(`${tr('claim.success')} Transaction: ${d.digest}${swapLabel}`);
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
      setMsg(tr('claim.error.oauth'));
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

  const displayAmountFormatted = info?.displayAmount
    ? formatAmount(info.displayAmount, 9, coinTypeLabel(info.targetCoinType))
    : '';

  return (
    <main>
      {/* Language selector */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <select
          value={locale}
          onChange={(e) => setLocale(e.target.value as Locale)}
          style={{
            padding: '4px 8px',
            fontSize: 13,
            border: '1px solid #e5e5e5',
            borderRadius: 4,
            backgroundColor: 'white',
            cursor: 'pointer',
          }}
          aria-label="Select language"
        >
          {SUPPORTED_LOCALES.map((l) => (
            <option key={l.value} value={l.value}>{l.label}</option>
          ))}
        </select>
      </div>

      <h1 style={{ fontSize: 26, fontWeight: 800 }}>{tr('claim.title')}</h1>
      {info ? (
        <div className="card" style={{ marginTop: 12 }}>
          <div>{tr('claim.to')}: <strong>{info.email}</strong></div>
          <div>
            {tr('claim.amount')}: <strong>{displayAmountFormatted || info.displayAmount}</strong>
            {targetCurrency && info.targetCoinType !== targetCurrency
              ? ` → ${coinTypeLabel(targetCurrency)}`
              : info.targetCoinType
                ? ` (${coinTypeLabel(info.targetCoinType)})`
                : ''}
          </div>
          <div>{tr('claim.status')}: <strong>{info.status}</strong></div>
        </div>
      ) : (
        <p style={{ color: '#737373' }}>{msg || tr('claim.loading')}</p>
      )}

      <div className="card" style={{ marginTop: 16 }}>
        <strong>{tr('claim.receive.title')}</strong>
        <p style={{ color: '#737373', fontSize: 14 }}>
          {tr('claim.receive.description')}
        </p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            className="btn"
            onClick={signInWithGoogle}
            style={{ background: '#4285F4', color: 'white' }}
            aria-label={tr('claim.receive.google')}
          >
            {tr('claim.receive.google')}
          </button>
          <ConnectButton />
        </div>
        {account && (
          <div style={{ marginTop: 12, fontSize: 13, color: '#525252' }} role="status" aria-live="polite">
            {tr('claim.receive.connected')}: <code>{account.address.slice(0, 6)}...{account.address.slice(-4)}</code>
          </div>
        )}

        {/* DeepBook currency selector */}
        <div style={{ marginTop: 16 }}>
          <label htmlFor="currency-select" style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
            {tr('claim.currency.label')}
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
              ? tr('claim.currency.help.selected')
              : tr('claim.currency.help.default')}
          </p>
        </div>

        <button
          className="btn"
          disabled={busy || info?.status === 'claimed' || !account}
          onClick={claim}
          style={{ marginTop: 12 }}
          aria-label={info?.status === 'claimed' ? tr('claim.claimed') : tr('claim.receive.btn')}
        >
          {info?.status === 'claimed' ? tr('claim.claimed') : busy ? tr('claim.receiving') : tr('claim.receive.btn')}
        </button>
        {msg && <p style={{ marginTop: 10, fontSize: 14 }} role="alert">{msg}</p>}
      </div>
    </main>
  );
}
