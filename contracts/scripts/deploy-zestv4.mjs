// deploy-zestv4.mjs
//
// Deploys zest-strategy-live-v4 (fix for the 2026-09-08 Zest borrow-helper /
// oracle rotation that broke deposit+withdraw on zest-strategy-live-v2 with
// (err u8000001)) under the existing M2 deployer, then repoints the LIVE
// "zest" strategy slot on the LIVE yield-router (not yield-router-v2, which
// is unrelated and not wired to traffic) at the new contract.
//
// zest-strategy-live-v2's on-chain TVL was confirmed 0 before this deploy
// (get-tvl), so repointing the registry is a clean cutover -- no open
// position anywhere could be stranded by it.
//
// No STX funding step this time: unlike the old pyth-oracle-v4 path,
// stx-btc-oracle-v1-7's open-price-session does not transfer STX for its fee
// (it asserts pyth-lazer-oracle's get-fee is already 0), so there is no Pyth
// fee to prefund.
//
// Usage:
//   DEPLOYER_KEY=$(node scripts/deployer-key.mjs mainnet) node scripts/deploy-zestv4.mjs

import fs from 'fs';
import {
  makeContractDeploy,
  makeContractCall,
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
const network = STACKS_MAINNET;

const CONTRACT_NAME = 'zest-strategy-live-v4';
const CONTRACT_PATH = 'contracts/zest-strategy-live-v4.clar';
const DEPLOY_FEE = 140000n; // matches the real fee zest-strategy-live-v3's deploy attempt used for a same-shape file
const CALL_FEE = 20000n;    // matches add-strategy fee used in deploy-zestv3.mjs

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
        console.log(` -> FAILED (${data.tx_status}) ${JSON.stringify(data.tx_result)}`);
        return false;
      }
    }
    process.stdout.write('.');
    await new Promise((r) => setTimeout(r, 5000));
  }
  console.log(' -> TIMEOUT (still pending, check explorer manually)');
  return false;
}

async function main() {
  let nonce = await getNonce();
  console.log(`Deployer ${DEPLOYER_ADDRESS}, starting nonce ${nonce}\n`);

  console.log('--- Phase 1: deploy zest-strategy-live-v4 ---');
  const codeBody = fs.readFileSync(CONTRACT_PATH, 'utf8');
  const deployTx = await makeContractDeploy({
    contractName: CONTRACT_NAME,
    codeBody,
    senderKey: DEPLOYER_KEY,
    network,
    nonce,
    fee: DEPLOY_FEE,
    // The live zest-strategy-live-v2 deployed as Clarity 3 (confirmed via its
    // deploy tx). Letting this default to the current network default
    // (Clarity 4) is what caused the first attempt to abort with the
    // generic ":0:0: use of unresolved function 'as-contract'" analyzer
    // fallback error - match v2's proven-working version instead.
    clarityVersion: ClarityVersion.Clarity3,
  });
  const deployResult = await broadcastTransaction({ transaction: deployTx, network });
  if ('error' in deployResult) {
    throw new Error(`deploy failed: ${deployResult.error} ${deployResult.reason ?? ''}`);
  }
  console.log(`deploy ${CONTRACT_NAME} -> ${deployResult.txid} (fee ${DEPLOY_FEE} uSTX)`);
  nonce += 1n;
  const deployOk = await waitForConfirmation(deployResult.txid, CONTRACT_NAME);
  if (!deployOk) {
    throw new Error('Stopping: deploy did not confirm successfully. Fix before continuing.');
  }

  console.log('\n--- Phase 2: repoint the live router\'s "zest" slot ---');
  const callTx = await makeContractCall({
    contractAddress: DEPLOYER_ADDRESS,
    contractName: 'yield-router',
    functionName: 'add-strategy',
    functionArgs: [Cl.stringAscii('zest'), Cl.contractPrincipal(DEPLOYER_ADDRESS, CONTRACT_NAME)],
    senderKey: DEPLOYER_KEY,
    network,
    nonce,
    fee: CALL_FEE,
    postConditionMode: PostConditionMode.Allow,
  });
  const callResult = await broadcastTransaction({ transaction: callTx, network });
  if ('error' in callResult) {
    throw new Error(`add-strategy failed: ${callResult.error} ${callResult.reason ?? ''}`);
  }
  console.log(`add-strategy("zest", ${CONTRACT_NAME}) -> ${callResult.txid} (fee ${CALL_FEE} uSTX)`);
  nonce += 1n;
  const callOk = await waitForConfirmation(callResult.txid, 'add-strategy zest');
  if (!callOk) {
    throw new Error('add-strategy did not confirm successfully.');
  }

  console.log(`\nDone. Live "zest" route now points at ${DEPLOYER_ADDRESS}.${CONTRACT_NAME}`);
  console.log(`deploy tx:       ${deployResult.txid}`);
  console.log(`add-strategy tx: ${callResult.txid}`);
}

main().catch((err) => {
  console.error('\nERROR:', err.message);
  process.exit(1);
});
