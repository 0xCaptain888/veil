import { Router } from 'express';
import { store } from '../store.js';
import { requireApiKey } from '../auth.js';

export const auditRouter = Router();

/**
 * Auditor reconciliation for a run.
 * Protected by API key authentication (auditor credentials).
 *
 * In production, the auditor decrypts the manifest client-side with the
 * AuditorCap-scoped key; here we return the (demo) entries from the store.
 */
auditRouter.get('/runs/:runId', requireApiKey, (req, res) => {
  const run = store.getRun(req.params.runId);
  if (!run) return res.status(404).json({ error: 'unknown run' });

  const entries = store.auditFor(run.runId);
  const tokens = store.tokensForRun(run.runId);

  res.json({
    runId: run.runId,
    name: run.name,
    createdAt: run.createdAt,
    entries,
    summary: {
      totalRecipients: entries.length,
      claimed: tokens.filter((t) => t.status === 'claimed').length,
      pending: tokens.filter((t) => t.status === 'pending').length,
    },
  });
});

/**
 * List all runs (admin endpoint).
 * Protected by API key authentication.
 */
auditRouter.get('/runs', requireApiKey, (_req, res) => {
  const runs = store.listRuns();
  res.json({ runs });
});
