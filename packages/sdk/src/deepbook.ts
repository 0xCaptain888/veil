import type { Transaction, TransactionObjectArgument } from '@mysten/sui/transactions';
import type { VeilConfig } from './types.js';
import { toByteArray } from './utils.js';

/**
 * DeepBook V3 swap configuration for cross-currency settlement (W4).
 *
 * When a recipient claims a payout, they can choose to receive a different coin
 * than the payout coin (e.g., USDC → local stablecoin). This function performs
 * an atomic swap within the same PTB via DeepBook's on-chain order book.
 *
 * Slippage protection: `minOut` sets the minimum acceptable output amount.
 * If the swap would produce less than `minOut`, the transaction reverts.
 *
 * Fallback: if no pool is configured for the target pair, the input coin is
 * returned unchanged and the UI shows a warning.
 */

// DeepBook V3 package addresses (mainnet / testnet)
const DEEPBOOK_MAINNET_PACKAGE = '0xde00463eb484b056bb24b880ab2cfb3f4a18994c68bc7b6be7a0807e47a05c0d';
const DEEPBOOK_TESTNET_PACKAGE = '0x2c8d607bc15beeb4e7e8b2d82935e3a27a1a60c0f2e8019e18bc4e298e6e80a0';

/**
 * Get the DeepBook pool address for a given coin pair.
 * In production, pool addresses come from env config or on-chain registry.
 * This is a lookup helper for known pairs.
 */
function getPoolForPair(cfg: VeilConfig, sourceCoinType: string, targetCoinType: string): string | undefined {
  // If a specific pool is configured via env, use it
  if (cfg.deepbookPoolId) return cfg.deepbookPoolId;

  // Known pool registry (extend as needed)
  // Format: `${sourceCoinType}-${targetCoinType}` → pool address
  const KNOWN_POOLS: Record<string, Record<string, string>> = {
    mainnet: {},
    testnet: {},
    devnet: {},
  };

  return KNOWN_POOLS[cfg.network]?.[`${sourceCoinType}/${targetCoinType}`];
}

/**
 * Optional FX swap at claim time (W4).
 *
 * Swap the claimed coin (e.g., USDC) into the recipient's target coin via
 * DeepBook V3 on-chain order book. The swap is atomic within the PTB.
 *
 * @param tx - The transaction being built
 * @param cfg - Veil configuration with network and DeepBook settings
 * @param inputCoin - The coin to swap (output of claim_payout)
 * @param targetCoinType - The desired output coin type (e.g., a local stablecoin)
 * @param sourceCoinType - The source coin type (defaults to cfg.stableCoinType)
 * @param minOut - Minimum acceptable output amount (slippage protection). If omitted,
 *                 defaults to 0 (no slippage protection — use with caution).
 * @returns The output coin (swapped or original if no pool available)
 */
export function maybeSwap(
  tx: Transaction,
  cfg: VeilConfig,
  inputCoin: TransactionObjectArgument,
  targetCoinType?: string,
  sourceCoinType?: string,
  minOut?: bigint,
): TransactionObjectArgument {
  // No target specified → deliver source coin as-is
  if (!targetCoinType) return inputCoin;

  const srcType = sourceCoinType || cfg.stableCoinType;

  // Same coin type → no swap needed
  if (targetCoinType === srcType) return inputCoin;

  // Look up pool for this pair
  const poolId = getPoolForPair(cfg, srcType, targetCoinType);
  if (!poolId) {
    // No pool available → deliver source coin, UI will show warning
    // The caller (relayer claim route) should check if returned coin type differs
    // from requested and notify the user
    return inputCoin;
  }

  // Determine DeepBook package for this network
  const dbPkg = cfg.network === 'mainnet'
    ? DEEPBOOK_MAINNET_PACKAGE
    : DEEPBOOK_TESTNET_PACKAGE;

  // DeepBook V3 swap: swap_exact_quote_for_base
  // This swaps the input coin (quote) for the target coin (base) at market price.
  // The `min_out` parameter provides slippage protection.
  const [outputCoin] = tx.moveCall({
    target: `${dbPkg}::pool::swap_exact_quote_for_base`,
    typeArguments: [srcType, targetCoinType],
    arguments: [
      tx.object(poolId),           // The liquidity pool
      inputCoin,                   // The coin to swap
      tx.pure.u64(minOut ?? 0),   // Minimum output (slippage guard)
    ],
  });

  return outputCoin;
}

/**
 * Build a claim transaction WITH optional DeepBook FX swap.
 * This is the full claim flow: claim → optional swap → transfer to recipient.
 *
 * @param params.cfg - Veil configuration
 * @param params.escrowId - The escrow object ID to claim from
 * @param params.secret - The one-time claim secret (bytes)
 * @param params.recipientAddress - Address to receive the funds
 * @param params.targetCoinType - Optional target coin for FX swap
 * @param params.minOut - Minimum output for slippage protection
 */
export function buildClaimWithSwapTx(params: {
  cfg: VeilConfig;
  escrowId: string;
  secret: Uint8Array;
  recipientAddress: string;
  targetCoinType?: string;
  minOut?: bigint;
}): Transaction {
  const { cfg, escrowId, secret, recipientAddress, targetCoinType, minOut } = params;


  const tx = new Transaction();

  // Step 1: Claim the payout (returns Coin<stableCoinType>)
  const claimedCoin = tx.moveCall({
    target: `${cfg.packageId}::payroll::claim_payout`,
    typeArguments: [cfg.stableCoinType],
    arguments: [tx.object(escrowId), tx.pure.vector('u8', toByteArray(secret))],
  });

  // Step 2: Optional FX swap via DeepBook
  const outputCoin = maybeSwap(tx, cfg, claimedCoin, targetCoinType, cfg.stableCoinType, minOut);

  // Step 3: Transfer to recipient
  tx.transferObjects([outputCoin], tx.pure.address(recipientAddress));

  return tx;
}
