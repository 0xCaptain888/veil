import { Router } from 'express';
import { Transaction } from '@mysten/sui/transactions';
import { loadConfig } from '../config.js';
import { relayerExecute, buildClaimTransaction, sponsorAndExecute } from '../sui.js';
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

/**
 * Build a claim transaction for the recipient to sign (sponsored transaction flow).
 * This is the first step in the production W3 path.
 *
 * Body: {
 *   recipientAddress: string,
 *   targetCoinType?: string
 * }
 *
 * Returns: { txBytes: string, gasBudget: number }
 */
claimsRouter.post('/:token/build', async (req, res) => {
  const t = store.getToken(req.params.token);
  if (!t) return res.status(404).json({ error: 'unknown token' });
  if (t.status === 'claimed') return res.status(409).json({ error: 'already claimed' });

  const recipient = req.body?.recipientAddress;
  if (!recipient) return res.status(400).json({ error: 'recipientAddress required' });

  try {
    const targetCoinType = req.body?.targetCoinType || t.targetCoinType;
    
    const result = await buildClaimTransaction({
      escrowId: t.escrowId,
      secret: t.secret,
      recipientAddress: recipient,
      targetCoinType: targetCoinType,
    });

    res.json({
      ...result,
      swapped: targetCoinType && targetCoinType !== loadConfig().stableCoinType && !!loadConfig().deepbookPoolId,
      targetCoinType: targetCoinType || loadConfig().stableCoinType,
    });
  } catch (e: any) {
    console.error('[claims] Build transaction failed:', e);
    res.status(500).json({ error: String(e?.message ?? e) });
  }
});

/**
 * Execute a sponsored claim: recipient has already signed, relayer sponsors gas.
 * This is the second step in the production W3 path.
 *
 * Body: {
 *   txBytes: string (base64),
 *   signature: string (base64)
 * }
 *
 * Returns: { digest: string }
 */
claimsRouter.post('/:token/execute-sponsored', async (req, res) => {
  const t = store.getToken(req.params.token);
  if (!t) return res.status(404).json({ error: 'unknown token' });
  if (t.status === 'claimed') return res.status(409).json({ error: 'already claimed' });

  const { txBytes, signature } = req.body ?? {};
  if (!txBytes || !signature) {
    return res.status(400).json({ error: 'txBytes and signature required' });
  }

  try {
    const result = await sponsorAndExecute({ txBytes, signature });
    
    // Extract recipient from the transaction (we need to track this)
    // For now, we'll use a placeholder - in production, parse from txBytes
    const recipient = 'sponsored-recipient'; // TODO: extract from tx
    
    store.markClaimed(req.params.token, recipient, result.digest);

    res.json({ digest: result.digest });
  } catch (e: any) {
    console.error('[claims] Sponsored execution failed:', e);
    res.status(500).json({ error: String(e?.message ?? e) });
  }
});
