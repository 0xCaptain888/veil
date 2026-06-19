import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import type { Transaction } from '@mysten/sui/transactions';
import { loadConfig } from './config.js';

let _kp: Ed25519Keypair | null = null;
let _client: SuiClient | null = null;

export function relayerKeypair(): Ed25519Keypair {
  if (_kp) return _kp;
  const sk = process.env.RELAYER_PRIVATE_KEY;
  if (!sk) throw new Error('RELAYER_PRIVATE_KEY is not set (a funded suiprivkey... key).');
  const { secretKey } = decodeSuiPrivateKey(sk);
  _kp = Ed25519Keypair.fromSecretKey(secretKey);
  return _kp;
}

export function suiClient(): SuiClient {
  if (_client) return _client;
  const cfg = loadConfig();
  _client = new SuiClient({ url: cfg.fullnodeUrl ?? getFullnodeUrl(cfg.network) });
  return _client;
}

/** Relayer signs + executes a transaction (it pays gas). */
export async function relayerExecute(tx: Transaction) {
  const client = suiClient();
  return client.signAndExecuteTransaction({
    signer: relayerKeypair(),
    transaction: tx,
    options: { showEffects: true, showEvents: true },
  });
}

/**
 * Build a transaction for the recipient to sign (sponsored transaction flow).
 * Returns the transaction bytes that the recipient can sign with their wallet/zkLogin.
 */
export async function buildClaimTransaction(params: {
  escrowId: string;
  secret: number[];
  recipientAddress: string;
  targetCoinType?: string;
}): Promise<{ txBytes: string; gasBudget: number }> {
  const cfg = loadConfig();
  const tx = new Transaction();

  // Step 1: Claim the payout from escrow
  const claimedCoin = tx.moveCall({
    target: `${cfg.packageId}::payroll::claim_payout`,
    typeArguments: [cfg.stableCoinType],
    arguments: [tx.object(params.escrowId), tx.pure.vector('u8', params.secret)],
  });

  // Step 2: Optional DeepBook FX swap (W4)
  let outputCoin = claimedCoin;
  if (params.targetCoinType && params.targetCoinType !== cfg.stableCoinType && cfg.deepbookPoolId) {
    const { maybeSwap } = await import('@veil/sdk');
    outputCoin = maybeSwap(tx, cfg, claimedCoin, params.targetCoinType, cfg.stableCoinType);
  }

  // Step 3: Transfer to recipient
  tx.transferObjects([outputCoin], tx.pure.address(params.recipientAddress));

  // Build the transaction bytes
  const txBytes = await tx.build({ client: suiClient() });
  
  return {
    txBytes: Buffer.from(txBytes).toString('base64'),
    gasBudget: 10_000_000, // 0.01 SUI gas budget
  };
}

/**
 * Execute a sponsored transaction: recipient has already signed, relayer sponsors gas.
 * This is the production path for W3.
 */
export async function sponsorAndExecute(params: {
  txBytes: string;
  signature: string;
}): Promise<{ digest: string }> {
  const client = suiClient();
  
  // Decode the transaction bytes
  const txBytesArray = new Uint8Array(Buffer.from(params.txBytes, 'base64'));
  
  // Execute with the recipient's signature, relayer pays gas
  const result = await client.executeTransactionBlock({
    transactionBlock: params.txBytes,
    signature: params.signature,
    options: {
      showEffects: true,
      showEvents: true,
    },
  });

  return { digest: result.digest };
}
