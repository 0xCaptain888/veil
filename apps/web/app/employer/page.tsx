'use client';
import { useState } from 'react';
import { ConnectButton, useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { buildExecuteRunTx, encodeManifest, idHash, randomSecret, type AuditEntry } from '@veil/sdk';
import { getCfg, RELAYER_URL } from '../../lib/veil';

type Row = { email: string; amount: string };
const toHex = (a: number[] | Uint8Array) => Array.from(a).map((b) => b.toString(16).padStart(2, '0')).join('');

export default function EmployerPage() {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const cfg = getCfg();

  const [employerObjectId, setEmployerObjectId] = useState('');
  const [adminCapId, setAdminCapId] = useState('');
  const [fundingCoinId, setFundingCoinId] = useState('');
  const [rows, setRows] = useState<Row[]>([
    { email: 'alice@example.com', amount: '1000' },
    { email: 'bob@example.com', amount: '2500' },
  ]);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [links, setLinks] = useState<{ email: string; url: string }[]>([]);
  const append = (s: string) => setLog((l) => [...l, s]);
  const enc = (s: string) => Array.from(new TextEncoder().encode(s));

  async function register() {
    if (!account) return append('Connect a wallet first.');
    setBusy(true);
    try {
      const tx = new Transaction();
      tx.moveCall({
        target: `${cfg.packageId}::payroll::register`,
        arguments: [tx.pure.vector('u8', enc('Acme Inc')), tx.pure.vector('u8', enc('demo-auditor-pubkey'))],
      });
      const { digest } = await signAndExecute({ transaction: tx });
      const res = await client.waitForTransaction({ digest, options: { showObjectChanges: true } });
      for (const ch of res.objectChanges ?? []) {
        if (ch.type === 'created' && 'objectType' in ch) {
          if (ch.objectType.endsWith('::payroll::Employer')) setEmployerObjectId(ch.objectId);
          if (ch.objectType.endsWith('::payroll::AdminCap')) setAdminCapId(ch.objectId);
        }
      }
      append(`Registered employer. tx: ${digest}`);
      append('Employer + AdminCap ids prefilled. Now paste a funding Coin object id (a SUI coin you own from the faucet).');
    } catch (e: any) {
      append(`Register failed: ${e?.message ?? e}`);
    } finally {
      setBusy(false);
    }
  }

  async function executeRun() {
    if (!account) return append('Connect a wallet first.');
    if (!employerObjectId || !adminCapId || !fundingCoinId) return append('Fill employer id, admin cap id, and funding coin id.');
    const valid = rows.filter((r) => r.email && r.amount);
    if (valid.length === 0) return append('Add at least one recipient.');
    setBusy(true);
    setLinks([]);
    try {
      const secrets = new Map<string, { email: string; secretBytes: Uint8Array; amount: string }>();
      const recipients = valid.map((r) => {
        const secret = randomSecret();
        const secretBytes = new TextEncoder().encode(secret);
        const h = idHash(secret);
        secrets.set(toHex(h), { email: r.email, secretBytes, amount: r.amount });
        return { email: r.email, amount: BigInt(r.amount), idHash: h };
      });
      const entries: AuditEntry[] = recipients.map((r) => ({ email: r.email, amount: r.amount.toString(), status: 'pending' as const }));
      const tx = buildExecuteRunTx({
        cfg,
        employerAddress: account.address,
        employerObjectId,
        adminCapId,
        fundingCoinId,
        recipients,
        manifestBlob: encodeManifest(entries),
      });
      const { digest } = await signAndExecute({ transaction: tx });
      const res = await client.waitForTransaction({ digest, options: { showEvents: true } });

      let runId = '';
      const payload: any[] = [];
      for (const ev of res.events ?? []) {
        if (ev.type.endsWith('::payroll::PayoutEscrowed')) {
          const pj: any = ev.parsedJson;
          runId = pj.run;
          const m = secrets.get(toHex(pj.recipient_id_hash as number[]));
          if (m) payload.push({ email: m.email, displayAmount: m.amount, escrowId: pj.escrow, secret: Array.from(m.secretBytes) });
        }
      }
      const r = await fetch(`${RELAYER_URL}/runs/register-tokens`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ runId, name: 'Payroll Run', recipients: payload }),
      });
      const data = await r.json();
      setLinks((data.links ?? []).map((x: any) => ({ email: x.email, url: x.url })));
      append(`Run executed (run ${runId}). tx: ${digest}. Share the claim links below. Run id for the auditor: ${runId}`);
    } catch (e: any) {
      append(`Execute failed: ${e?.message ?? e}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <a href="/" style={{ color: '#737373' }} aria-label="Go to home page">← home</a>
      <h1 style={{ fontSize: 26, fontWeight: 800, marginTop: 8 }}>Employer console</h1>
      <div style={{ margin: '12px 0' }}><ConnectButton /></div>

      <div className="card" style={{ marginBottom: 16 }}>
        <strong id="setup-heading">1. One-time setup</strong>
        <p style={{ color: '#737373', fontSize: 14 }} aria-describedby="setup-heading">Create your employer profile + capabilities, then paste a funding coin.</p>
        <button className="btn" disabled={busy} onClick={register} aria-label="Register employer on-chain">Register employer</button>
        <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
          <input className="input" placeholder="Employer object id (0x...)" value={employerObjectId} onChange={(e) => setEmployerObjectId(e.target.value)} aria-label="Employer object ID" />
          <input className="input" placeholder="AdminCap id (0x...)" value={adminCapId} onChange={(e) => setAdminCapId(e.target.value)} aria-label="AdminCap object ID" />
          <input className="input" placeholder="Funding Coin object id (0x... — a SUI coin you own)" value={fundingCoinId} onChange={(e) => setFundingCoinId(e.target.value)} aria-label="Funding coin object ID" />
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <strong id="recipients-heading">2. Recipients</strong>
        <div style={{ display: 'grid', gap: 8, marginTop: 8 }} role="list" aria-labelledby="recipients-heading">
          {rows.map((row, i) => (
            <div key={i} style={{ display: 'flex', gap: 8 }} role="listitem">
              <input className="input" placeholder="email" value={row.email} onChange={(e) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, email: e.target.value } : r)))} aria-label={`Recipient ${i + 1} email`} />
              <input className="input" placeholder="amount (base units)" value={row.amount} onChange={(e) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, amount: e.target.value } : r)))} style={{ maxWidth: 200 }} aria-label={`Recipient ${i + 1} amount`} />
              <button className="btn" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} style={{ background: '#ef4444' }} aria-label={`Remove recipient ${i + 1}`}>✕</button>
            </div>
          ))}
          <button className="btn" style={{ background: '#404040' }} onClick={() => setRows((rs) => [...rs, { email: '', amount: '' }])} aria-label="Add new recipient">+ add recipient</button>
        </div>
      </div>

      <button className="btn" disabled={busy} onClick={executeRun} aria-label="Execute confidential payout transaction">
        {busy ? 'Working…' : 'Execute confidential payout'}
      </button>

      {links.length > 0 && (
        <div className="card" style={{ marginTop: 16 }} role="region" aria-label="Claim links">
          <strong>Claim links</strong>
          {links.map((l) => (
            <div key={l.url} style={{ fontSize: 14, marginTop: 6 }}>
              {l.email}: <a href={l.url} aria-label={`Claim link for ${l.email}`}>{l.url}</a>
            </div>
          ))}
        </div>
      )}

      {log.length > 0 && (
        <pre style={{ marginTop: 16, background: '#111', color: '#0f0', padding: 12, borderRadius: 8, whiteSpace: 'pre-wrap', fontSize: 12 }} role="log" aria-label="Transaction log" aria-live="polite">{log.join('\n')}</pre>
      )}
    </main>
  );
}
