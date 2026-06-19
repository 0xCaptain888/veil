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
import type { AuditEntry } from './types';

export function encodeManifest(entries: AuditEntry[]): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(entries));
}

export function decodeManifest(bytes: Uint8Array): AuditEntry[] {
  return JSON.parse(new TextDecoder().decode(bytes)) as AuditEntry[];
}

// ===== W1: Confidential Transfers Integration =====

/**
 * Confidential Transfers package configuration.
 * Currently only available on devnet.
 */
export const CONTRA_CONFIG = {
  devnet: {
    packageId: '0x4fe43958', // Placeholder - actual devnet package ID
  },
  mainnet: {
    packageId: null, // Not yet available on mainnet
  },
};

/**
 * Check if confidential mode is available for the current network.
 */
export function isConfidentialAvailable(network: string): boolean {
  return network === 'devnet' && CONTRA_CONFIG.devnet.packageId !== null;
}

/**
 * Get the contra package ID for the current network.
 */
export function getContraPackageId(network: string): string | null {
  const config = CONTRA_CONFIG[network as keyof typeof CONTRA_CONFIG];
  return config?.packageId || null;
}

/**
 * Build a transaction to wrap coins into a confidential balance.
 * 
 * FALLBACK MODE: No-op (returns null).
 * CONFIDENTIAL MODE: Builds a wrap transaction.
 */
export function buildWrapTx(
  network: string,
  stableCoinType: string,
  coinId: string,
  accountObjectId: string,
): any | null {
  if (!isConfidentialAvailable(network)) {
    return null; // Fallback mode - no wrap needed
  }

  // ===== CONFIDENTIAL MODE (W1) =====
  // When contra package is available, implement:
  //
  // import { Transaction } from '@mysten/sui/transactions';
  //
  // const tx = new Transaction();
  // const contraPkg = getContraPackageId(network);
  //
  // tx.moveCall({
  //   target: `${contraPkg}::contra::wrap`,
  //   typeArguments: [stableCoinType],
  //   arguments: [
  //     tx.object(accountObjectId),  // Confidential account
  //     tx.object(coinId),           // Coin to wrap
  //     tx.pure.vector('u8', []),    // Memo (optional)
  //   ],
  // });
  //
  // return tx;

  return null; // Placeholder
}

/**
 * Build a transaction to unwrap coins from a confidential balance.
 * 
 * FALLBACK MODE: No-op (returns null).
 * CONFIDENTIAL MODE: Builds an unwrap transaction.
 */
export function buildUnwrapTx(
  network: string,
  stableCoinType: string,
  accountObjectId: string,
  amount: bigint,
  recipientAddress: string,
): any | null {
  if (!isConfidentialAvailable(network)) {
    return null; // Fallback mode - no unwrap needed
  }

  // ===== CONFIDENTIAL MODE (W1) =====
  // When contra package is available, implement:
  //
  // import { Transaction } from '@mysten/sui/transactions';
  //
  // const tx = new Transaction();
  // const contraPkg = getContraPackageId(network);
  //
  // tx.moveCall({
  //   target: `${contraPkg}::contra::unwrap`,
  //   typeArguments: [stableCoinType],
  //   arguments: [
  //     tx.object(accountObjectId),  // Confidential account
  //     tx.pure.u64(amount),         // Amount to unwrap
  //     tx.pure.address(recipientAddress), // Recipient
  //   ],
  // });
  //
  // return tx;

  return null; // Placeholder
}
