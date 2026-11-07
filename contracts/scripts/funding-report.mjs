// Closed-beta evidence: for every wallet that has deposited through the
// yield-router, who first funded it? Answers "was each wallet funded
// independently?" from on-chain data only (read-only, no keys needed).
//
//   TEAM_WALLETS=SP...,SP... node contracts/scripts/funding-report.mjs [--json out.json]
//   (or pass --team SP...,SP...). Team wallets are not stored in this repo.
//
// For each depositor it reports the FIRST inflow of sBTC (a bridge mint, i.e. the
// user bridged real BTC, or a transfer from another address) and the FIRST inflow
// of STX, then classifies each funder:
//   team         address in the team list you supply (--team / TEAM_WALLETS)
//   team-linked  not on the list, but a team wallet has sent it / received from it
//   bityield     a BitYield contract (e.g. a strategy paying out a withdrawal)
//   depositor    another wallet that also deposited through the router
//   external     anything else (exchange, the user's own other wallet, a friend)
// It also traces each wallet's funding chain to its ROOT (the first address that is
// not itself a depositor) and flags sBTC swept back to a hub that funded 3+ wallets.
// "external" is NOT proof of independence: a founder's personal wallet looks
// external too. Treat the output as evidence to review, then confirm by hand.
//
// Set HIRO_API_KEY to use a keyed Hiro request (optional).
import { writeFileSync } from 'node:fs';

const HIRO = process.env.HIRO_API_URL ?? 'https://api.mainnet.hiro.so';
const ROUTER = process.env.YIELD_ROUTER ?? 'SP37FXV56C8S6TNYGVTB06TE9Y449638WG9VK71YB.yield-router';
const SBTC = 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token';

const args = process.argv.slice(2);
const argVal = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};
const team = {};
for (const a of [...(argVal('--team')?.split(',') ?? []), ...(process.env.TEAM_WALLETS?.split(',') ?? [])]) {
  if (a.trim()) team[a.trim()] = 'team';
}

