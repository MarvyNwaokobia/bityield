# Deployment guide

## Current testnet deployment

The full multi-strategy contract set is deployed at
**`ST2THJ89ZREME71RPE31ATPVDBSR4MFTBRSDXV7NM`** (see
`deployments/default.testnet-plan.yaml`), in dependency order:

| Contract                 | Role                                          |
|--------------------------|-----------------------------------------------|
| `sip-010-trait`          | SIP-010 fungible-token trait                  |
| `yield-strategy-trait`   | Trait every yield strategy implements         |
| `mock-sbtc-token`        | Mintable sBTC stand-in (tests / local only)   |
| `mock-yield-strategy`    | Self-contained 5.00% strategy                 |
| `zest-strategy`          | Zest lending, 4.50% APY                        |
| `hermetica-strategy`     | Hermetica structured, 6.20% APY               |
| `dual-stacking-strategy` | Dual Stacking PoX, 8.50% APY                   |
| `yield-router`           | Non-custodial routing + accounting layer      |

After deploy, the router was wired up with `scripts/register-strategies.mjs`:
`set-sbtc-token` points it at Hiro's testnet sBTC contract
(`ST1F7QA2MDF17S807EPA36TSS8AMEFY4KA9TVGWXT.sbtc-token`), and all four
strategies are registered and active. `app/.env.local` / Vercel production env
vars point `NEXT_PUBLIC_YIELD_ROUTER_ADDRESS` at this deployer; the strategy
addresses are derived from it automatically (see `app/lib/stacks/network.ts`).

> **Note (prior deployment):** an earlier, single-strategy `yield-router` lived
> at `ST2JS7GJEYRD7MAD5CF9EHSTN1MNA9E219R8QTX0F`. Its `deposit` ABI predates the
> strategy-routing refactor and no longer matches the frontend — it is
> abandoned. Use the `ST2THJ89…` deployment above.

> **Real sBTC yield float:** each strategy pays out `principal + yield` on
> `withdraw` but only receives `principal` on `deposit`. With the real sBTC
> token, transfer each strategy a small sBTC buffer so withdrawals can cover
> accrued yield. Deposits do not need this. (With `mock-sbtc-token` you just
> `mint` the buffer — see the test suite.)

The steps below are for redeploying (e.g. after a contract change or testnet
reset) — they don't need to be repeated to use the current deployment.

---

This project's contract tests (`npm test`) run entirely against an in-memory
WASM "simnet" via `@stacks/clarinet-sdk` - no installs or funded accounts are
needed for that. Everything below is only required to get `yield-router` onto
**Stacks testnet** so the `app/` frontend can talk to a real contract.

## 1. Install the Clarinet CLI

The npm package in this directory (`@stacks/clarinet-sdk`) only powers
`npm test`. Deploying to testnet uses the separate Rust-based Clarinet CLI:

```
brew install clarinet
clarinet --version
```

## 2. Create and fund a deployer account

1. The first time you run `clarinet deployments generate --testnet` (step 3),
   Clarinet creates `settings/Testnet.toml` with a freshly generated deployer
   account (mnemonic + address). Alternatively, supply your own via the
   `--low-cost`/`--manual-cost` flags or by editing that file.
2. Get testnet STX for that address from the faucet:
   https://explorer.hiro.so/sandbox/faucet?chain=testnet
   A few hundred STX is plenty to deploy these three contracts.

`settings/Testnet.toml` is gitignored because it contains this account's
mnemonic. Keep it out of version control and back it up somewhere safe.

## 3. Generate and apply the deployment plan

From `contracts/`:

```
clarinet deployments generate --testnet --medium-cost
clarinet deployments apply --testnet
```

This deploys all eight contracts (traits, token, four strategies, router) to
your deployer's address, in dependency order.

> `mock-sbtc-token` is only needed for local/simnet testing before the real
> sBTC contract (step 5) is wired up. Once the router points at the real sBTC
> token, `mock-sbtc-token` can stay deployed-but-unused.

