import * as fs from 'fs';
import * as path from 'path';

export interface RunCreatedEvent {
  txDigest: string;
  eventSeq: string;
  timestamp: string;
  runId: string;
  employerId: string;
}

export interface PayoutEscrowedEvent {
  txDigest: string;
  eventSeq: string;
  timestamp: string;
  runId: string;
  escrowId: string;
  recipientIdHash: string;
}

export interface PayoutClaimedEvent {
  txDigest: string;
  eventSeq: string;
  timestamp: string;
  runId: string;
  escrowId: string;
  recipient: string;
}

export interface RunFinalizedEvent {
  txDigest: string;
  eventSeq: string;
  timestamp: string;
  runId: string;
  recipientCount: number;
}

export interface IndexedData {
  runs: Map<string, {
    employerId: string;
    createdAt: string;
    finalizedAt?: string;
    recipientCount?: number;
    escrows: Map<string, {
      recipientIdHash: string;
      escrowedAt: string;
      claimedAt?: string;
      recipient?: string;
    }>;
  }>;
}

const DATA_DIR = process.env.INDEXER_DATA_DIR || './data';
const DATA_FILE = path.join(DATA_DIR, 'indexer-store.json');

export class EventStore {
  private data: IndexedData = {
    runs: new Map(),
  };
  
  constructor() {
    this.load();
  }
  
  private load() {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        
        // Convert back to Maps
        this.data.runs = new Map();
        for (const [runId, run] of Object.entries(parsed.runs || {})) {
          const runData = run as any;
          this.data.runs.set(runId, {
            employerId: runData.employerId,
            createdAt: runData.createdAt,
            finalizedAt: runData.finalizedAt,
            recipientCount: runData.recipientCount,
            escrows: new Map(Object.entries(runData.escrows || {})),
          });
        }
        
        console.log(`[store] Loaded ${this.data.runs.size} runs from disk`);
      }
    } catch (error) {
      console.error('[store] Failed to load data:', error);
    }
  }
  
  private save() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      
      // Convert Maps to objects for JSON serialization
      const serialized = {
        runs: Object.fromEntries(
          Array.from(this.data.runs.entries()).map(([runId, run]) => [
            runId,
            {
              employerId: run.employerId,
              createdAt: run.createdAt,
              finalizedAt: run.finalizedAt,
              recipientCount: run.recipientCount,
              escrows: Object.fromEntries(run.escrows),
            },
          ])
        ),
      };
      
      fs.writeFileSync(DATA_FILE, JSON.stringify(serialized, null, 2));
    } catch (error) {
      console.error('[store] Failed to save data:', error);
    }
  }
  
  addRunCreated(event: RunCreatedEvent) {
    this.data.runs.set(event.runId, {
      employerId: event.employerId,
      createdAt: event.timestamp,
      escrows: new Map(),
    });
    this.save();
  }
  
  addPayoutEscrowed(event: PayoutEscrowedEvent) {
    const run = this.data.runs.get(event.runId);
    if (run) {
      run.escrows.set(event.escrowId, {
        recipientIdHash: event.recipientIdHash,
        escrowedAt: event.timestamp,
      });
      this.save();
    }
  }
  
  addPayoutClaimed(event: PayoutClaimedEvent) {
    const run = this.data.runs.get(event.runId);
    if (run) {
      const escrow = run.escrows.get(event.escrowId);
      if (escrow) {
        escrow.claimedAt = event.timestamp;
        escrow.recipient = event.recipient;
        this.save();
      }
    }
  }
  
  addRunFinalized(event: RunFinalizedEvent) {
    const run = this.data.runs.get(event.runId);
    if (run) {
      run.finalizedAt = event.timestamp;
      run.recipientCount = event.recipientCount;
      this.save();
    }
  }
  
  getRun(runId: string) {
    return this.data.runs.get(runId);
  }
  
  getAllRuns() {
    return Array.from(this.data.runs.entries()).map(([runId, run]) => ({
      runId,
      ...run,
      escrows: Array.from(run.escrows.entries()).map(([escrowId, escrow]) => ({
        escrowId,
        ...escrow,
      })),
    }));
  }
  
  getStats() {
    let totalEscrows = 0;
    let claimedEscrows = 0;
    
    for (const run of this.data.runs.values()) {
      totalEscrows += run.escrows.size;
      for (const escrow of run.escrows.values()) {
        if (escrow.claimedAt) {
          claimedEscrows++;
        }
      }
    }
    
    return {
      totalRuns: this.data.runs.size,
      totalEscrows,
      claimedEscrows,
      pendingEscrows: totalEscrows - claimedEscrows,
    };
  }
}
