'use client';
import { useState } from 'react';
import { RELAYER_URL } from '../../lib/veil';

export default function AuditPage() {
  const [runId, setRunId] = useState('');
  const [data, setData] = useState<any>(null);
  const [msg, setMsg] = useState('');

  async function load() {
    setMsg('');
    setData(null);
    try {
      const r = await fetch(`${RELAYER_URL}/audit/runs/${runId}`);
      const d = await r.json();
      if (d.entries) setData(d);
      else setMsg(d.error ?? 'not found');
    } catch (e: any) {
      setMsg(String(e?.message ?? e));
    }
  }

  function exportCsv() {
    if (!data) return;
    const rows: string[][] = [['email', 'amount', 'target', 'status'], ...data.entries.map((e: any) => [e.email, e.amount, e.targetCoinType ?? '', e.status])];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `veil-${data.runId}.csv`;
    a.click();
  }

  return (
    <main>
      <a href="/" style={{ color: '#737373' }}>← home</a>
      <h1 style={{ fontSize: 26, fontWeight: 800, marginTop: 8 }}>Auditor dashboard</h1>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <input className="input" placeholder="Run id (0x...)" value={runId} onChange={(e) => setRunId(e.target.value)} />
        <button className="btn" onClick={load}>Load</button>
      </div>
      {msg && <p style={{ color: '#737373', marginTop: 10 }}>{msg}</p>}
      {data && (
        <div className="card" style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong>{data.name}</strong>
            <button className="btn" onClick={exportCsv} style={{ background: '#404040' }}>Export CSV</button>
          </div>
          <table style={{ width: '100%', marginTop: 12, borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #e5e5e5' }}>
                <th>Email</th><th>Amount</th><th>Target</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.entries.map((e: any, i: number) => (
                <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td>{e.email}</td><td>{e.amount}</td><td>{e.targetCoinType ?? '—'}</td><td>{e.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
