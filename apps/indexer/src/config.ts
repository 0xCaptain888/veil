import 'dotenv/config';
import type { Network } from '@veil/sdk';

export interface IndexerConfig {
  network: Network;
  fullnodeUrl?: string;
  packageId: string;
}

export function loadConfig(): IndexerConfig {
  const packageId = process.env.VEIL_PACKAGE_ID;
  if (!packageId) {
    throw new Error('VEIL_PACKAGE_ID is not set');
  }
  
  return {
    network: (process.env.SUI_NETWORK as Network) ?? 'mainnet',
    fullnodeUrl: process.env.SUI_FULLNODE_URL,
    packageId,
  };
}
