import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { PORT, WEB_ORIGIN, loadConfig } from './config.js';
import { runsRouter } from './routes/runs.js';
import { claimsRouter } from './routes/claims.js';
import { auditRouter } from './routes/audit.js';
import { store } from './store.js';

const app = express();
app.use(cors({ origin: WEB_ORIGIN }));
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  let pkg = 'unset';
  try { pkg = loadConfig().packageId; } catch { /* not configured yet */ }
  const stats = store.stats();
  res.json({ ok: true, packageId: pkg, store: stats });
});

app.use('/runs', runsRouter);
app.use('/claims', claimsRouter);
app.use('/audit', auditRouter);

app.listen(PORT, () => {
  console.log(`[veil] relayer listening on http://localhost:${PORT} (web origin: ${WEB_ORIGIN})`);
  console.log(`[veil] data directory: ${process.env.DATA_DIR || './data'}`);
  console.log(`[veil] email service: ${process.env.EMAIL_SERVICE || 'console'}`);
  console.log(`[veil] API key protection: ${process.env.RELAYER_API_KEY ? 'enabled' : 'disabled (dev mode)'}`);
});
