/**
 * Confidential amounts.
 *
 * FALLBACK (current): the run manifest (which carries amounts) is encoded and meant
 * to be stored encrypted (Walrus + Seal in W5) so the relayer/indexer never persist
 * plaintext. On-chain coin amounts remain visible until the beta is wired.
 *
 * W1: replace withdrawal (see veil::confidential_adapter) with the official
 * Confidential Transfers beta so amounts are hidden on-chain too.
 */
import type { AuditEntry } from './types.js';

export function encodeManifest(entries: AuditEntry[]): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(entries));
}

export function decodeManifest(bytes: Uint8Array): AuditEntry[] {
  return JSON.parse(new TextDecoder().decode(bytes)) as AuditEntry[];
}
