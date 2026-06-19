'use client';
import { useState } from 'react';
import { RELAYER_URL, formatAmount, coinTypeLabel } from '../../lib/veil';

export default function AuditPage() {
  const [runId, setRunId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [data, setData] = useState<any>(null);
  const [msg, setMsg] = useState('');
  const [accessLogs, setAccessLogs] = useState<any[]>([]);

  async function load() {
    setMsg('');
    setData(null);
    setAccessLogs([]);
    try {
      const headers: Record<string, string> = {};
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }
      const r = await fetch(`${RELAYER_URL}/audit/runs/${runId}`, { headers });
      const d = await r.json();
      if (d.entries) {
        setData(d);
        // Also fetch access logs for this run
        try {
          const logRes = await fetch(`${RELAYER_URL}/audit/access-logs`, { headers });
          const logData = await logRes.json();
          if (logData.logs) {
            setAccessLogs(logData.logs.filter((l: any) => l.runId === runId));
          }
        } catch {
          // Access logs are optional
        }
      } else if (d.error === 'Invalid API key' || d.error?.includes('API key')) {
        setMsg('Authentication failed. Please check your API key.');
      } else {
        setMsg(d.error ?? 'not found');
      }
    } catch (e: any) {
      setMsg(String(e?.message ?? e));
    }
  }

  function exportCsv() {
    if (!data) return;
    const rows: string[][] = [
      ['email', 'amount', 'target', 'status'],
      ...data.entries.map((e: any) => [
        e.email,
        e.amount,
        coinTypeLabel(e.targetCoinType),
        e.status,
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `veil-${data.runId}.csv`;
    a.click();
  }

  function exportAccessLogsCsv() {
    if (!accessLogs.length) return;
    const rows: string[][] = [
      ['timestamp', 'ip', 'endpoint', 'status'],
      ...accessLogs.map((l: any) => [l.isoTime, l.ip, l.endpoint, String(l.status)]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `veil-audit-access-${data?.runId ?? 'logs'}.csv`;
    a.click();
  }

  return (
    <main>
      <a href="/" style={{ color: '#737373' }}>← home</a>
      <h1 style={{ fontSize: 26, fontWeight: 800, marginTop: 8 }}>Auditor dashboard</h1>
      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <input
          className="input"
          type="password"
          placeholder="API key (optional)"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          style={{ maxWidth: 200 }}
          aria-label="API key for authentication"
        />
        <input
          className="input"
          placeholder="Run id (0x...)"
          value={runId}
          onChange={(e) => setRunId(e.target.value)}
          aria-label="Payroll run ID"
        />
        <button className="btn" onClick={load}>Load</button>
      </div>
      {msg && <p style={{ color: '#737373', marginTop: 10 }} role="alert">{msg}</p>}
      {data && (
        <div className="card" style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <strong>{data.name}</strong>
            <div style={{ display: 'flex', gap: 8 }}>
              {accessLogs.length > 0 && (
                <button className="btn" onClick={exportAccessLogsCsv} style={{ background: '#6b7280', fontSize: 13 }}>
                  Export Access Logs
                </button>
              )}
              <button className="btn" onClick={exportCsv} style={{ background: '#404040' }}>
                Export CSV
              </button>
            </div>
          </div>

          {/* Summary */}
          {data.summary && (
            <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 14, color: '#525252' }} role="status">
              <span>Total: <strong>{data.summary.totalRecipients}</strong></span>
              <span>Claimed: <strong>{data.summary.claimed}</strong></span>
              <span>Pending: <strong>{data.summary.pending}</strong></span>
            </div>
          )}

          <table style={{ width: '100%', marginTop: 12, borderCollapse: 'collapse', fontSize: 14 }} role="table">
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #e5e5e5' }}>
                <th scope="col">Email</th>
                <th scope="col">Amount</th>
                <th scope="col">Target</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.entries.map((e: any, i: number) => (
                <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td>{e.email}</td>
                  <td>{formatAmount(e.amount, 9, coinTypeLabel(e.targetCoinType))}</td>
                  <td>{coinTypeLabel(e.targetCoinType)}</td>
                  <td>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontSize: 12,
                      fontWeight: 600,
                      background: e.status === 'claimed' ? '#dcfce7' : '#fef9c3',
                      color: e.status === 'claimed' ? '#166534' : '#854d0e',
                    }}>
                      {e.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Access logs */}
          {accessLogs.length > 0 && (
            <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #e5e5e5' }}>
              <strong style={{ fontSize: 13 }}>Access log ({accessLogs.length} entries)</strong>
              <div style={{ fontSize: 12, color: '#737373', marginTop: 4 }}>
                {accessLogs.slice(-5).map((l: any, i: number) => (
                  <div key={i}>{l.isoTime} — {l.ip} — {l.endpoint} — {l.status}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
