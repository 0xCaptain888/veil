/// Veil — confidential payroll & cross-border payout rail (Sui).
///
/// BUILD MODE NOTE
/// ---------------
/// This module uses standard `Coin<T>` so the project compiles and runs end-to-end
/// today (fallback mode). Confidentiality is added by routing coin flows through
/// `veil::confidential_adapter` and wiring it to the official Confidential Transfers
/// beta in W1 — WITHOUT changing this module's API.
///
/// PRIVACY INVARIANT (holds in BOTH modes): no on-chain event ever carries an amount.
module veil::payroll {
    // Move 2024 edition implicitly imports: sui::object::{Self, ID, UID},
    // sui::transfer, sui::tx_context::{Self, TxContext}, std::option::{Self, Option},
    // std::vector. Re-importing them errors with "duplicate alias", so we only
    // declare the NON-implicit modules here. (If you build on an older toolchain
    // that lacks these implicit aliases, add the three lines back — see README.)
    use sui::coin::{Self, Coin};
    use sui::balance::Balance;
    use sui::clock::{Self, Clock};
    use sui::event;
    use sui::hash;

    // ===== Errors =====
    const ENotAuthorized: u64 = 0;
    const ERunFinalized: u64  = 1;
    const EAlreadyClaimed: u64 = 2;
    const EBadProof: u64      = 3;

    // ===== Run status =====
    const STATUS_EXECUTING: u8 = 1;
    const STATUS_FINALIZED: u8 = 2;

    // ===== Capabilities (fine-grained authorization) =====
    public struct AdminCap   has key, store { id: UID, employer: ID }
    public struct AuditorCap has key, store { id: UID, employer: ID }

    // ===== Core objects =====
    public struct Employer has key {
        id: UID,
        owner: address,
        name: vector<u8>,
        auditor_pubkey: vector<u8>, // auditor's pubkey for scoped decryption
        runs_created: u64,
    }

    /// `store` is required so the PTB can `transferObjects([run], employer)` after
    /// finalize (TransferObjects uses public_transfer, which needs key + store).
    public struct PayrollRun has key, store {
        id: UID,
        employer: ID,
        status: u8,
        recipient_count: u64,
        manifest_blob: Option<vector<u8>>, // Walrus blob id of encrypted run manifest
        created_at_ms: u64,
    }

    /// Claimable payout, SHARED until the recipient onboards (zkLogin) and claims.
    /// In confidential mode, `funds: Balance<T>` becomes a confidential balance handle.
    /// Type parameter `T` must have `store` ability (all coin types do).
    public struct PayoutEscrow<phantom T> has key, store {
        id: UID,
        run: ID,
        recipient_id_hash: vector<u8>,
        funds: Balance<T>,
        status: u8, // 0 pending, 1 claimed
    }

    public struct Payslip has key, store {
        id: UID,
        run: ID,
        recipient: address,
        payslip_blob: vector<u8>, // Walrus blob id, Seal-encrypted
    }

    // ===== Events (NEVER carry amounts) =====
    public struct RunCreated     has copy, drop { run: ID, employer: ID }
    public struct PayoutEscrowed has copy, drop { run: ID, escrow: ID, recipient_id_hash: vector<u8> }
    public struct PayoutClaimed  has copy, drop { run: ID, escrow: ID, recipient: address }
    public struct RunFinalized   has copy, drop { run: ID, recipient_count: u64 }

    // ===== Employer onboarding =====
    public fun create_employer(
        name: vector<u8>,
        auditor_pubkey: vector<u8>,
        ctx: &mut TxContext,
    ): (Employer, AdminCap, AuditorCap) {
        let emp = Employer {
            id: object::new(ctx),
            owner: tx_context::sender(ctx),
            name,
            auditor_pubkey,
            runs_created: 0,
        };
        let eid = object::id(&emp);
        let admin   = AdminCap   { id: object::new(ctx), employer: eid };
        let auditor = AuditorCap { id: object::new(ctx), employer: eid };
        (emp, admin, auditor)
    }

    /// Entry convenience: create an employer and send the objects/caps to the sender.
    #[allow(lint(public_entry))]
    public entry fun register(name: vector<u8>, auditor_pubkey: vector<u8>, ctx: &mut TxContext) {
        let (emp, admin, auditor) = create_employer(name, auditor_pubkey, ctx);
        let who = tx_context::sender(ctx);
        transfer::transfer(emp, who);
        transfer::public_transfer(admin, who);
        transfer::public_transfer(auditor, who);
    }

