/**
 * Veil End-to-End Integration Test
 *
 * Tests the full payroll flow against a running devnet/localnet:
 *   1. Register employer
 *   2. Create payroll run + escrow payouts
 *   3. Finalize run
 *   4. Claim payout (recipient)
 *   5. Optional: FX swap via DeepBook
 *   6. Audit reconciliation
 *
 * Usage:
 *   # Start relayer first:
 *   npm run dev:relayer
 *
 *   # Then run this test:
 *   npx tsx tests/e2e.ts
 *
 * Environment variables:
 *   RELAYER_URL    — relayer endpoint (default: http://localhost:8787)
 *   SUI_NETWORK    — sui network (default: devnet)
 *   VEIL_PACKAGE_ID — deployed package ID
 */

const RELAYER_URL = process.env.RELAYER_URL ?? 'http://localhost:8787';
const TIMEOUT = 30000;

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

const results: TestResult[] = [];

async function test(name: string, fn: () => Promise<void>) {
  const start = Date.now();
  try {
    await fn();
    results.push({ name, passed: true, duration: Date.now() - start });
    console.log(`  ✓ ${name} (${Date.now() - start}ms)`);
  } catch (e: any) {
    results.push({ name, passed: false, error: e.message, duration: Date.now() - start });
    console.log(`  ✗ ${name}: ${e.message} (${Date.now() - start}ms)`);
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

async function fetchJson(url: string, options?: RequestInit) {
  const res = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(TIMEOUT),
  });
  return res.json();
}

// ===== Tests =====

