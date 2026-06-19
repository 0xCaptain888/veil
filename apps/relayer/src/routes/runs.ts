import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { store } from '../store.js';
import { requireApiKey } from '../auth.js';
import { sendClaimEmail, sendClaimSms, sendClaimNotification } from '../email.js';

export const runsRouter = Router();

/**
 * Register a run's claim tokens AFTER the employer has executed the on-chain PTB.
 * Protected by API key authentication.
 *
 * Body: {
 *   runId: string,
 *   name?: string,
 *   employerName?: string,
 *   recipients: [{
 *     email?: string,
 *     phone?: string,          // E.164 format for SMS fallback (§18)
 *     displayAmount: string,
 *     escrowId: string,
 *     secret: number[],
 *     targetCoinType?: string,
 *     preferSms?: boolean      // send SMS only (no email)
 *   }]
 * }
 *
 * Returns claim links and sends email/SMS notifications to recipients.
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
      email: r.email ?? '',
      displayAmount: String(r.displayAmount ?? ''),
      targetCoinType: r.targetCoinType,
      status: 'pending',
      createdAt: Date.now(),
    });

    const url = `${webOrigin}/claim/${token}`;
    console.log(`[veil] claim link for ${r.email || r.phone || 'recipient'}: ${url}`);
    links.push({ email: r.email || r.phone, token, url });

    // Send notification (email and/or SMS)
    try {
      await sendClaimNotification({
        email: r.email,
        phone: r.phone,
        claimUrl: url,
        employerName: employerName ?? 'Your employer',
        displayAmount: String(r.displayAmount ?? ''),
        targetCoinType: r.targetCoinType,
        preferSms: r.preferSms,
      });
    } catch (err) {
      console.error(`[veil] Failed to notify ${r.email || r.phone}:`, err);
      // Don't fail the request — notification is best-effort
    }
  }

  res.json({ runId, links });
});
