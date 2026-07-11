// deployer-key.mjs
//
// Derives the deployer account's hex private key from a gitignored Clarinet
// settings file (settings/Testnet.toml or settings/Mainnet.toml), so the
// registration step can sign without a plaintext key file lying around.
//
// Prints ONLY the key to stdout — use it in command substitution, never echo
// or commit the result:
//
//   DEPLOYER_KEY=$(node scripts/deployer-key.mjs mainnet) \
//   NETWORK=mainnet ROUTER=<addr>.yield-router \
//   SBTC=SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token \
//   node scripts/register-strategies.mjs

import fs from 'fs';
import { mnemonicToSeedSync } from '@scure/bip39';
import { HDKey } from '@scure/bip32';

const net = (process.argv[2] ?? 'testnet').toLowerCase() === 'mainnet' ? 'Mainnet' : 'Testnet';
const path = new URL(`../settings/${net}.toml`, import.meta.url);

const toml = fs.readFileSync(path, 'utf8');
const mnemonic = toml.match(/mnemonic\s*=\s*"([^"]+)"/)?.[1];
const derivation = toml.match(/derivation\s*=\s*"([^"]+)"/)?.[1] ?? "m/44'/5757'/0'/0/0";
if (!mnemonic) {
  console.error(`No mnemonic found in settings/${net}.toml`);
  process.exit(1);
}

const seed = mnemonicToSeedSync(mnemonic);
const child = HDKey.fromMasterSeed(seed).derive(derivation);
process.stdout.write(Buffer.from(child.privateKey).toString('hex') + '01');
