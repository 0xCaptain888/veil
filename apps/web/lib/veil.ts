import type { VeilConfig } from '@veil/sdk';

export const RELAYER_URL = process.env.NEXT_PUBLIC_RELAYER_URL ?? 'http://localhost:8787';

export function getCfg(): VeilConfig {
  return {
    network: (process.env.NEXT_PUBLIC_SUI_NETWORK as VeilConfig['network']) ?? 'devnet',
    packageId: process.env.NEXT_PUBLIC_VEIL_PACKAGE_ID ?? '0x0',
    stableCoinType: process.env.NEXT_PUBLIC_STABLE_COIN_TYPE ?? '0x2::sui::SUI',
  };
}

/**
 * Format an amount in base units to a human-readable localized string (§25).
 * Uses Intl.NumberFormat for locale-aware formatting.
 *
 * @param amount - Amount in base units (string or bigint)
 * @param decimals - Number of decimal places (default 9 for SUI)
 * @param currency - Currency symbol to display (default: auto-detect from coin type)
 */
export function formatAmount(
  amount: string | bigint | number,
  decimals: number = 9,
  currency?: string,
): string {
  const value = typeof amount === 'bigint'
    ? Number(amount) / Math.pow(10, decimals)
    : typeof amount === 'string'
      ? Number(amount) / Math.pow(10, decimals)
      : amount / Math.pow(10, decimals);

  const locale = typeof navigator !== 'undefined' ? navigator.language : 'en-US';

  try {
    return new Intl.NumberFormat(locale, {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: Math.min(decimals, 4),
    }).format(value) + (currency ? ` ${currency}` : '');
  } catch {
    return `${value.toFixed(2)}${currency ? ` ${currency}` : ''}`;
  }
}

/**
 * Get a human-readable label for a coin type string.
 */
export function coinTypeLabel(coinType?: string): string {
  if (!coinType) return 'SUI';
  if (coinType.includes('::sui::SUI') || coinType === '0x2::sui::SUI') return 'SUI';
  if (coinType.includes('::usdc::USDC')) return 'USDC';
  if (coinType.includes('::coin::COIN') || coinType.includes('WUSDT')) return 'WUSDT';
  if (coinType.includes('::deep::DEEP')) return 'DEEP';
  // Extract the last part of the type
  const parts = coinType.split('::');
  return parts[parts.length - 1] || coinType.slice(0, 8);
}
