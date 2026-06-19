import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { store } from '../store.js';
import { requireApiKey } from '../auth.js';
import { sendClaimEmail } from '../email.js';

export const runsRouter = Router();

/**
 * Register a run's claim tokens AFTER the employer has executed the on-chain PTB.
 * Protected by API key authentication.
 *
 * Body: {
 *   runId: string,
 *   name?: string,
 *   employerName?: string,
 *   recipients: [{ email, displayAmount, escrowId, secret(number[]), targetCoinType? }]
 * }
 *
 * Returns claim links and sends email notifications to recipients.
 */
runsRouter.post('/register-tokens', requireApiKey, async (req, res) => {
  const { runId, name, employerName, recipients } = req.body ?? {};
  if (!runId || !Array.isArray(recipients)) {
    return res.status(400).json({ error: 'runId and recipients[] required' });
  }

  store.putRun({ runId, name: name ?? 'Payroll Run', entries: [], createdAt: Date.now() });

  const webOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';
  const links = [];

  for (const r of recipients) {
    const token = randomUUID();
    store.putToken({
      token,
      runId,
      escrowId: r.escrowId,
      secret: r.secret,
      email: r.email,
      displayAmount: String(r.displayAmount ?? ''),
      targetCoinType: r.targetCoinType,
      status: 'pending',
      createdAt: Date.now(),
    });

    const url = `${webOrigin}/claim/${token}`;
    console.log(`[veil] claim link for ${r.email}: ${url}`);
    links.push({ email: r.email, token, url });

    // Send email notification (non-blocking, errors logged but don't fail the request)
    try {
      await sendClaimEmail(
        r.email,
        url,
        employerName ?? 'Your employer',
        String(r.displayAmount ?? ''),
        r.targetCoinType,
      );
    } catch (err) {
      console.error(`[veil] Failed to send email to ${r.email}:`, err);
      // Don't fail the request — email is best-effort
    }
  }

  res.json({ runId, links });
});
