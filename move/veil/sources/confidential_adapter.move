/// Integration boundary for Confidential Transfers (Sui public beta).
///
/// FALLBACK MODE (current — builds & runs today): payouts use standard `Coin<T>`;
/// `withdraw_for_payout` simply splits the funding coin. Amounts are visible on-chain.
///
/// CONFIDENTIAL MODE (W1): replace ONLY the body of `withdraw_for_payout` with a
/// confidential-balance withdrawal from the official beta package
/// (github.com/MystenLabs/confidential-transfers), keeping the SAME signature so
/// `veil::payroll` does not change. The plaintext `amount` becomes an encrypted
/// amount + range proof; amounts stay hidden on-chain. Veil never emits an amount.
///
/// INTEGRATION CHECKLIST (W1):
/// 1. Import the official confidential_transfers package (add to Move.toml dependencies)
/// 2. Replace `coin::split` with the confidential withdrawal primitive
/// 3. Ensure the employer holds a confidential balance (not a standard Coin)
/// 4. Verify that PayoutEscrow can hold confidential balances (may need Plan B/C from §9.1)
/// 5. Test with the official beta test suite
module veil::confidential_adapter {
    use sui::coin::{Self, Coin};

    /// Split `amount` out of `source` for a single payout.
    ///
    /// FALLBACK: Standard coin split (amounts visible).
    /// CONFIDENTIAL: Withdraw from confidential balance (amounts hidden).
    ///
    /// The signature remains identical in both modes so `veil::payroll` requires
    /// no changes when switching to confidential mode.
    public fun withdraw_for_payout<T>(
        source: &mut Coin<T>,
        amount: u64,
        ctx: &mut TxContext,
    ): Coin<T> {
        // ===== FALLBACK MODE =====
        // Standard coin split — amounts are visible on-chain
        coin::split(source, amount, ctx)

        // ===== CONFIDENTIAL MODE (W1) =====
        // Replace the above line with:
        //
        // use confidential_transfers::confidential_coin;
        // use confidential_transfers::range_proof;
        //
        // // Withdraw from confidential balance with range proof
        // let (confidential_coin, proof) = confidential_coin::withdraw_with_proof(
        //     source,
        //     amount,
        //     ctx,
        // );
        //
        // // Verify the range proof (ensures amount is non-negative and within bounds)
        // range_proof::verify(proof, ctx);
        //
        // confidential_coin
    }

    /// Check if confidential mode is available.
    /// Returns true if the confidential transfers beta is wired up.
    ///
    /// FALLBACK: Always returns false.
    /// CONFIDENTIAL: Returns true after W1 integration.
    public fun is_confidential_mode(): bool {
        false
        // CONFIDENTIAL: true (after W1 integration)
    }
}
