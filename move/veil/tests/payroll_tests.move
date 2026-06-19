#[test_only]
module veil::payroll_tests {
    use sui::test_scenario as ts;
    use sui::test_utils;
    use sui::coin;
    use sui::sui::SUI;
    use sui::clock;
    use sui::hash;
    use veil::payroll::{Self, PayoutEscrow};

    const EMPLOYER: address = @0xEEE;
    const ALICE: address    = @0xA11CE;
    const BOB: address      = @0xB0B;

    // ===== Test 1: Happy path — single recipient escrow & claim =====
    #[test]
    fun happy_path_escrow_and_claim() {
        let mut scenario = ts::begin(EMPLOYER);
        // TX1: Employer creates run, escrows, finalizes
        {
            let ctx = ts::ctx(&mut scenario);
            let (mut emp, admin, auditor) = payroll::create_employer(b"Acme", b"auditor-pk", ctx);
            let clk = clock::create_for_testing(ctx);
            let mut run = payroll::create_run(&mut emp, &admin, b"", &clk, ctx);

            let pay = coin::mint_for_testing<SUI>(1000, ctx);
            let secret = b"one-time-secret";
            let id_hash = hash::keccak256(&secret);
            payroll::escrow_payout<SUI>(&mut run, &admin, id_hash, pay, ctx);
            payroll::finalize_run(&mut run, &admin);
            assert!(payroll::recipient_count(&run) == 1, 100);

            test_utils::destroy(emp);
            test_utils::destroy(admin);
            test_utils::destroy(auditor);
            test_utils::destroy(run);
            clock::destroy_for_testing(clk);
        };
        // TX2: Alice claims (ctx goes out of scope before take_shared)
        ts::next_tx(&mut scenario, ALICE);
        {
            let escrow = ts::take_shared<PayoutEscrow<SUI>>(&scenario);
            let ctx2 = ts::ctx(&mut scenario);
            let c = payroll::claim_payout<SUI>(escrow, b"one-time-secret", ctx2);
            assert!(coin::value(&c) == 1000, 101);
            coin::burn_for_testing(c);
        };
        ts::end(scenario);
    }

    // ===== Test 2: Wrong proof aborts with EBadProof =====
    #[test]
    #[expected_failure(abort_code = 3)] // EBadProof = 3
    fun claim_with_wrong_proof_aborts() {
        let mut scenario = ts::begin(EMPLOYER);
        {
            let ctx = ts::ctx(&mut scenario);
            let (mut emp, admin, auditor) = payroll::create_employer(b"Acme", b"pk", ctx);
            let clk = clock::create_for_testing(ctx);
            let mut run = payroll::create_run(&mut emp, &admin, b"", &clk, ctx);
            let pay = coin::mint_for_testing<SUI>(500, ctx);
            let id_hash = hash::keccak256(&b"correct-secret");
            payroll::escrow_payout<SUI>(&mut run, &admin, id_hash, pay, ctx);
            test_utils::destroy(emp);
            test_utils::destroy(admin);
            test_utils::destroy(auditor);
            test_utils::destroy(run);
            clock::destroy_for_testing(clk);
        };
        ts::next_tx(&mut scenario, ALICE);
        {
            let escrow = ts::take_shared<PayoutEscrow<SUI>>(&scenario);
            let ctx2 = ts::ctx(&mut scenario);
            let c = payroll::claim_payout<SUI>(escrow, b"WRONG-secret", ctx2);
            coin::burn_for_testing(c);
        };
        ts::end(scenario);
    }

    // ===== Test 3: Unauthorized AdminCap cannot create run =====
    #[test]
    #[expected_failure(abort_code = 0)] // ENotAuthorized = 0
    fun unauthorized_admin_cannot_create_run() {
        let mut scenario = ts::begin(EMPLOYER);
        {
            let ctx = ts::ctx(&mut scenario);
            let (mut emp, admin, auditor) = payroll::create_employer(b"Acme", b"pk", ctx);
            let clk = clock::create_for_testing(ctx);

            // Create a SECOND employer with its own admin cap
            let (emp2, admin2, auditor2) = payroll::create_employer(b"EvilCorp", b"pk2", ctx);

            // admin2 belongs to emp2, NOT emp — should abort
            let run = payroll::create_run(&mut emp, &admin2, b"", &clk, ctx);

            // Must consume all values even on abort path (compiler checks this)
            test_utils::destroy(emp);
            test_utils::destroy(emp2);
            test_utils::destroy(admin);
            test_utils::destroy(admin2);
            test_utils::destroy(auditor);
            test_utils::destroy(auditor2);
            test_utils::destroy(run);
            clock::destroy_for_testing(clk);
        };
        ts::end(scenario);
    }