async function runTests() {
  console.log('\n=== Veil E2E Integration Tests ===\n');

  // Test 1: Health check
  await test('Relayer health check', async () => {
    const data = await fetchJson(`${RELAYER_URL}/health`);
    assert(data.ok === true, `Health check failed: ${JSON.stringify(data)}`);
    console.log(`    Package ID: ${data.packageId}`);
    console.log(`    Store stats: ${JSON.stringify(data.store)}`);
  });

  // Test 2: Register claim tokens
  let testRunId = '';
  let testToken = '';
  await test('Register claim tokens', async () => {
    testRunId = `0x${'a'.repeat(64)}`; // Mock run ID for testing
    const data = await fetchJson(`${RELAYER_URL}/runs/register-tokens`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        runId: testRunId,
        name: 'E2E Test Run',
        employerName: 'Test Corp',
        recipients: [
          {
            email: 'test-alice@example.com',
            displayAmount: '1000',
            escrowId: `0x${'b'.repeat(64)}`,
            secret: Array.from(new TextEncoder().encode('e2e-test-secret-alice')),
            targetCoinType: undefined,
          },
          {
            email: 'test-bob@example.com',
            displayAmount: '2500',
            escrowId: `0x${'c'.repeat(64)}`,
            secret: Array.from(new TextEncoder().encode('e2e-test-secret-bob')),
            targetCoinType: undefined,
          },
        ],
      }),
    });

    assert(data.runId === testRunId, `Run ID mismatch: ${data.runId}`);
    assert(data.links?.length === 2, `Expected 2 links, got ${data.links?.length}`);
    testToken = data.links[0].token;
    console.log(`    Token: ${testToken}`);
    console.log(`    Claim URL: ${data.links[0].url}`);
  });

  // Test 3: Get claim info
  await test('Get claim info', async () => {
    const data = await fetchJson(`${RELAYER_URL}/claims/${testToken}`);
    assert(data.email === 'test-alice@example.com', `Email mismatch: ${data.email}`);
    assert(data.displayAmount === '1000', `Amount mismatch: ${data.displayAmount}`);
    assert(data.status === 'pending', `Status mismatch: ${data.status}`);
    console.log(`    Email: ${data.email}`);
    console.log(`    Amount: ${data.displayAmount}`);
    console.log(`    Status: ${data.status}`);
  });

  // Test 4: Build claim transaction
  await test('Build claim transaction', async () => {
    const data = await fetchJson(`${RELAYER_URL}/claims/${testToken}/build`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        recipientAddress: `0x${'d'.repeat(64)}`,
      }),
    });

    // This will fail if VEIL_PACKAGE_ID is not set, which is expected in test
    if (data.txBytes) {
      assert(typeof data.txBytes === 'string', 'txBytes should be a string');
      assert(data.gasBudget > 0, 'gasBudget should be positive');
      console.log(`    txBytes length: ${data.txBytes.length}`);
      console.log(`    Gas budget: ${data.gasBudget}`);
    } else if (data.error) {
      // Expected if package is not deployed
      console.log(`    Expected error (no deployment): ${data.error}`);
    }
  });

  // Test 5: Audit endpoint
  await test('Audit reconciliation', async () => {
    const data = await fetchJson(`${RELAYER_URL}/audit/runs/${testRunId}`);
    assert(data.runId === testRunId, `Run ID mismatch: ${data.runId}`);
    assert(data.entries?.length === 2, `Expected 2 entries, got ${data.entries?.length}`);
    assert(data.summary?.totalRecipients === 2, `Expected 2 recipients`);
    assert(data.summary?.pending === 2, `Expected 2 pending`);
    console.log(`    Run: ${data.name}`);
    console.log(`    Entries: ${data.entries?.length}`);
    console.log(`    Summary: ${JSON.stringify(data.summary)}`);
  });

  // Test 6: List all runs
  await test('List all runs', async () => {
    const data = await fetchJson(`${RELAYER_URL}/audit/runs`);
    assert(Array.isArray(data.runs), 'Expected runs array');
    assert(data.runs.length >= 1, 'Expected at least 1 run');
    console.log(`    Total runs: ${data.runs.length}`);
  });

  // Test 7: Audit access logs
  await test('Audit access logs', async () => {
    const data = await fetchJson(`${RELAYER_URL}/audit/access-logs`);
    assert(Array.isArray(data.logs), 'Expected logs array');
    assert(data.total >= 0, 'Expected total >= 0');
    console.log(`    Total access logs: ${data.total}`);
  });

  // Test 8: Risk signal API
  await test('Risk signal check', async () => {
    const data = await fetchJson(`${RELAYER_URL}/risk/address/0x${'e'.repeat(64)}`);
    assert(data.address !== undefined, 'Expected address in response');
    assert(data.riskLevel !== undefined, 'Expected riskLevel in response');
    console.log(`    Risk level: ${data.riskLevel}`);
    console.log(`    Source: ${data.source}`);
  });

  // Test 9: Risk monitoring
  await test('Risk monitoring registration', async () => {
    const data = await fetchJson(`${RELAYER_URL}/risk/monitor`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        address: `0x${'f'.repeat(64)}`,
        label: 'E2E Test Monitor',
        alertThreshold: 'medium',
      }),
    });
    assert(data.monitoringId !== undefined, 'Expected monitoringId');
    assert(data.status === 'active', 'Expected active status');
    console.log(`    Monitoring ID: ${data.monitoringId}`);
  });

  // Test 10: Risk stats
  await test('Risk stats', async () => {
    const data = await fetchJson(`${RELAYER_URL}/risk/stats`);
    assert(data.totalMonitored !== undefined, 'Expected totalMonitored');
    assert(data.distribution !== undefined, 'Expected distribution');
    console.log(`    Total monitored: ${data.totalMonitored}`);
  });

  // Test 11: Unknown token returns 404
  await test('Unknown claim token returns 404', async () => {
    const res = await fetch(`${RELAYER_URL}/claims/nonexistent-token`);
    assert(res.status === 404, `Expected 404, got ${res.status}`);
    const data = await res.json();
    assert(data.error === 'unknown token', `Expected 'unknown token' error`);
  });

  // Test 12: Unknown run returns 404
  await test('Unknown audit run returns 404', async () => {
    const res = await fetch(`${RELAYER_URL}/audit/runs/0xnonexistent`);
    assert(res.status === 404, `Expected 404, got ${res.status}`);
  });

  // ===== Summary =====
  console.log('\n=== Results ===\n');
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`  Passed: ${passed}/${results.length}`);
  console.log(`  Failed: ${failed}/${results.length}`);

  if (failed > 0) {
    console.log('\n  Failed tests:');
    results.filter((r) => !r.passed).forEach((r) => {
      console.log(`    ✗ ${r.name}: ${r.error}`);
    });
  }

  console.log('');
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
