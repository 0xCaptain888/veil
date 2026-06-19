export type Network = 'devnet' | 'testnet' | 'mainnet' | 'localnet';

export interface VeilConfig {
  network: Network;
  fullnodeUrl?: string;
  /** Published veil package id (0x...). */
  packageId: string;
  /** Stable coin type used for payouts. Demo default: 0x2::sui::SUI */
  stableCoinType: string;
  /** Optional DeepBook wiring for FX at claim (W4). */
  deepbookPackageId?: string;
  deepbookPoolId?: string;
}

export interface RecipientInput {
  email: string;
  /** Amount in the smallest unit of `stableCoinType`. */
  amount: bigint;
  /** If set, FX-swap USDC -> targetCoinType on claim (W4). */
  targetCoinType?: string;
  /** keccak256(oneTimeSecret) — binds the escrow to this recipient. */
  idHash: Uint8Array;
}

export interface AuditEntry {
  email: string;
  amount: string;
  targetCoinType?: string;
  escrowId?: string;
  status: 'pending' | 'claimed';
}