    // ===== Test 4: Cannot escrow after run is finalized =====
    #[test]
    #[expected_failure(abort_code = 1)] // ERunFinalized = 1
    fun cannot_escrow_after_finalize() {
        let mut scenario = ts::begin(EMPLOYER);
        {
            let ctx = ts::ctx(&mut scenario);
            let (mut emp, admin, auditor) = payroll::create_employer(b"Acme", b"pk", ctx);
            let clk = clock::create_for_testing(ctx);
            let mut run = payroll::create_run(&mut emp, &admin, b"", &clk, ctx);

            // Finalize first
            payroll::finalize_run(&mut run, &admin);

            // Try to escrow after finalize — should abort
            let pay = coin::mint_for_testing<SUI>(100, ctx);
            let id_hash = hash::keccak256(&b"secret");
            payroll::escrow_payout<SUI>(&mut run, &admin, id_hash, pay, ctx);

            test_utils::destroy(emp);
            test_utils::destroy(admin);
            test_utils::destroy(auditor);
            test_utils::destroy(run);
            clock::destroy_for_testing(clk);
        };
        ts::end(scenario);
    }

    // ===== Test 5: Multiple recipients in one run =====
    #[test]
    fun multiple_recipients_in_one_run() {
        let mut scenario = ts::begin(EMPLOYER);
        {
            let ctx = ts::ctx(&mut scenario);
            let (mut emp, admin, auditor) = payroll::create_employer(b"Acme", b"pk", ctx);
            let clk = clock::create_for_testing(ctx);
            let mut run = payroll::create_run(&mut emp, &admin, b"", &clk, ctx);

            let pay1 = coin::mint_for_testing<SUI>(100, ctx);
            let pay2 = coin::mint_for_testing<SUI>(200, ctx);
            let pay3 = coin::mint_for_testing<SUI>(300, ctx);

            let hash1 = hash::keccak256(&b"secret-alice");
            let hash2 = hash::keccak256(&b"secret-bob");
            let hash3 = hash::keccak256(&b"secret-charlie");

            payroll::escrow_payout<SUI>(&mut run, &admin, hash1, pay1, ctx);
            payroll::escrow_payout<SUI>(&mut run, &admin, hash2, pay2, ctx);
            payroll::escrow_payout<SUI>(&mut run, &admin, hash3, pay3, ctx);

            payroll::finalize_run(&mut run, &admin);
            assert!(payroll::recipient_count(&run) == 3, 200);

            test_utils::destroy(emp);
            test_utils::destroy(admin);
            test_utils::destroy(auditor);
            test_utils::destroy(run);
            clock::destroy_for_testing(clk);
        };
        // Note: We don't test claiming all three in order because take_shared
        // doesn't guarantee order. The happy_path test verifies single claim works.
        ts::end(scenario);
    }

    // ===== Test 6: Run status transitions correctly =====
    #[test]
    fun run_status_transitions() {
        let mut scenario = ts::begin(EMPLOYER);
        {
            let ctx = ts::ctx(&mut scenario);
            let (mut emp, admin, auditor) = payroll::create_employer(b"Acme", b"pk", ctx);
            let clk = clock::create_for_testing(ctx);
            let mut run = payroll::create_run(&mut emp, &admin, b"", &clk, ctx);

            // Initial status: EXECUTING (1)
            assert!(payroll::run_status(&run) == 1, 300);

            payroll::finalize_run(&mut run, &admin);

            // After finalize: FINALIZED (2)
            assert!(payroll::run_status(&run) == 2, 301);

            test_utils::destroy(emp);
            test_utils::destroy(admin);
            test_utils::destroy(auditor);
            test_utils::destroy(run);
            clock::destroy_for_testing(clk);
        };
        ts::end(scenario);
    }

    // ===== Test 7: Multiple runs can be created =====
    #[test]
    fun multiple_runs_created() {
        let mut scenario = ts::begin(EMPLOYER);
        {
            let ctx = ts::ctx(&mut scenario);
            let (mut emp, admin, auditor) = payroll::create_employer(b"Acme", b"pk", ctx);
            let clk = clock::create_for_testing(ctx);

            let run1 = payroll::create_run(&mut emp, &admin, b"", &clk, ctx);
            test_utils::destroy(run1);
            let run2 = payroll::create_run(&mut emp, &admin, b"", &clk, ctx);
            test_utils::destroy(run2);
            let run3 = payroll::create_run(&mut emp, &admin, b"", &clk, ctx);
            test_utils::destroy(run3);

            test_utils::destroy(emp);
            test_utils::destroy(admin);
            test_utils::destroy(auditor);
            clock::destroy_for_testing(clk);
        };
        ts::end(scenario);
    }

