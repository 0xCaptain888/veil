import { Router } from 'express';
import { Transaction } from '@mysten/sui/transactions';
import { loadConfig } from '../config.js';
import { relayerExecute } from '../sui.js';
import { store } from '../store.js';
import { toByteArray } from '@veil/sdk';

export const claimsRouter = Router();

/**
 * Get claim info for a token (public endpoint — needed for the claim page to display info).
 */
claimsRouter.get('/:token', (req, res) => {
  const t = store.getToken(req.params.token);
  if (!t) return res.status(404).json({ error: 'unknown token' });
  res.json({
    email: t.email,
    displayAmount: t.displayAmount,
    targetCoinType: t.targetCoinType,
    status: t.status,
  });
});

/**
 * Execute the claim. Relayer pays gas and delivers funds to recipientAddress.
 *
 * Production path (W3): recipient signs via zkLogin, relayer only sponsors gas.
 * Current path: relayer executes on behalf of recipient (demo mode).
 *
 * Body: {
 *   recipientAddress: string,
 *   targetCoinType?: string (optional override for FX swap)
 * }
 */
claimsRouter.post('/:token/claim', async (req, res) => {
  const t = store.getToken(req.params.token);
  if (!t) return res.status(404).json({ error: 'unknown token' });
  if (t.status === 'claimed') return res.status(409).json({ error: 'already claimed' });

  const recipient = req.body?.recipientAddress;
  if (!recipient) return res.status(400).json({ error: 'recipientAddress required' });

  try {
    const cfg = loadConfig();
    const tx = new Transaction();

    // Step 1: Claim the payout from escrow
    const claimedCoin = tx.moveCall({
      target: `${cfg.packageId}::payroll::claim_payout`,
      typeArguments: [cfg.stableCoinType],
      arguments: [tx.object(t.escrowId), tx.pure.vector('u8', t.secret)],
    });

    // Step 2: Optional DeepBook FX swap (W4)
    const targetCoinType = req.body?.targetCoinType || t.targetCoinType;
    let outputCoin = claimedCoin;

    if (targetCoinType && targetCoinType !== cfg.stableCoinType && cfg.deepbookPoolId) {
      // Import maybeSwap dynamically to avoid circular dependencies
      const { maybeSwap } = await import('@veil/sdk');
      outputCoin = maybeSwap(tx, cfg, claimedCoin, targetCoinType, cfg.stableCoinType);
    }

    // Step 3: Transfer to recipient
    tx.transferObjects([outputCoin], tx.pure.address(recipient));

    const result = await relayerExecute(tx);
    store.markClaimed(req.params.token, recipient, result.digest);

    res.json({
      digest: result.digest,
      swapped: targetCoinType && targetCoinType !== cfg.stableCoinType && cfg.deepbookPoolId,
      targetCoinType: targetCoinType || cfg.stableCoinType,
    });
  } catch (e: any) {
    console.error('[claims] Claim failed:', e);
    res.status(500).json({ error: String(e?.message ?? e) });
  }
});