Because Clarity contracts are immutable, you cannot republish a contract name
that already exists at your deployer address. To redeploy changed contracts,
deploy from a **fresh** deployer address (all `.contract` references resolve to
the new deployer automatically — no code changes needed).

## 3b. Register strategies + set the sBTC token

The deployment plan only publishes contracts; two admin-only calls wire the
router up afterward (`add-strategy` ×4 and `set-sbtc-token`). Run them with:

```
DEPLOYER_KEY=<hex private key of the deployer> \
NETWORK=testnet \
ROUTER=<deployer-address>.yield-router \
SBTC=ST1F7QA2MDF17S807EPA36TSS8AMEFY4KA9TVGWXT.sbtc-token \
node scripts/register-strategies.mjs
```

Omit `SBTC` to keep the router's default `.mock-sbtc-token`. Verify afterward
with the router's `get-strategy` / `get-sbtc-token` read-only functions.

## 4. Point the frontend at the deployed YieldRouter

After `apply` succeeds, set in `app/.env.local` (deployer address +
`.yield-router`):

```
NEXT_PUBLIC_YIELD_ROUTER_ADDRESS=ST....yield-router
```

## 5. Set the sBTC testnet token contract

`yield-router`'s `deposit`/`withdraw` take a SIP-010 `<sip-010-trait>` token
argument - the frontend passes whatever principal is configured here. Look up
the current official sBTC testnet token contract principal (check the sBTC
docs / Hiro explorer - this has changed across testnet resets) and set:

```
NEXT_PUBLIC_SBTC_CONTRACT_ADDRESS=ST....sbtc-token
```

Until this is set, `/deposit` and `/withdraw` fall back to this project's
`mock-sbtc-token` (step 3) so the flow can still be exercised end-to-end.

## 6. Create and fund a sponsor account (STX fee abstraction)

Users sign deposit/withdraw transactions with `sponsored: true`, so they never
need to hold STX. A separate **sponsor** account pays the actual STX fee
server-side, in `app/app/api/sponsor-tx/route.ts`.

1. Generate a new Stacks account (Leather, `stx-cli`, or `@stacks/transactions`'
   `generateWallet`). Do not reuse the deployer account from step 2.
2. Fund it with testnet STX from the faucet - it needs an ongoing balance,
   since it pays a small fee for every sponsored transaction.
3. Set its private key (hex, not the mnemonic) as a server-only env var:

   ```
   SPONSOR_PRIVATE_KEY=...
   ```

   Never expose this as a `NEXT_PUBLIC_*` variable or commit it - it can spend
   the sponsor account's STX.

## Summary of env vars (`app/.env.local`)

```
NEXT_PUBLIC_STACKS_NETWORK=testnet
NEXT_PUBLIC_HIRO_API_URL=https://api.testnet.hiro.so
NEXT_PUBLIC_YIELD_ROUTER_ADDRESS=ST....yield-router
NEXT_PUBLIC_SBTC_CONTRACT_ADDRESS=ST....sbtc-token
SPONSOR_PRIVATE_KEY=...
```

See `app/.env.example` for the template. Until `NEXT_PUBLIC_YIELD_ROUTER_ADDRESS`
and `SPONSOR_PRIVATE_KEY` are set, the app runs with read-only fallbacks (a
default 5% APY, zero balances) and deposit/withdraw transactions will fail with
a clear "not configured" error rather than silently doing nothing.

---

# Mainnet deployment — Milestone 2 (live protocol routing)

> **This is the current production deployment** — what `bityield.click`
> actually runs against today. The Milestone 1 deployment further below is
> kept live so its existing positions can still withdraw, but the app does
> not route new activity through it.

## Why a fresh deployer, not a reuse of Milestone 1's