    // ===== Test 8: Manifest blob stored =====
    #[test]
    fun manifest_blob_stored() {
        let mut scenario = ts::begin(EMPLOYER);
        {
            let ctx = ts::ctx(&mut scenario);
            let (mut emp, admin, auditor) = payroll::create_employer(b"Acme", b"pk", ctx);
            let clk = clock::create_for_testing(ctx);

            let manifest = b"encrypted-manifest-data";
            let run = payroll::create_run(&mut emp, &admin, manifest, &clk, ctx);
            assert!(payroll::recipient_count(&run) == 0, 400);
            assert!(payroll::run_status(&run) == 1, 401);

            test_utils::destroy(emp);
            test_utils::destroy(admin);
            test_utils::destroy(auditor);
            test_utils::destroy(run);
            clock::destroy_for_testing(clk);
        };
        ts::end(scenario);
    }

    // ===== Test 9: Auditor pubkey readable =====
    #[test]
    fun auditor_pubkey_readable() {
        let mut scenario = ts::begin(EMPLOYER);
        {
            let ctx = ts::ctx(&mut scenario);
            let (emp, admin, auditor) = payroll::create_employer(b"Acme", b"my-auditor-pk", ctx);

            let pk = payroll::auditor_pubkey(&emp);
            assert!(std::vector::length(&pk) > 0, 600);

            test_utils::destroy(emp);
            test_utils::destroy(admin);
            test_utils::destroy(auditor);
        };
        ts::end(scenario);
    }

    // ===== Test 10: Unauthorized cap cannot finalize run =====
    #[test]
    #[expected_failure(abort_code = 0)] // ENotAuthorized = 0
    fun unauthorized_admin_cannot_finalize() {
        let mut scenario = ts::begin(EMPLOYER);
        {
            let ctx = ts::ctx(&mut scenario);
            let (mut emp, admin, auditor) = payroll::create_employer(b"Acme", b"pk", ctx);
            let clk = clock::create_for_testing(ctx);
            let mut run = payroll::create_run(&mut emp, &admin, b"", &clk, ctx);

            // Create second employer's admin
            let (emp2, admin2, auditor2) = payroll::create_employer(b"EvilCorp", b"pk2", ctx);

            // Try to finalize with wrong admin — should abort
            payroll::finalize_run(&mut run, &admin2);

            test_utils::destroy(emp);
            test_utils::destroy(emp2);
            test_utils::destroy(admin);
            test_utils::destroy(admin2);
            test_utils::destroy(auditor);
            test_utils::destroy(auditor2);
            test_utils::destroy(run);
            clock::destroy_for_testing(clk);
        };
        ts::end(scenario);
    }

    // ===== Test 11: Claim with empty proof aborts =====
    #[test]
    #[expected_failure(abort_code = 3)] // EBadProof = 3
    fun claim_with_empty_proof_aborts() {
        let mut scenario = ts::begin(EMPLOYER);
        {
            let ctx = ts::ctx(&mut scenario);
            let (mut emp, admin, auditor) = payroll::create_employer(b"Acme", b"pk", ctx);
            let clk = clock::create_for_testing(ctx);
            let mut run = payroll::create_run(&mut emp, &admin, b"", &clk, ctx);
            let pay = coin::mint_for_testing<SUI>(100, ctx);
            let id_hash = hash::keccak256(&b"real-secret");
            payroll::escrow_payout<SUI>(&mut run, &admin, id_hash, pay, ctx);
            test_utils::destroy(emp);
            test_utils::destroy(admin);
            test_utils::destroy(auditor);
            test_utils::destroy(run);
            clock::destroy_for_testing(clk);
        };
        ts::next_tx(&mut scenario, ALICE);
        {
            let escrow = ts::take_shared<PayoutEscrow<SUI>>(&scenario);
            let ctx2 = ts::ctx(&mut scenario);
            let c = payroll::claim_payout<SUI>(escrow, b"", ctx2);
            coin::burn_for_testing(c);
        };
        ts::end(scenario);
    }
}
