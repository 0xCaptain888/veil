/**
 * Persistent file-based store for the Veil relayer.
 *
 * Replaces the in-memory Map with JSON file persistence. Data survives restarts.
 * In production, replace with a proper database (PostgreSQL, SQLite, etc.).
 *
 * Security note: claim secrets and amounts are stored in plaintext on disk.
 * In production, these should be encrypted at rest. The manifest blob (which
 * contains amounts) is meant to be encrypted via Walrus+Seal in W5.
 */
import * as fs from 'fs';
import * as path from 'path';
import type { AuditEntry } from '@veil/sdk';

export interface ClaimToken {
  token: string;
  runId: string;
  escrowId: string;
  secret: number[]; // bytes of the one-time secret
  email: string;
  displayAmount: string;
  targetCoinType?: string;
  status: 'pending' | 'claimed';
  digest?: string;
  recipient?: string;
  createdAt: number;
  claimedAt?: number;
}

export interface RunRecord {
  runId: string;
  name: string;
  entries: AuditEntry[];
  createdAt: number;
}

interface StoreData {
  runs: Record<string, RunRecord>;
  tokens: Record<string, ClaimToken>;
}

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'relayer-store.json');

// In-memory cache (loaded from disk on init, flushed on writes)
let cache: StoreData = { runs: {}, tokens: {} };
let initialized = false;

/**
 * Initialize the store: create data directory if needed, load from disk.
 */
function init(): void {
  if (initialized) return;

  // Ensure data directory exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // Load existing data or start fresh
  if (fs.existsSync(DATA_FILE)) {
    try {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      cache = JSON.parse(raw);
      console.log(`[store] Loaded ${Object.keys(cache.runs).length} runs, ${Object.keys(cache.tokens).length} tokens from disk`);
    } catch (err) {
      console.error('[store] Failed to load store from disk, starting fresh:', err);
      cache = { runs: {}, tokens: {} };
    }
  } else {
    console.log('[store] No existing data file, starting fresh');
  }

  initialized = true;
}

/**
 * Flush current cache to disk.
 */
function flush(): void {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(cache, null, 2), 'utf-8');
  } catch (err) {
    console.error('[store] Failed to flush to disk:', err);
  }
}

export const store = {
  /**
   * Store a payroll run record.
   */
  putRun(r: RunRecord): void {
    init();
    cache.runs[r.runId] = r;
    flush();
  },

  /**
   * Retrieve a run by ID.
   */
  getRun(id: string): RunRecord | undefined {
    init();
    return cache.runs[id];
  },

  /**
   * List all runs (for admin/audit views).
   */
  listRuns(): RunRecord[] {
    init();
    return Object.values(cache.runs).sort((a, b) => b.createdAt - a.createdAt);
  },

  /**
   * Store a claim token.
   */
  putToken(t: ClaimToken): void {
    init();
    cache.tokens[t.token] = t;
    flush();
  },

  /**
   * Retrieve a claim token by its one-time token string.
   */
  getToken(token: string): ClaimToken | undefined {
    init();
    return cache.tokens[token];
  },

  /**
   * Mark a claim token as claimed.
   */
  markClaimed(token: string, recipient: string, digest: string): ClaimToken | undefined {
    init();
    const t = cache.tokens[token];
    if (t) {
      t.status = 'claimed';
      t.recipient = recipient;
      t.digest = digest;
      t.claimedAt = Date.now();
      flush();
    }
    return t;
  },

  /**
   * Get all tokens for a given run (for audit reconciliation).
   */
  tokensForRun(runId: string): ClaimToken[] {
    init();
    return Object.values(cache.tokens).filter((t) => t.runId === runId);
  },

  /**
   * Generate audit entries for a run.
   */
  auditFor(runId: string): AuditEntry[] {
    init();
    return Object.values(cache.tokens)
      .filter((t) => t.runId === runId)
      .map((t) => ({
        email: t.email,
        amount: t.displayAmount,
        targetCoinType: t.targetCoinType,
        escrowId: t.escrowId,
        status: t.status,
      }));
  },

  /**
   * Get store statistics (for /health endpoint).
   */
  stats(): { runs: number; tokens: number; pending: number; claimed: number } {
    init();
    const tokens = Object.values(cache.tokens);
    return {
      runs: Object.keys(cache.runs).length,
      tokens: tokens.length,
      pending: tokens.filter((t) => t.status === 'pending').length,
      claimed: tokens.filter((t) => t.status === 'claimed').length,
    };
  },
};