    // ===== Payroll run lifecycle =====
    public fun create_run(
        emp: &mut Employer,
        cap: &AdminCap,
        manifest_blob: vector<u8>, // empty vector = none
        clock: &Clock,
        ctx: &mut TxContext,
    ): PayrollRun {
        assert!(cap.employer == object::id(emp), ENotAuthorized);
        emp.runs_created = emp.runs_created + 1;
        let manifest = if (std::vector::length(&manifest_blob) == 0) {
            std::option::none<vector<u8>>()
        } else {
            std::option::some(manifest_blob)
        };
        let run = PayrollRun {
            id: object::new(ctx),
            employer: object::id(emp),
            status: STATUS_EXECUTING,
            recipient_count: 0,
            manifest_blob: manifest,
            created_at_ms: clock::timestamp_ms(clock),
        };
        event::emit(RunCreated { run: object::id(&run), employer: object::id(emp) });
        run
    }

    /// Escrow one payout (called once per recipient inside a PTB).
    /// `payment` is the fallback coin; confidential mode supplies a hidden-amount
    /// withdrawal via veil::confidential_adapter. Escrow is shared so a DIFFERENT
    /// address (the recipient, after zkLogin) can claim it.
    public fun escrow_payout<T>(
        run: &mut PayrollRun,
        cap: &AdminCap,
        recipient_id_hash: vector<u8>,
        payment: Coin<T>,
        ctx: &mut TxContext,
    ) {
        assert!(cap.employer == run.employer, ENotAuthorized);
        assert!(run.status == STATUS_EXECUTING, ERunFinalized);
        run.recipient_count = run.recipient_count + 1;
        let escrow = PayoutEscrow<T> {
            id: object::new(ctx),
            run: object::id(run),
            recipient_id_hash,
            funds: coin::into_balance(payment),
            status: 0,
        };
        event::emit(PayoutEscrowed {
            run: object::id(run),
            escrow: object::id(&escrow),
            recipient_id_hash,
        });
        transfer::public_share_object(escrow);
    }

    public fun finalize_run(run: &mut PayrollRun, cap: &AdminCap) {
        assert!(cap.employer == run.employer, ENotAuthorized);
        run.status = STATUS_FINALIZED;
        event::emit(RunFinalized { run: object::id(run), recipient_count: run.recipient_count });
    }

    // ===== Recipient claim (relayer sponsors gas) =====
    /// `proof_of_id` is the one-time claim secret; keccak256(proof) must equal the
    /// escrow's recipient_id_hash. Returns the Coin to the PTB so the SDK can
    /// optionally route it through a DeepBook FX swap before delivery.
    public fun claim_payout<T>(
        escrow: PayoutEscrow<T>,
        proof_of_id: vector<u8>,
        ctx: &mut TxContext,
    ): Coin<T> {
        let escrow_id = object::id(&escrow);
        let PayoutEscrow { id, run, recipient_id_hash, funds, status } = escrow;
        assert!(status == 0, EAlreadyClaimed);
        assert!(hash::keccak256(&proof_of_id) == recipient_id_hash, EBadProof);
        object::delete(id);
        event::emit(PayoutClaimed { run, escrow: escrow_id, recipient: tx_context::sender(ctx) });
        coin::from_balance(funds, ctx)
    }

    /// Entry wrapper: claim and deliver straight to the sender (no FX).
    #[allow(lint(public_entry))]
    public entry fun claim_to_sender<T>(
        escrow: PayoutEscrow<T>,
        proof_of_id: vector<u8>,
        ctx: &mut TxContext,
    ) {
        let c = claim_payout<T>(escrow, proof_of_id, ctx);
        transfer::public_transfer(c, tx_context::sender(ctx));
    }

    // ===== Payslip (encrypted blob ref on Walrus) =====
    #[allow(lint(public_entry))]
    public entry fun issue_payslip(
        run: &PayrollRun,
        cap: &AdminCap,
        recipient: address,
        payslip_blob: vector<u8>,
        ctx: &mut TxContext,
    ) {
        assert!(cap.employer == run.employer, ENotAuthorized);
        let slip = Payslip {
            id: object::new(ctx),
            run: object::id(run),
            recipient,
            payslip_blob,
        };
        transfer::public_transfer(slip, recipient);
    }

    // ===== Read helpers =====
    public fun run_status(run: &PayrollRun): u8 { run.status }
    public fun recipient_count(run: &PayrollRun): u64 { run.recipient_count }
    public fun auditor_pubkey(emp: &Employer): vector<u8> { emp.auditor_pubkey }
}
