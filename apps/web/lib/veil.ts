import type { VeilConfig } from '@veil/sdk';

export const RELAYER_URL = process.env.NEXT_PUBLIC_RELAYER_URL ?? 'http://localhost:8787';

export function getCfg(): VeilConfig {
  return {
    network: (process.env.NEXT_PUBLIC_SUI_NETWORK as VeilConfig['network']) ?? 'devnet',
    packageId: process.env.NEXT_PUBLIC_VEIL_PACKAGE_ID ?? '0x0',
    stableCoinType: process.env.NEXT_PUBLIC_STABLE_COIN_TYPE ?? '0x2::sui::SUI',
  };
}
