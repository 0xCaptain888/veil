import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import type { Transaction } from '@mysten/sui/transactions';
import type { VeilConfig } from './types.js';
import { buildExecuteRunTx, buildClaimToSenderTx } from './ptb.js';

export class VeilClient {
  readonly cfg: VeilConfig;
  readonly sui: SuiClient;

  constructor(cfg: VeilConfig) {
    this.cfg = cfg;
    this.sui = new SuiClient({ url: cfg.fullnodeUrl ?? getFullnodeUrl(cfg.network) });
  }

  buildExecuteRun(params: Omit<Parameters<typeof buildExecuteRunTx>[0], 'cfg'>): Transaction {
    return buildExecuteRunTx({ cfg: this.cfg, ...params });
  }

  buildClaim(params: { escrowId: string; secret: Uint8Array }): Transaction {
    return buildClaimToSenderTx({ cfg: this.cfg, ...params });
  }

  /** List a recipient's payslips (objects of type `${pkg}::payroll::Payslip`). */
  async getPayslips(owner: string) {
    return this.sui.getOwnedObjects({
      owner,
      filter: { StructType: `${this.cfg.packageId}::payroll::Payslip` },
      options: { showContent: true },
    });
  }
}
