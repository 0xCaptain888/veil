import { Router } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { store } from '../store.js';
import { requireApiKey } from '../auth.js';

export const auditRouter = Router();

// ===== Audit Access Logging (§24) =====
// Every audit access is logged with timestamp, IP, user-agent, and the run accessed.
// Logs are persisted to disk and included in exported reports.

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const AUDIT_LOG_FILE = path.join(DATA_DIR, 'audit-access-log.json');

interface AuditAccessLogEntry {
  timestamp: number;
  isoTime: string;
  ip: string;
  userAgent: string;
  endpoint: string;
  runId?: string;
  apiKeyPrefix: string; // first 8 chars of the API key (for identification, not full key)
  status: number;
}

let accessLogs: AuditAccessLogEntry[] = [];

function initAuditLog(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(AUDIT_LOG_FILE)) {
      const raw = fs.readFileSync(AUDIT_LOG_FILE, 'utf-8');
      accessLogs = JSON.parse(raw);
    }
  } catch (err) {
    console.error('[audit-log] Failed to load access log:', err);
    accessLogs = [];
  }
}

function logAccess(entry: AuditAccessLogEntry): void {
  accessLogs.push(entry);
  try {
    fs.writeFileSync(AUDIT_LOG_FILE, JSON.stringify(accessLogs, null, 2), 'utf-8');
  } catch (err) {
    console.error('[audit-log] Failed to write access log:', err);
  }
  console.log(`[audit-log] ${entry.isoTime} | ${entry.ip} | ${entry.endpoint} | run=${entry.runId ?? 'list'} | status=${entry.status}`);
}

// Initialize on module load
initAuditLog();

/**
 * Middleware to log audit access after the response is sent.
 */
function logAuditAccess(endpoint: string) {
  return (req: any, res: any, next: any) => {
    const startTime = Date.now();
    
    // Hook into response finish to log after the response is sent
    const originalEnd = res.end;
    res.end = function (...args: any[]) {
      const authHeader = req.headers.authorization || '';
      const apiKeyPrefix = authHeader.startsWith('Bearer ') 
        ? authHeader.substring(7, 15) + '...' 
        : 'none';
      
      logAccess({
        timestamp: startTime,
        isoTime: new Date(startTime).toISOString(),
        ip: req.ip || req.connection?.remoteAddress || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
        endpoint: `${req.method} ${endpoint}`,
        runId: req.params?.runId,
        apiKeyPrefix,
        status: res.statusCode,
      });
      
      return originalEnd.apply(res, args);
    };
    
    next();
  };
}

/**
 * Auditor reconciliation for a run.
 * Protected by API key authentication (auditor credentials).
 * All access is logged for compliance (§24).
 *
 * In production, the auditor decrypts the manifest client-side with the
 * AuditorCap-scoped key; here we return the (demo) entries from the store.
 */
auditRouter.get('/runs/:runId', requireApiKey, logAuditAccess('/audit/runs/:runId'), (req, res) => {
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
 * All access is logged for compliance (§24).
 */
auditRouter.get('/runs', requireApiKey, logAuditAccess('/audit/runs'), (_req, res) => {
  const runs = store.listRuns();
  res.json({ runs });
});

/**
 * Get audit access logs (admin endpoint).
 * Returns the log of all audit accesses for compliance reporting.
 */
auditRouter.get('/access-logs', requireApiKey, (_req, res) => {
  res.json({
    logs: accessLogs,
    total: accessLogs.length,
  });
});

/**
 * Export audit access logs as CSV.
 */
auditRouter.get('/access-logs/csv', requireApiKey, (_req, res) => {
  const rows = [
    ['timestamp', 'iso_time', 'ip', 'user_agent', 'endpoint', 'run_id', 'api_key_prefix', 'status'],
    ...accessLogs.map((l) => [
      String(l.timestamp),
      l.isoTime,
      l.ip,
      l.userAgent,
      l.endpoint,
      l.runId ?? '',
      l.apiKeyPrefix,
      String(l.status),
    ]),
  ];
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="veil-audit-access-logs.csv"');
  res.send(csv);
});
