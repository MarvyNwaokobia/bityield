// deploy-zestv3.mjs
//
// Deploys the four new contracts for the Zest oracle-dynamic fix (Finding 1)
// plus the router registry-pinning fix (Finding 2), under the existing M2
// deployer, without touching Dual Stacking or Hermetica:
//   oracle-trait, yield-strategy-trait-v2, yield-router-v2, zest-strategy-live-v3
// Then wires the new router (set-sbtc-token, add-strategy "zest") and funds
// zest-strategy-live-v3 with 1 STX for its Pyth fee.
//
// Explicit fees are used instead of stacks.js auto-estimation, which returned
// wildly inflated values (~107 STX per contract) when checked against real
// fees this same deployer already paid for equivalent contracts (see git
// history / conversation for the sanity check). Fees below have real-world
// margin over those actual past fees.
//
// Usage:
//   DEPLOYER_KEY=$(node scripts/deployer-key.mjs mainnet) node scripts/deploy-zestv3.mjs

import fs from 'fs';
import {
  makeContractDeploy,
  makeContractCall,
  makeSTXTokenTransfer,
  broadcastTransaction,
  Cl,
  ClarityVersion,
  PostConditionMode,
} from '@stacks/transactions';
import { STACKS_MAINNET } from '@stacks/network';

const DEPLOYER_KEY = process.env.DEPLOYER_KEY;
if (!DEPLOYER_KEY) {
  console.error('Missing DEPLOYER_KEY env var.');
  process.exit(1);
}

const DEPLOYER_ADDRESS = 'SP37FXV56C8S6TNYGVTB06TE9Y449638WG9VK71YB';
const REAL_SBTC = { address: 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4', name: 'sbtc-token' };
const network = STACKS_MAINNET;

const CONTRACTS = [
  { name: 'oracle-trait', path: 'contracts/oracle-trait.clar', fee: 15000n },
  { name: 'yield-strategy-trait-v2', path: 'contracts/yield-strategy-trait.clar', fee: 15000n },
  // Must match the live yield-router's clarity_version (2): it uses `block-height`,
  // which Clarity 3 (the default, used by zest-strategy-live-v2 etc.) renamed.
  { name: 'yield-router-v2', path: 'contracts/yield-router.clar', fee: 90000n, clarityVersion: ClarityVersion.Clarity2 },
  { name: 'zest-strategy-live-v3', path: 'contracts/zest-strategy-live.clar', fee: 140000n },
];

async function getNonce() {
  const res = await fetch(`${network.client.baseUrl}/extended/v1/address/${DEPLOYER_ADDRESS}/nonces`);
  const data = await res.json();
  return BigInt(data.possible_next_nonce);
}

async function waitForConfirmation(txid, label, timeoutMs = 300000) {
  const deadline = Date.now() + timeoutMs;
  process.stdout.write(`  waiting for ${label} (${txid}) to confirm`);
  while (Date.now() < deadline) {
    const res = await fetch(`${network.client.baseUrl}/extended/v1/tx/${txid}`);
    if (res.ok) {
      const data = await res.json();
      if (data.tx_status === 'success') {
        console.log(' -> success');
        return true;
      }
      if (data.tx_status && data.tx_status.startsWith('abort_')) {
        console.log(` -> FAILED (${data.tx_status})`);
        return false;
      }
    }
    process.stdout.write('.');
    await new Promise((r) => setTimeout(r, 5000));
  }
  console.log(' -> TIMEOUT (still pending, check explorer manually)');
  return false;
}

async function deployContract(nonce, name, path, fee, clarityVersion) {
  const codeBody = fs.readFileSync(path, 'utf8');
  const tx = await makeContractDeploy({
    contractName: name,
    codeBody,
    senderKey: DEPLOYER_KEY,
    network,
    nonce,
    fee,
    ...(clarityVersion ? { clarityVersion } : {}),
  });
  const result = await broadcastTransaction({ transaction: tx, network });
  if ('error' in result) {
    throw new Error(`deploy ${name} failed: ${result.error} ${result.reason ?? ''}`);
  }
  console.log(`deploy ${name} -> ${result.txid} (fee ${fee} uSTX)`);
  return result.txid;
}

async function callContract(nonce, contractName, functionName, functionArgs, fee) {
  const tx = await makeContractCall({
    contractAddress: DEPLOYER_ADDRESS,
    contractName,
    functionName,
    functionArgs,
    senderKey: DEPLOYER_KEY,
    network,
    nonce,
    fee,
    postConditionMode: PostConditionMode.Allow,
  });
  const result = await broadcastTransaction({ transaction: tx, network });
  if ('error' in result) {
    throw new Error(`${functionName} on ${contractName} failed: ${result.error} ${result.reason ?? ''}`);
  }
  console.log(`${functionName}(${contractName}) -> ${result.txid} (fee ${fee} uSTX)`);
  return result.txid;
}

async function fundStx(nonce, recipient, amount, fee) {
  const tx = await makeSTXTokenTransfer({
    recipient,
    amount,
    senderKey: DEPLOYER_KEY,
    network,
    nonce,
    fee,
  });
  const result = await broadcastTransaction({ transaction: tx, network });
  if ('error' in result) {
    throw new Error(`STX transfer failed: ${result.error} ${result.reason ?? ''}`);
  }
  console.log(`stx-transfer ${amount} uSTX -> ${recipient} -> ${result.txid} (fee ${fee} uSTX)`);
  return result.txid;
}

async function main() {
  let nonce = await getNonce();
  console.log(`Deployer ${DEPLOYER_ADDRESS}, starting nonce ${nonce}\n`);

  const skip = new Set((process.env.SKIP_CONTRACTS ?? '').split(',').filter(Boolean));

  console.log('--- Phase 1: deploy contracts (sequential, waiting for each confirmation) ---');
  for (const c of CONTRACTS) {
    if (skip.has(c.name)) {
      console.log(`skipping ${c.name} (already deployed)`);
      continue;
    }
    const txid = await deployContract(nonce, c.name, c.path, c.fee, c.clarityVersion);
    nonce += 1n;
    const ok = await waitForConfirmation(txid, c.name);
    if (!ok) {
      throw new Error(`Stopping: ${c.name} deploy did not confirm successfully. Fix before continuing.`);
    }
  }

  console.log('\n--- Phase 2: wire the new router ---');
  let txid = await callContract(
    nonce,
    'yield-router-v2',
    'set-sbtc-token',
    [Cl.contractPrincipal(REAL_SBTC.address, REAL_SBTC.name)],
    20000n
  );
  nonce += 1n;
  await waitForConfirmation(txid, 'set-sbtc-token');

  txid = await callContract(
    nonce,
    'yield-router-v2',
    'add-strategy',
    [Cl.stringAscii('zest'), Cl.contractPrincipal(DEPLOYER_ADDRESS, 'zest-strategy-live-v3')],
    20000n
  );
  nonce += 1n;
  await waitForConfirmation(txid, 'add-strategy zest');

  console.log('\n--- Phase 3: fund zest-strategy-live-v3 with 1 STX for Pyth fees ---');
  txid = await fundStx(nonce, `${DEPLOYER_ADDRESS}.zest-strategy-live-v3`, 1000000n, 1000n);
  nonce += 1n;
  await waitForConfirmation(txid, 'fund zest-strategy-live-v3');

  console.log('\nAll done. New contracts:');
  for (const c of CONTRACTS) console.log(`  ${DEPLOYER_ADDRESS}.${c.name}`);
}

main().catch((err) => {
  console.error('\nERROR:', err.message);
  process.exit(1);
});
