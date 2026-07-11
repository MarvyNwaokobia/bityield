// register-strategies.mjs
//
// Post-deployment wiring for the YieldRouter. Run once after
// `clarinet deployments apply --testnet` (or --mainnet) succeeds.
//
// It performs the admin-only calls the deployment plan can't:
//   1. add-strategy   for mock-yield, zest, hermetica, dual-stacking
//   2. set-sbtc-token to the real sBTC token principal (router defaults to
//      its own .mock-sbtc-token otherwise)
//
// Usage:
//   DEPLOYER_KEY=<hex private key of the router deployer> \
//   NETWORK=testnet \
//   ROUTER=ST2THJ89ZREME71RPE31ATPVDBSR4MFTBRSDXV7NM \
//   SBTC=ST1F7QA2MDF17S807EPA36TSS8AMEFY4KA9TVGWXT.sbtc-token \
//   node scripts/register-strategies.mjs
//
// The deployer key is the account that published yield-router (it is
// CONTRACT-OWNER). Never commit it. On testnet you can derive it from
// settings/Testnet.toml; on mainnet use your cold-wallet signer instead of
// this script.

import {
  makeContractCall,
  broadcastTransaction,
  Cl,
  AnchorMode,
  PostConditionMode,
} from '@stacks/transactions';
import { STACKS_MAINNET, STACKS_TESTNET } from '@stacks/network';

const DEPLOYER_KEY = process.env.DEPLOYER_KEY;
const NETWORK_NAME = process.env.NETWORK ?? 'testnet';
const ROUTER = process.env.ROUTER; // "<address>.yield-router" or just "<address>"
const SBTC = process.env.SBTC; // "<address>.sbtc-token"

if (!DEPLOYER_KEY || !ROUTER) {
  console.error('Missing DEPLOYER_KEY or ROUTER env var. See header for usage.');
  process.exit(1);
}

const network = NETWORK_NAME === 'mainnet' ? STACKS_MAINNET : STACKS_TESTNET;
const [routerAddress, routerName = 'yield-router'] = ROUTER.split('.');

// Strategy name -> contract name (deployed alongside the router, same deployer).
const STRATEGIES = {
  'mock-yield': 'mock-yield-strategy',
  zest: 'zest-strategy',
  hermetica: 'hermetica-strategy',
  'dual-stacking': 'dual-stacking-strategy',
};

let nonce; // fetched lazily and incremented locally so calls don't collide

async function getStartNonce() {
  const res = await fetch(
    `${network.client.baseUrl}/extended/v1/address/${routerAddress}/nonces`
  );
  const data = await res.json();
  return BigInt(data.possible_next_nonce);
}

async function send(functionName, functionArgs) {
  const tx = await makeContractCall({
    contractAddress: routerAddress,
    contractName: routerName,
    functionName,
    functionArgs,
    senderKey: DEPLOYER_KEY,
    network,
    nonce,
    anchorMode: AnchorMode.Any,
    postConditionMode: PostConditionMode.Allow,
  });
  const result = await broadcastTransaction({ transaction: tx, network });
  if ('error' in result) {
    throw new Error(`${functionName} failed: ${result.error} ${result.reason ?? ''}`);
  }
  nonce += 1n;
  console.log(`  ${functionName}(${functionArgs.length} args) -> ${result.txid}`);
  return result.txid;
}

async function main() {
  nonce = await getStartNonce();
  console.log(`Deployer ${routerAddress}, starting nonce ${nonce}, network ${NETWORK_NAME}`);

  if (SBTC) {
    const [sbtcAddr, sbtcName] = SBTC.split('.');
    console.log('Pointing router at real sBTC token:');
    await send('set-sbtc-token', [Cl.contractPrincipal(sbtcAddr, sbtcName)]);
  } else {
    console.log('SBTC not set — router keeps its default .mock-sbtc-token.');
  }

  console.log('Registering strategies:');
  for (const [name, contractName] of Object.entries(STRATEGIES)) {
    await send('add-strategy', [
      Cl.stringAscii(name),
      Cl.contractPrincipal(routerAddress, contractName),
    ]);
  }

  console.log('\nAll registration transactions broadcast. Wait for confirmation,');
  console.log('then verify with get-strategy / get-sbtc-token read-only calls.');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