const headers = process.env.HIRO_API_KEY ? { 'x-api-key': process.env.HIRO_API_KEY } : {};
async function getJson(url, attempt = 0) {
  const res = await fetch(url, { headers });
  if (res.status === 429 && attempt < 5) {
    await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    return getJson(url, attempt + 1);
  }
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function paged(path) {
  const out = [];
  let offset = 0;
  for (;;) {
    const d = await getJson(`${HIRO}${path}${path.includes('?') ? '&' : '?'}limit=50&offset=${offset}`);
    out.push(...d.results);
    offset += 50;
    if (offset >= d.total || d.results.length === 0) return out;
    await sleep(120);
  }
}

// 1. Every wallet that deposited through the router.
const routerTxs = await paged(`/extended/v1/address/${ROUTER}/transactions`);
const depositors = new Map(); // address -> { firstDeposit, deposits }
for (const t of routerTxs) {
  if (t.contract_call?.function_name !== 'deposit' || t.tx_status !== 'success') continue;
  const d = depositors.get(t.sender_address) ?? { firstDeposit: t.burn_block_time_iso, deposits: 0 };
  d.deposits += 1;
  if (t.burn_block_time_iso < d.firstDeposit) d.firstDeposit = t.burn_block_time_iso;
  depositors.set(t.sender_address, d);
}

const BITYIELD_PREFIX = ROUTER.split('.')[0]; // contracts deployed by the M2 deployer
const counterparties = new Map(); // depositor -> Set of addresses it exchanged STX/sBTC with
const sbtcOut = new Map(); // depositor -> [{to, amount}]
let teamLinked = new Set();

function classify(addr) {
  if (!addr) return { kind: 'none' };
  if (team[addr]) return { kind: 'team', note: team[addr] };
  if (addr === BITYIELD_PREFIX || addr.startsWith(`${BITYIELD_PREFIX}.`)) return { kind: 'bityield' };
  if (depositors.has(addr)) return { kind: 'depositor' };
  if (teamLinked.has(addr)) return { kind: 'team-linked' };
  return { kind: 'external' };
}

// 2. First sBTC and STX inflow per depositor.
const report = [];
for (const [wallet, info] of depositors) {
  const entries = await paged(`/extended/v1/address/${wallet}/transactions_with_transfers`);
  const sbtcIn = [];
  const stxIn = [];
  const peers = new Set();
  const outs = [];
  for (const e of entries) {
    const time = e.tx.burn_block_time_iso ?? e.tx.block_time_iso;
    for (const tr of e.stx_transfers ?? []) {
      if (tr.recipient === wallet && tr.sender !== wallet) {
        stxIn.push({ time, from: tr.sender, amount: tr.amount, txid: e.tx.tx_id });
        peers.add(tr.sender);
      } else if (tr.sender === wallet && tr.recipient !== wallet) peers.add(tr.recipient);
    }
    for (const tr of e.ft_transfers ?? []) {
      if (!tr.asset_identifier?.startsWith(SBTC)) continue;
      if (tr.recipient === wallet && tr.sender !== wallet) {
        sbtcIn.push({ time, from: tr.sender, amount: tr.amount, txid: e.tx.tx_id, via: 'transfer' });
        peers.add(tr.sender);
      } else if (tr.sender === wallet && tr.recipient !== wallet) {
        outs.push({ time, to: tr.recipient, amount: Number(tr.amount) });
        peers.add(tr.recipient);
      }
    }
    // sBTC bridge deposits arrive as a mint event, not a transfer.
    for (const ev of e.tx.events ?? []) {
      const a = ev.asset;
      if (ev.event_type === 'fungible_token_asset' && a?.asset_event_type === 'mint' && a.recipient === wallet && a.asset_id?.startsWith(SBTC)) {
        sbtcIn.push({ time, from: null, amount: a.amount, txid: e.tx.tx_id, via: 'bridge-mint' });
      }
    }
    await sleep(0);
  }
  const first = (xs) => xs.sort((a, b) => (a.time < b.time ? -1 : 1))[0];
  counterparties.set(wallet, peers);
  sbtcOut.set(wallet, outs);
  report.push({
    wallet,
    firstDeposit: info.firstDeposit,
    deposits: info.deposits,
    firstSbtcIn: first(sbtcIn),
    firstStxIn: first(stxIn),
  });
  await sleep(150);
}
report.sort((a, b) => (a.firstDeposit < b.firstDeposit ? -1 : 1));

// Classify only after every history is known (team-linked needs the team wallets' peers).
for (const t of Object.keys(team)) for (const p of counterparties.get(t) ?? []) teamLinked.add(p);
for (const r of report) {
  for (const k of ['firstSbtcIn', 'firstStxIn']) {
    if (r[k]) r[k].funder = r[k].via === 'bridge-mint' ? { kind: 'bridge-mint' } : classify(r[k].from);
  }
}

// Roots: follow funders upward until reaching an address that is not a depositor.
const byWallet = new Map(report.map((r) => [r.wallet, r]));
function rootsOf(w, seen = new Set()) {
  if (seen.has(w)) return new Set();
  seen.add(w);
  const r = byWallet.get(w);
  const ups = [r?.firstSbtcIn?.from, r?.firstStxIn?.from].filter(Boolean);
  const out = new Set();
  for (const u of ups) {
    if (byWallet.has(u)) for (const x of rootsOf(u, seen)) out.add(x);
    else out.add(u);
  }
  return out;
}
const rootCount = new Map();
for (const r of report) {
  r.roots = [...rootsOf(r.wallet)];
  for (const x of r.roots) rootCount.set(x, (rootCount.get(x) ?? 0) + 1);
}
// A hub funds 3+ depositors directly; sBTC sent back to one is a sweep.
const directFunded = new Map();
for (const r of report) for (const k of ['firstSbtcIn', 'firstStxIn']) {
  const f = r[k]?.from;
  if (f) directFunded.set(f, new Set([...(directFunded.get(f) ?? []), r.wallet]));
}
const hubs = new Set([...directFunded].filter(([, set]) => set.size >= 3).map(([a]) => a));
for (const r of report) {
  r.sweptToHub = (sbtcOut.get(r.wallet) ?? []).filter((o) => hubs.has(o.to)).reduce((n, o) => n + o.amount, 0);
}

// 3. Verdict per wallet (conservative: anything not clearly external needs review).
function verdict(r) {
  const kinds = [r.firstSbtcIn?.funder.kind, r.firstStxIn?.funder.kind];
  if (kinds.includes('team') || kinds.includes('team-linked')) return 'TEAM-FUNDED';
  const rootKinds = r.roots.map((x) => classify(x).kind);
  if (rootKinds.includes('team') || rootKinds.includes('team-linked')) return 'TEAM-FUNDED (via chain)';
  if (kinds.includes('depositor')) return 'review (funded by another depositor)';
  if (kinds.every((k) => k === undefined)) return 'review (no inflow found)';
  return 'external funding (confirm manually)';
}

const short = (a) => (a ? `${a.slice(0, 8)}…${a.slice(-4)}` : '-');
console.log(`Router: ${ROUTER}`);
console.log(`Depositor wallets: ${report.length}\n`);
for (const r of report) {
  r.verdict = verdict(r);
  const f = (x) =>
    x ? `${x.via === 'bridge-mint' ? 'bridge mint' : short(x.from)} [${x.funder.kind}] ${x.time?.slice(0, 10)}` : 'none found';
  console.log(`${short(r.wallet)}  first deposit ${r.firstDeposit.slice(0, 10)}  (${r.deposits} deposits)`);
  console.log(`   sBTC <- ${f(r.firstSbtcIn)}`);
  console.log(`   STX  <- ${f(r.firstStxIn)}`);
  console.log(`   root(s): ${r.roots.map((x) => `${short(x)} [${classify(x).kind}]`).join(', ') || '-'}`);
  if (r.sweptToHub) console.log(`   swept ${r.sweptToHub} sats of sBTC back to a funding hub`);
  console.log(`   => ${r.verdict}\n`);
}
console.log('Funding hubs (directly funded 3+ depositor wallets):');
for (const h of hubs) console.log(`   ${h} [${classify(h).kind}] funded ${directFunded.get(h).size} wallets`);
console.log('Root funders (wallets reached through any chain):');
for (const [a, n] of [...rootCount].sort((x, y) => y[1] - x[1])) console.log(`   ${short(a)} [${classify(a).kind}] ${n}`);
console.log(`sBTC bridge mints into depositor wallets: ${report.filter((r) => r.firstSbtcIn?.via === 'bridge-mint').length}\n`);
const tally = {};
for (const r of report) tally[r.verdict] = (tally[r.verdict] ?? 0) + 1;
console.log('Summary:', JSON.stringify(tally));

const out = argVal('--json');
if (out) {
  writeFileSync(out, JSON.stringify({ generatedAt: new Date().toISOString(), router: ROUTER, team, hubs: [...hubs], report }, null, 2));
  console.log(`Wrote ${out}`);
}
