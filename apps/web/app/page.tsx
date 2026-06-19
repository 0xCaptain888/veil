import Link from 'next/link';

export default function Home() {
  return (
    <main>
      <h1 style={{ fontSize: 30, fontWeight: 800 }}>Veil</h1>
      <p style={{ color: '#525252', marginTop: 8 }}>
        Confidential global payroll on Sui — salary amounts stay private on-chain, recipients get paid in
        seconds with zero gas and no seed phrase.
      </p>
      <div style={{ display: 'grid', gap: 16, marginTop: 24 }}>
        <Link className="card" href="/employer">
          <strong>Employer console →</strong>
          <div style={{ color: '#737373' }}>Create a payroll run, add recipients, execute a confidential batch payout.</div>
        </Link>
        <Link className="card" href="/audit">
          <strong>Auditor dashboard →</strong>
          <div style={{ color: '#737373' }}>Reconcile a run and export a report.</div>
        </Link>
        <div className="card">
          <strong>Recipient claim</strong>
          <div style={{ color: '#737373' }}>Recipients open a personal claim link (e.g. /claim/&lt;token&gt;) from their email.</div>
        </div>
      </div>
    </main>
  );
}
