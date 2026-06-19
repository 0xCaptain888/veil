/**
 * Veil — Internal Pilot Test: Execute Payroll on Mainnet
 * Pure Node.js — no tsx/ts-node required
 *
 * Usage:
 *   RELAYER_PRIVATE_KEY=suiprivkey1... node scripts/execute-pilot-payroll.mjs
 */
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { writeFileSync } from 'fs';

// ===== Configuration =====
const PACKAGE_ID = '0x3d95e6f1a4ca7d8341c2d7bc054014cf53b099eb4686ca194b5b470d2d38921a';
const EMPLOYER_OBJ = '0x08bee752e2575ecacbe7f0556500a1f1ad150027a045e575c36bd30df65dcf4a';
const ADMIN_CAP = '0xba00883e7167f175d61e3327042ffb3bde19fc32423e123f13ec94e64d126568';
const AMOUNT = 100000000; // 0.1 SUI in MIST
const SECRET_HEX = '97019be5f9b5776d4cde41a109682431';
const ID_HASH_HEX = '1e4a23a7271e000be745791c72d818de9d0686543fd80f912b922e637c0c1001';
const CLOCK_OBJ = '0x6';

function hexToBytes(hex) {
  const bytes = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.substring(i, i + 2), 16));
  }
  return bytes;
}

async function main() {
  const sk = process.env.RELAYER_PRIVATE_KEY;
  if (!sk) {
    console.error('Error: Set RELAYER_PRIVATE_KEY environment variable');
    console.error('Usage: RELAYER_PRIVATE_KEY=suiprivkey1... node scripts/execute-pilot-payroll.mjs');
    process.exit(1);
  }

  const { secretKey } = decodeSuiPrivateKey(sk);
  const keypair = Ed25519Keypair.fromSecretKey(secretKey);
  const senderAddress = keypair.getPublicKey().toSuiAddress();

  console.log('=== Veil Pilot Payroll Execution ===');
  console.log(`Sender:   ${senderAddress}`);
  console.log(`Package:  ${PACKAGE_ID}`);
  console.log(`Employer: ${EMPLOYER_OBJ}`);
  console.log(`AdminCap: ${ADMIN_CAP}`);
  console.log(`Amount:   ${AMOUNT} MIST (0.1 SUI)`);
  console.log('');

  const client = new SuiClient({ url: getFullnodeUrl('mainnet') });

  // Build the PTB
  const tx = new Transaction();

  // Step 1: create_run
  const manifestBytes = hexToBytes(Buffer.from('pilot-manifest').toString('hex'));
  const run = tx.moveCall({
    target: `${PACKAGE_ID}::payroll::create_run`,
    arguments: [
      tx.object(EMPLOYER_OBJ),
      tx.object(ADMIN_CAP),
      tx.pure.vector('u8', manifestBytes),
      tx.object(CLOCK_OBJ),
    ],
  });

  // Step 2: Split 0.1 SUI from gas coin
  const coin = tx.splitCoins(tx.gas, [tx.pure.u64(AMOUNT)]);

  // Step 3: escrow_payout
  tx.moveCall({
    target: `${PACKAGE_ID}::payroll::escrow_payout`,
    typeArguments: ['0x2::sui::SUI'],
    arguments: [
      run,
      tx.object(ADMIN_CAP),
      tx.pure.vector('u8', hexToBytes(ID_HASH_HEX)),
      coin,
    ],
  });

  // Step 4: finalize_run
  tx.moveCall({
    target: `${PACKAGE_ID}::payroll::finalize_run`,
    arguments: [run, tx.object(ADMIN_CAP)],
  });

  // Step 5: Transfer run back to sender
  tx.transferObjects([run], tx.pure.address(senderAddress));

  // Execute
  console.log('Executing transaction on mainnet...');
  console.log('(This may take 10-30 seconds)');
  console.log('');

  const result = await client.signAndExecuteTransaction({
    signer: keypair,
    transaction: tx,
    options: { showEffects: true, showEvents: true, showObjectChanges: true },
  });

  const status = result.effects?.status?.status;
  console.log(`Transaction Digest: ${result.digest}`);
  console.log(`Status: ${status}`);

  if (status !== 'success') {
    console.error('Transaction FAILED!');
    console.error(JSON.stringify(result.effects?.status, null, 2));
    process.exit(1);
  }

  console.log('');

  // Parse events
  let runId = '';
  let escrowId = '';
  if (result.events) {
    console.log('=== Events ===');
    for (const ev of result.events) {
      const pj = ev.parsedJson;
      const eventName = ev.type.split('::').pop() || ev.type;
      console.log(`  ${eventName}:`);
      if (pj) {
        for (const [key, value] of Object.entries(pj)) {
          const v = typeof value === 'object' ? JSON.stringify(value) : String(value);
          console.log(`    ${key}: ${v}`);
        }
        if (ev.type.includes('RunCreated')) runId = pj.run || '';
        if (ev.type.includes('PayoutEscrowed')) escrowId = pj.escrow || '';
      }
      console.log('');
    }
  }

  // Parse created objects
  if (result.objectChanges) {
    const created = result.objectChanges.filter((c) => c.type === 'created');
    console.log(`=== Created Objects (${created.length}) ===`);
    for (const obj of created) {
      const typeName = obj.objectType?.split('::').pop() || obj.objectType;
      console.log(`  ${typeName}: ${obj.objectId}`);
    }
    console.log('');
  }

  // Save results
  const pilotData = {
    timestamp: new Date().toISOString(),
    network: 'mainnet',
    packageId: PACKAGE_ID,
    employerObj: EMPLOYER_OBJ,
    adminCap: ADMIN_CAP,
    senderAddress,
    registerTx: 'HjcK66MJgDwcvPsDvYVXZ9YbgVUpWBLAoKipVs8DQyrk',
    payrollTx: result.digest,
    runId,
    escrowId,
    secret: SECRET_HEX,
    secretHash: ID_HASH_HEX,
    amount: AMOUNT,
    status,
  };

  console.log('=== Pilot Test Data ===');
  console.log(JSON.stringify(pilotData, null, 2));

  writeFileSync('/tmp/veil-pilot-result.json', JSON.stringify(pilotData, null, 2));
  console.log(`\nResults saved to: /tmp/veil-pilot-result.json`);
  console.log(`Sui Explorer: https://suiscan.xyz/mainnet/tx/${result.digest}`);
}

main().catch((e) => {
  console.error('Error:', e.message || e);
  process.exit(1);
});
