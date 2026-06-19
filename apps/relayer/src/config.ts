import 'dotenv/config';
import type { VeilConfig, Network } from '@veil/sdk';

export function loadConfig(): VeilConfig {
  const packageId = process.env.VEIL_PACKAGE_ID;
  if (!packageId) throw new Error('VEIL_PACKAGE_ID is not set (deploy the Move package first).');
  return {
    network: (process.env.SUI_NETWORK as Network) ?? 'devnet',
    fullnodeUrl: process.env.SUI_FULLNODE_URL,
    packageId,
    stableCoinType: process.env.STABLE_COIN_TYPE ?? '0x2::sui::SUI',
    deepbookPackageId: process.env.DEEPBOOK_PACKAGE_ID,
    deepbookPoolId: process.env.DEEPBOOK_POOL_ID,
  };
}

export const PORT = Number(process.env.PORT ?? 8787);
export const WEB_ORIGIN = process.env.WEB_ORIGIN ?? 'http://localhost:3000';
