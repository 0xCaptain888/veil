import { Transaction } from '@mysten/sui/transactions';
import type { VeilConfig, RecipientInput } from './types.js';
import { toByteArray } from './utils.js';

/**
 * Build the payroll-run PTB (atomic, all-or-nothing):
 *   create_run -> [per recipient: confidential_adapter::withdraw_for_payout -> payroll::escrow_payout] -> finalize_run
 * Signed by the employer (owns Employer, AdminCap, funding Coin<stable>).
 */
export function buildExecuteRunTx(params: {
  cfg: VeilConfig;
  employerAddress: string;
  employerObjectId: string;
  adminCapId: string;
  fundingCoinId: string;
  recipients: RecipientInput[];
  manifestBlob?: Uint8Array;
}): Transaction {
  const { cfg, employerAddress, employerObjectId, adminCapId, fundingCoinId, recipients, manifestBlob } = params;
  if (recipients.length === 0) throw new Error('no recipients');
  const pkg = cfg.packageId;
  const tx = new Transaction();
  const clock = tx.object('0x6');

  const run = tx.moveCall({
    target: `${pkg}::payroll::create_run`,
    arguments: [
      tx.object(employerObjectId),
      tx.object(adminCapId),
      tx.pure.vector('u8', manifestBlob ? toByteArray(manifestBlob) : []),
      clock,
    ],
  });

  const source = tx.object(fundingCoinId);
  for (const r of recipients) {
    const piece = tx.moveCall({
      target: `${pkg}::confidential_adapter::withdraw_for_payout`,
      typeArguments: [cfg.stableCoinType],
      arguments: [source, tx.pure.u64(r.amount)],
    });
    tx.moveCall({
      target: `${pkg}::payroll::escrow_payout`,
      typeArguments: [cfg.stableCoinType],
      arguments: [run, tx.object(adminCapId), tx.pure.vector('u8', toByteArray(r.idHash)), piece],
    });
  }

  tx.moveCall({ target: `${pkg}::payroll::finalize_run`, arguments: [run, tx.object(adminCapId)] });
  tx.transferObjects([run], tx.pure.address(employerAddress));
  return tx;
}

/** Build a claim tx (recipient is the sender; relayer sponsors gas). No FX. */
export function buildClaimToSenderTx(params: { cfg: VeilConfig; escrowId: string; secret: Uint8Array }): Transaction {
  const { cfg, escrowId, secret } = params;
  const tx = new Transaction();
  tx.moveCall({
    target: `${cfg.packageId}::payroll::claim_to_sender`,
    typeArguments: [cfg.stableCoinType],
    arguments: [tx.object(escrowId), tx.pure.vector('u8', toByteArray(secret))],
  });
  return tx;
}
