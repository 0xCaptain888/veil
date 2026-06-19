import 'dotenv/config';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { loadConfig } from './config.js';
import { EventStore } from './store.js';

const POLL_INTERVAL = 5000; // 5 seconds

async function main() {
  console.log('[indexer] Starting Veil event indexer...');
  
  const cfg = loadConfig();
  const client = new SuiClient({ url: cfg.fullnodeUrl ?? getFullnodeUrl(cfg.network) });
  const store = new EventStore();
  
  console.log(`[indexer] Network: ${cfg.network}`);
  console.log(`[indexer] Package ID: ${cfg.packageId}`);
  console.log(`[indexer] Polling interval: ${POLL_INTERVAL}ms`);
  
  let cursor: string | null = null;
  
  while (true) {
    try {
      // Query events from the Veil package
      const events = await client.queryEvents({
        query: {
          MoveModule: {
            package: cfg.packageId,
            module: 'payroll',
          },
        },
        cursor,
        descendingOrder: false,
      });
      
      if (events.data.length > 0) {
        console.log(`[indexer] Found ${events.data.length} new events`);
        
        for (const event of events.data) {
          const eventType = event.type;
          
          // Parse and store events
          if (eventType.includes('RunCreated')) {
            const data = event.parsedJson as any;
            store.addRunCreated({
              txDigest: event.id.txDigest,
              eventSeq: event.id.eventSeq,
              timestamp: event.timestamp,
              runId: data.run,
              employerId: data.employer,
            });
            console.log(`[indexer] RunCreated: ${data.run}`);
          } else if (eventType.includes('PayoutEscrowed')) {
            const data = event.parsedJson as any;
            store.addPayoutEscrowed({
              txDigest: event.id.txDigest,
              eventSeq: event.id.eventSeq,
              timestamp: event.timestamp,
              runId: data.run,
              escrowId: data.escrow,
              recipientIdHash: data.recipient_id_hash,
            });
            console.log(`[indexer] PayoutEscrowed: ${data.escrow}`);
          } else if (eventType.includes('PayoutClaimed')) {
            const data = event.parsedJson as any;
            store.addPayoutClaimed({
              txDigest: event.id.txDigest,
              eventSeq: event.id.eventSeq,
              timestamp: event.timestamp,
              runId: data.run,
              escrowId: data.escrow,
              recipient: data.recipient,
            });
            console.log(`[indexer] PayoutClaimed: ${data.escrow}`);
          } else if (eventType.includes('RunFinalized')) {
            const data = event.parsedJson as any;
            store.addRunFinalized({
              txDigest: event.id.txDigest,
              eventSeq: event.id.eventSeq,
              timestamp: event.timestamp,
              runId: data.run,
              recipientCount: data.recipient_count,
            });
            console.log(`[indexer] RunFinalized: ${data.run}`);
          }
        }
        
        // Update cursor for next poll
        cursor = events.nextCursor ?? null;
      }
    } catch (error) {
      console.error('[indexer] Error polling events:', error);
    }
    
    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
  }
}

main().catch(console.error);
