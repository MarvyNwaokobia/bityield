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

# Mainnet deployment (team-funded demo)

> **Scope & safety.** These are unaudited contracts, and the strategies pay a
> fixed APY that is not backed by real protocol yield yet (v0.2). So the mainnet
> deployment is a **controlled, team-funded demo**, not a public launch: the
> demo deposit uses the team's own sBTC only. To keep the exposure window
> closed, register strategies right before recording and **deactivate them after**
> (`set-strategy-status <name> false`) — that blocks new public deposits while
> still allowing any existing position to withdraw. For a real launch: get an
> audit, route to live protocols, and move `CONTRACT-OWNER` to a multisig cold
> wallet.

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