Zest requires a fresh Pyth price update passed into `withdraw` in the same
transaction, and the original `yield-strategy-trait` / `yield-router`
`withdraw` had no argument to carry it. Making that possible meant adding
`(oracle <oracle-trait>) (price-feed-bytes (optional (buff 8192)))` to
`withdraw` on both the trait and the router — a breaking interface change.
Clarity contracts are immutable and a contract name can't be republished at
an address that has already used it, so `yield-router` and
`yield-strategy-trait` couldn't be redeployed under the Milestone 1 deployer
(`SP360GQARJRHQEFBW21RP957MC8YPJYHYJQTPKVFN`) — those names were already
taken there by the incompatible old versions. The whole Milestone 2 set was
deployed under a **fresh** deployer address instead: every contract keeps its
normal name, relative `.contract` references resolve correctly, and each
strategy's default `authorized-router` (`.yield-router`) already points at
the new router with zero source edits or extra `set-authorized-router` calls.

## Deployed contracts (mainnet)

Deployer / owner: `SP37FXV56C8S6TNYGVTB06TE9Y449638WG9VK71YB` — fresh,
isolated from the Milestone 1 deployer. Every txid below was read directly
off-chain via the Hiro API against this address, not copied from an earlier
draft.

| Contract | Role | Deploy tx |
|----------|------|-----------|
| `sip-010-trait` | SIP-010 trait | [`0x86ec0b02…`](https://explorer.hiro.so/txid/0x86ec0b028ec880f454d718962d7a95d368d705b56c39d34426b35826e64e8795?chain=mainnet) |
| `yield-strategy-trait` | Strategy trait (now with the `oracle` / `price-feed-bytes` `withdraw` args) | [`0xf6abb496…`](https://explorer.hiro.so/txid/0xf6abb4966139826c10cac3724f487f9ebbef7348f7e5650cde37be97be82cf5a?chain=mainnet) |
| `yield-router` | Routing + accounting layer | [`0xfc904892…`](https://explorer.hiro.so/txid/0xfc90489275c5762056ca3d13ae4d03288372ca60359fe9e4cd66e6f4f98e77b4?chain=mainnet) |
| `zest-strategy-live-v2` | Live Zest routing (current; supersedes `zest-strategy-live`, see incident below) | [`0x3dcce3b1…`](https://explorer.hiro.so/txid/0x3dcce3b1e4603bdaa88281f04bef8e60d5f4d22a8edad18d41f3b5c36a6e2a11?chain=mainnet) |
| `dual-stacking-strategy-live` | Live Dual Stacking routing | [`0x8e48dd90…`](https://explorer.hiro.so/txid/0x8e48dd90914e92b99198053faba4b15d0e071bd70cbfb3ffbb72114b43744aaa?chain=mainnet) |
| `hermetica-strategy-live` | Preview strategy (fixed APY; matches the actually-deployed trait shape) | [`0x5d74f5e1…`](https://explorer.hiro.so/txid/0x5d74f5e16697cfc926f0c9d7bc744e55da1448b52a07a19d2d70125ac91e73b2?chain=mainnet) |
| `mock-sbtc-token` | Self-contained test token (unused once real sBTC is set) | [`0x9b752683…`](https://explorer.hiro.so/txid/0x9b7526830bf0431c64eb2c9fdbd3e40ea47814f6f70a2e47a347f33edc57a732?chain=mainnet) |

Post-deploy configuration (all confirmed `success`):

| Action | Tx |
|--------|----|
| `set-sbtc-token` → canonical mainnet sBTC | [`0x1c75cd5f…`](https://explorer.hiro.so/txid/0x1c75cd5f300b27eecb0d83106522e866d554de0f9414dac256c77ba20c1a32fb?chain=mainnet) |
| `add-strategy "zest"` → `zest-strategy-live-v2` | [`0x69206d33…`](https://explorer.hiro.so/txid/0x69206d3373288bd45a53c61b7fa15d7d9a8954c74b337aeb574d0406f515e5e4?chain=mainnet) |
| `add-strategy "dual-stacking"` → `dual-stacking-strategy-live` | [`0x8e853d92…`](https://explorer.hiro.so/txid/0x8e853d924c995afc24016a1c1e512b8c80811fe277d45537f0a689ab1eff1467?chain=mainnet) |
| `add-strategy "hermetica"` → `hermetica-strategy-live` | [`0x0166744c…`](https://explorer.hiro.so/txid/0x0166744caf226ed83e79e223389f33c6cc7f1a62fce3cad5e32f1d72cae76f01?chain=mainnet) |
| Funded `zest-strategy-live-v2` with 1 STX (pays the Pyth update fee on withdraw) | [`0xc04d329e…`](https://explorer.hiro.so/txid/0xc04d329e2a0df805791e7823667dcaeb474f4595017cc07aa4f79f388b60b8ab?chain=mainnet) |
| `enroll-in-program` on `dual-stacking-strategy-live` | [`0x100b7544…`](https://explorer.hiro.so/txid/0x100b7544af20c8c521394fe5bfa46359f2bfc6af310b08b60ed5eb7349caa36b?chain=mainnet) |

## Zest incident: an oracle rotation, and why the oracle isn't hardcoded

The first real Zest withdraw (through `zest-strategy-live`, the original
deploy) reverted: Zest had rotated the sBTC reserve's oracle contract
(`stx-btc-oracle-v1-4` → `v1-6`) after this integration was designed and
verified against the old one. The strategy hardcoded the old oracle address,
so the withdraw's oracle check failed — and because Zest's `zsBTC` receipt
token isn't freely transferable by an unapproved contract, there was no
sweep path to recover the ~1000 sats already supplied. That dust is a
permanent, small (~$0.63) loss. Fixed and redeployed as
`zest-strategy-live-v2` with the corrected oracle, re-registered on the
router. Full incident writeup, including the failed recovery attempts and
the underlying design lesson, is in
[`docs/m2-testing-guide.md`](../docs/m2-testing-guide.md#zest-incident-oracle-rotation-dust-loss-redeploy-2026-08-13).

## Redeploying Milestone 2 (if the interface changes again)

Same shape as the original deploy: fresh deployer address, `clarinet
deployments apply --mainnet` against a plan covering `sip-010-trait`,
`yield-strategy-trait`, `yield-router`, and each `-live` strategy, then
`add-strategy` + `set-sbtc-token` via `scripts/register-strategies.mjs` (see
the testnet steps above for the general pattern — mainnet mainly differs in
which sBTC token and strategy APYs are used). Fund each oracle-priced
strategy (currently just Zest) with a little STX for its Pyth fee. Point
`app/.env.local` / the Vercel production env at the new addresses.

**Gotcha:** any strategy contract deployed under a fresh Milestone-2-style
deployer must match whatever `yield-strategy-trait` shape is *actually
deployed* at that address, not necessarily what's newest in the local repo —
the local project's contracts can (and did, mid-Milestone-2) move ahead of
what's live. Confirm by reading the deployed trait's source before writing a
new strategy against it.

## Summary of env vars (`app/.env.local` / production)

```
NEXT_PUBLIC_STACKS_NETWORK=mainnet
NEXT_PUBLIC_HIRO_API_URL=https://api.mainnet.hiro.so
NEXT_PUBLIC_YIELD_ROUTER_ADDRESS=SP37FXV56C8S6TNYGVTB06TE9Y449638WG9VK71YB.yield-router
NEXT_PUBLIC_SBTC_CONTRACT_ADDRESS=SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token
NEXT_PUBLIC_ZEST_STRATEGY_ADDRESS=SP37FXV56C8S6TNYGVTB06TE9Y449638WG9VK71YB.zest-strategy-live-v2
NEXT_PUBLIC_DUAL_STRATEGY_ADDRESS=SP37FXV56C8S6TNYGVTB06TE9Y449638WG9VK71YB.dual-stacking-strategy-live
NEXT_PUBLIC_HERMETICA_STRATEGY_ADDRESS=SP37FXV56C8S6TNYGVTB06TE9Y449638WG9VK71YB.hermetica-strategy-live
SPONSOR_PRIVATE_KEY=...   # sponsor account private key (server-only, never commit)
```

These strategy addresses must be set explicitly. If left unset, the frontend
falls back to `<deployer>.zest-strategy`-style names (the old preview
naming), which don't exist under this deployer.

---

# Mainnet deployment — Milestone 1 (superseded, kept live for withdrawals)

> **Scope & safety (as of Milestone 1).** These are unaudited contracts, and
> the strategies pay a fixed APY that is not backed by real protocol yield —
> live routing came later, in Milestone 2 above, under a different deployer.
> So this mainnet deployment was a **controlled, team-funded demo**, not a
> public launch: the demo deposit used the team's own sBTC only. To keep the
> exposure window closed, register strategies right before recording and
> **deactivate them after** (`set-strategy-status <name> false`) — that blocks
> new public deposits while still allowing any existing position to withdraw.

The generated mainnet accounts (secrets live in gitignored
`contracts/settings/Mainnet.toml` and `app/.env.mainnet.local`):

| Role     | Address                                     | Fund with                          |
|----------|---------------------------------------------|------------------------------------|
| Deployer | `SP360GQARJRHQEFBW21RP957MC8YPJYHYJQTPKVFN` | ~35 STX (deploy ≈ 26.8 STX + buffer) |
| Sponsor  | `SP1FMF8WWHPNW2X20N0SCV6Q144K2GNQG8K6YDND3` | ~5 STX (each sponsored tx ≈ 0.003 STX) |

Steps:

1. **Fund the deployer + sponsor** addresses above with real STX. Fund your
   demo wallet with a small amount of real sBTC via the bridge (https://sbtc.stacks.co).
2. **Deploy** all eight contracts (plan already generated at
   `deployments/default.mainnet-plan.yaml`, expected-sender = deployer):

   ```
   clarinet deployments apply --mainnet
   ```

3. **Register strategies + point at mainnet sBTC** (owner-only calls). The key
   is derived from `settings/Mainnet.toml` and never printed:

   ```
   DEPLOYER_KEY=$(node scripts/deployer-key.mjs mainnet) \
   NETWORK=mainnet \
   ROUTER=SP360GQARJRHQEFBW21RP957MC8YPJYHYJQTPKVFN.yield-router \
   SBTC=SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token \
   node scripts/register-strategies.mjs
   ```

4. **Fund a small yield float** (only needed to demo *withdraw*): transfer a
   little real sBTC to each strategy contract you'll demo, so it can cover
   `principal + accrued yield` on withdrawal. A deposit-only demo skips this.
5. **Point the frontend at mainnet.** `app/.env.mainnet.local` already holds the
   mainnet env (router, real sBTC token, sponsor key). For a local demo, back up
   the testnet env and use the mainnet one:

   ```
   cp app/.env.local app/.env.local.testnet.bak
   cp app/.env.mainnet.local app/.env.local
   ```

   (Or set the same vars in the Vercel project for a hosted mainnet demo.)
6. **Run the demo deposit** with your own sBTC — connect wallet, deposit, sign
   (gas sponsored, 0 STX from you), confirm the on-chain position.
7. **Close the window:** `set-strategy-status` each strategy to `false` after
   recording.

## Summary of env vars (`app/.env.mainnet.local`)

```
NEXT_PUBLIC_STACKS_NETWORK=mainnet
NEXT_PUBLIC_HIRO_API_URL=https://api.mainnet.hiro.so
NEXT_PUBLIC_YIELD_ROUTER_ADDRESS=SP360GQARJRHQEFBW21RP957MC8YPJYHYJQTPKVFN.yield-router
NEXT_PUBLIC_SBTC_CONTRACT_ADDRESS=SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token
SPONSOR_PRIVATE_KEY=...   # sponsor account private key (server-only, never commit)
```
