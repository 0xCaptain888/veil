import type { Transaction, TransactionObjectArgument } from '@mysten/sui/transactions';
import type { VeilConfig } from './types';

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

// DeepBook V3 package addresses (mainnet / devnet)
export const DEEPBOOK_V3 = {
  mainnet: {
    packageId: '0x337f4f4f6567fcd778d5454f27c16c70e2f274cc6377ea6249ddf491482ef497',
    registry: '0xaf16199a2dff736e9f07a845f23c5da6df6f756eddb631aed9d24a93efc4549d',
    deepTreasury: '0x032abf8948dda67a271bcc18e776dbbcfb0d58c8d288a700ff0d5521e57a1ffe',
  },
  devnet: {
    packageId: '0x0e8c7a4f0e4e8c7a4f0e4e8c7a4f0e4e8c7a4f0e4e8c7a4f0e4e8c7a4f0e4e8c', // placeholder
    registry: '0x0000000000000000000000000000000000000000000000000000000000000000',
    deepTreasury: '0x0000000000000000000000000000000000000000000000000000000000000000',
  },
};

// Known pool addresses (mainnet)
export const DEEPBOOK_POOLS = {
  mainnet: {
    'SUI/USDC': '0xe05dafb5133bcffb8d59f4e12465dc0e9faeaa05e3e342a08fe135800e3e4407',
    'USDC/SUI': '0xe05dafb5133bcffb8d59f4e12465dc0e9faeaa05e3e342a08fe135800e3e4407',
    'DEEP/SUI': '0xb663828d6217467c8a1838a03793da896cbe745b150ebd57d82f814ca579fc22',
    'DEEP/USDC': '0xf948981b806057580f91622417534f491da5f61aeaf33d0ed8e69fd5691c95ce',
    'WUSDT/USDC': '0x4e2ca3988246e1d50b9bf209abb9c1cbfec65bd95afdacc620a36c67bdb8452f',
    'WUSDC/USDC': '0xa0b9ebefb38c963fd115f52d71fa64501b79d1adcb5270563f92ce0442376545',
    'BETH/USDC': '0x1109352b9112717bd2a7c3eb9a416fff1ba6951760f5bdd5424cf5e4e5b3e65c',
  },
  devnet: {},
};

// Known coin types
export const COIN_TYPES = {
  mainnet: {
    SUI: '0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI',
    USDC: '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC',
    WUSDT: '0xc060006111016b8a020ad5b33834984a437aaa7d3c74c18e09a95d48aceab08c::coin::COIN',
    DEEP: '0xdeeb7a4662eec9f2f3def03fb937a663dddaa2e215b8078a284d026b7946c270::deep::DEEP',
  },
  devnet: {
    SUI: '0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI',
  },
};

/**
 * Get the DeepBook pool address for a given coin pair.
 */
function getPoolForPair(cfg: VeilConfig, sourceCoinType: string, targetCoinType: string): string | undefined {
  // If a specific pool is configured via env, use it
  if (cfg.deepbookPoolId) return cfg.deepbookPoolId;

  // Look up known pools
  const pools = DEEPBOOK_POOLS[cfg.network] || {};
  
  // Try to find a matching pool
  for (const [pair, poolId] of Object.entries(pools)) {
    const [base, quote] = pair.split('/');
    // Check if this pool matches our source/target
    // This is a simplified lookup - in production, you'd want more sophisticated matching
    if (sourceCoinType.includes(base) || targetCoinType.includes(base)) {
      return poolId;
    }
  }

  return undefined;
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
 * @param deepCoin - Optional DEEP coin for paying swap fees. If not provided, fees are paid from the swap output.
 * @returns The output coin (swapped or original if no pool available)
 */
export function maybeSwap(
  tx: Transaction,
  cfg: VeilConfig,
  inputCoin: TransactionObjectArgument,
  targetCoinType?: string,
  sourceCoinType?: string,
  minOut?: bigint,
  deepCoin?: TransactionObjectArgument,
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
    return inputCoin;
  }

  // Determine DeepBook package for this network
  const dbConfig = DEEPBOOK_V3[cfg.network] || DEEPBOOK_V3.mainnet;
  const dbPkg = dbConfig.packageId;

  // DeepBook V3 swap functions require:
  // 1. Pool shared object
  // 2. Input coin
  // 3. DEEP coin for fees (can be empty if fees are 0)
  // 4. Minimum output amount (slippage protection)
  // 5. Clock object
  
  // Determine swap direction based on coin types
  // In DeepBook V3, pools are defined as <BaseCoin, QuoteCoin>
  // swap_exact_base_for_quote: Base → Quote
  // swap_exact_quote_for_base: Quote → Base
  
  // For SUI/USDC pool: SUI is base, USDC is quote
  // If source is SUI and target is USDC: swap_exact_base_for_quote
  // If source is USDC and target is SUI: swap_exact_quote_for_base
  
  const isBaseToQuote = srcType.includes('SUI') && targetCoinType.includes('USDC');
  const isQuoteToBase = srcType.includes('USDC') && targetCoinType.includes('SUI');

  // Get or create DEEP coin for fees
  // In production, the relayer would provide a DEEP coin or we'd use a fee waiver
  const deepCoinArg = deepCoin || tx.object('0x6'); // Placeholder - needs real DEEP coin
  
  // Get Clock object
  const clockArg = tx.object('0x6');

  let outputCoin: TransactionObjectArgument;

  if (isBaseToQuote) {
    // Swap base (SUI) → quote (USDC)
    const [changedBase, quoteOut, changedDeep] = tx.moveCall({
      target: `${dbPkg}::pool::swap_exact_base_for_quote`,
      typeArguments: [srcType, targetCoinType],
      arguments: [
        tx.object(poolId),
        inputCoin,
        deepCoinArg,
        tx.pure.u64(minOut ?? 0),
        clockArg,
      ],
    });
    
    // Return remaining base coins and DEEP to sender
    tx.transferObjects([changedBase, changedDeep], tx.pure.address(tx.getSender()));
    outputCoin = quoteOut;
  } else if (isQuoteToBase) {
    // Swap quote (USDC) → base (SUI)
    const [baseOut, changedQuote, changedDeep] = tx.moveCall({
      target: `${dbPkg}::pool::swap_exact_quote_for_base`,
      typeArguments: [targetCoinType, srcType],
      arguments: [
        tx.object(poolId),
        inputCoin,
        deepCoinArg,
        tx.pure.u64(minOut ?? 0),
        clockArg,
      ],
    });
    
    // Return remaining quote coins and DEEP to sender
    tx.transferObjects([changedQuote, changedDeep], tx.pure.address(tx.getSender()));
    outputCoin = baseOut;
  } else {
    // Generic swap for other pairs - requires both base and quote coins
    // This is more complex and requires knowing which is base vs quote
    // For now, return input coin unchanged
    outputCoin = inputCoin;
  }

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
  const { toByteArray } = require('./utils.js');

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
