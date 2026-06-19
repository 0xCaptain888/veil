import { Router } from 'express';
import { requireApiKey } from '../auth.js';

export const riskRouter = Router();

/**
 * Risk Signal API (§24 — Compliance Integration)
 *
 * Provides endpoints for TRM Labs / Merkle Science-style risk monitoring.
 * In production, these would call external risk APIs and return signals.
 * Current implementation: stub that returns mock risk data for demo purposes.
 *
 * Design principles:
 * - No plaintext amounts are exposed via risk signals
 * - Signals are privacy-preserving (address-level, not amount-level)
 * - Supports monitoring and investigation workflows
 */

interface RiskSignal {
  address: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  categories: string[];
  score: number; // 0-100
  lastChecked: string;
  source: string;
  details?: string;
}

// In-memory risk cache (in production, use a database)
const riskCache = new Map<string, RiskSignal>();

/**
 * GET /risk/address/:address
 * Check risk signals for a specific address.
 * In production: calls TRM Labs / Merkle Science API.
 */
riskRouter.get('/address/:address', requireApiKey, async (req, res) => {
  const { address } = req.params;

  // Check cache first
  const cached = riskCache.get(address);
  if (cached && Date.now() - new Date(cached.lastChecked).getTime() < 3600000) {
    return res.json(cached);
  }

  // In production, call external risk API here:
  // const trmResult = await callTRM(address);
  // const merkleResult = await callMerkle(address);

  // Stub: return low risk for demo
  const signal: RiskSignal = {
    address,
    riskLevel: 'low',
    categories: [],
    score: 0,
    lastChecked: new Date().toISOString(),
    source: 'stub',
    details: 'Risk check stub — connect TRM/Merkle API for production use',
  };

  riskCache.set(address, signal);
  res.json(signal);
});

/**
 * POST /risk/monitor
 * Register an address for ongoing monitoring.
 * Returns a monitoring ID that can be used to check status.
 */
riskRouter.post('/monitor', requireApiKey, async (req, res) => {
  const { address, label, alertThreshold } = req.body ?? {};

  if (!address) {
    return res.status(400).json({ error: 'address required' });
  }

  // In production: register with TRM/Merkle monitoring service
  const monitoringId = `mon_${Date.now()}_${address.slice(0, 8)}`;

  console.log(`[risk] Monitoring registered: ${monitoringId} for ${address} (label: ${label ?? 'unnamed'})`);

  res.json({
    monitoringId,
    address,
    label: label ?? 'unnamed',
    alertThreshold: alertThreshold ?? 'medium',
    status: 'active',
    createdAt: new Date().toISOString(),
  });
});

/**
 * GET /risk/investigate/:address
 * Deep investigation report for an address (compliance workflow).
 * In production: aggregates data from TRM, Merkle, and on-chain analysis.
 */
riskRouter.get('/investigate/:address', requireApiKey, async (req, res) => {
  const { address } = req.params;

  // In production: call investigation APIs, aggregate results
  res.json({
    address,
    investigatedAt: new Date().toISOString(),
    summary: {
      riskLevel: 'low',
      totalExposure: 'N/A (stub)',
      associatedEntities: 0,
      sanctionsMatch: false,
      pepMatch: false,
    },
    onChainActivity: {
      firstSeen: 'N/A',
      transactionCount: 'N/A',
      counterparties: 'N/A',
    },
    recommendations: [
      'Connect TRM Labs API for real risk scoring',
      'Connect Merkle Science for transaction monitoring',
    ],
    source: 'stub',
  });
});

/**
 * GET /risk/stats
 * Summary of monitored addresses and risk distribution.
 */
riskRouter.get('/stats', requireApiKey, async (_req, res) => {
  const signals = Array.from(riskCache.values());
  const distribution = {
    low: signals.filter((s) => s.riskLevel === 'low').length,
    medium: signals.filter((s) => s.riskLevel === 'medium').length,
    high: signals.filter((s) => s.riskLevel === 'high').length,
    critical: signals.filter((s) => s.riskLevel === 'critical').length,
  };

  res.json({
    totalMonitored: signals.length,
    distribution,
    lastUpdated: new Date().toISOString(),
  });
});
