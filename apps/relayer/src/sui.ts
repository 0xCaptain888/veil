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
