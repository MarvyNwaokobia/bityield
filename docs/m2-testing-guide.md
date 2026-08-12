# Milestone 2 Testing and Deploy Guide (handoff)

Status as of 2026-08-01: **M1 approved.** M2 is built, committed, and pushed to
`main`. The live routing contracts and app wiring exist but are **NOT deployed to
mainnet** and the withdraw path is **not yet proven end to end**. This doc is the
step-by-step for the mainnet testing session, written so any session can pick it
up. See also `docs/milestone-2-plan.md` for the full design and evidence.

## Key addresses (mainnet)

| Role | Address | Notes |
|------|---------|-------|
| Deployer | `SP360GQARJRHQEFBW21RP957MC8YPJYHYJQTPKVFN` | 6.10 STX, 0 sBTC (as of 2026-08-01). Mnemonic in `contracts/settings/Mainnet.toml` (gitignored). |
| Sponsor | `SP1FMF8WWHPNW2X20N0SCV6Q144K2GNQG8K6YDND3` | 11.96 STX. Key in `app/.env.local` `SPONSOR_PRIVATE_KEY` (gitignored, never print it). |
| Test wallet | TODO (screenshot showed `SP2JS…PJT3`) | Holds the sBTC used for the actual deposit tests. |
| M1 router (old, live) | `SP360...yield-router` | Old withdraw interface; M1 demo positions live here. Do not reuse. |

## What is and is not deployed

- Deployed on mainnet (M1): old `yield-router` + preview strategies (`zest-strategy`,
  `hermetica-strategy`, `dual-stacking-strategy`, `mock-yield-strategy`).
- NOT deployed (M2, local only): the withdraw interface change, `zest-strategy-live`,
  `dual-stacking-strategy-live`.

## Deployment nuances (read before Phase 1)

1. NAMING COLLISION: the router withdraw interface changed AND the
   `yield-strategy-trait` withdraw signature changed with it. On the M1 deployer
   `SP360...`, the names `yield-router` and `yield-strategy-trait` are already
   taken by the OLD, incompatible versions, and Clarity contracts are immutable.
   So the whole M2 set needs fresh names.
2. RECOMMENDED APPROACH: deploy the entire M2 set under a FRESH deployer address
   (new keypair, funded ~6-8 STX). Then `sip-010-trait`, `yield-strategy-trait`,
   `yield-router`, `zest-strategy-live`, `dual-stacking-strategy-live` all deploy
   under their normal names with relative references intact, the strategies'
   default `authorized-router` (`.yield-router`) already points at the new router
   (NO set-authorized-router needed), and nothing collides with M1. This deploys
   the contracts exactly as committed, no source edits.
   Alternative (messier): reuse `SP360` with `-v2` names and edit the router +
   strategy sources to reference `yield-strategy-trait-v2`. Avoid unless you
   specifically need everything under `SP360`.
3. The live strategies reference mainnet Zest / rewards contracts by principal, so
   the deployment plan must declare those mainnet contracts as requirements
   (clarinet fetches their interfaces) so it typechecks. Plan generation may need
   a small iteration during the session; a mainnet deploy cannot be fully dry-run
   locally.
4. `zest-strategy-live` must hold ~1 STX to pay the Pyth update fee on withdraw.
5. The fresh deployer becomes the strategies' `contract-owner` (for recovery) and
   the router admin (`add-strategy` / `set-sbtc-token`).

## SAFETY (do not skip)

- Test with dust amounts only (e.g. 0.0001 sBTC). Contracts are unaudited and the
  withdraw path is unproven on mainnet.
- Owner recovery IS now in place (added 2026-08-01, compile-checked on the fork):
  - `zest-strategy-live`: `owner-emergency-zest-redeem` (redeem sBTC from Zest to a
    recipient, bypassing the router), plus `owner-sweep-ft` / `owner-sweep-stx`.
  - `dual-stacking-strategy-live`: `owner-sweep-ft` / `owner-sweep-stx` (its sBTC
    simply sits in the contract).
  So dust is recoverable by the deployer if the router withdraw path is unusable.
  These are single-key powers for the testing phase; a public launch moves
  ownership to a multisig via `set-contract-owner`.
- Also fixed (2026-08-01): `zest-strategy-live.set-authorized-router` was
  router-gated (a deploy-blocking bug); it is now owner-gated.

## Phases

### Phase 0 — Prerequisites
- FRESH deployer keypair funded with ~6-8 STX (for the ~5 contract deploys) plus
  ~1 STX spare to fund the Zest strategy. Put its mnemonic in
  `contracts/settings/Mainnet.toml` (gitignored) as the deployer.
- Test wallet with a little sBTC for deposits (SP2JS...PJT3 has ~0.00044 sBTC).
- Sponsor account funded (SP1FMF..., ~12 STX).
- For Dual Stacking: Stacks-team confirmation that an enrolled CONTRACT is picked
  up by `distribute-rewards` (send `docs/outreach-dual-stacking.md`). Zest needs none.

### Phase 1 — Deploy contracts (mainnet, user-executed, fresh deployer)
1. Deploy the M2 set under the fresh deployer: `sip-010-trait`, `yield-strategy-trait`,
   `yield-router`, `zest-strategy-live`, `dual-stacking-strategy-live`. (The
   strategies' `authorized-router` default `.yield-router` already resolves to the
   new router, so no set-authorized-router step is needed.)
2. On the router: `set-sbtc-token` to canonical sBTC; `add-strategy "zest" → ...zest-strategy-live`;
   `add-strategy "dual-stacking" → ...dual-stacking-strategy-live`. Verify `get-strategy`.
3. Send ~1 STX to `...zest-strategy-live` (Pyth fee).
4. (If you instead reuse SP360 with -v2 names, you WOULD need set-authorized-router
   on each strategy after deploy. The fresh-deployer path avoids it.)

### Phase 2 — Point the app at live contracts
- Env: `NEXT_PUBLIC_YIELD_ROUTER_ADDRESS=...yield-router-v2`,
  `NEXT_PUBLIC_ZEST_STRATEGY_ADDRESS=...zest-strategy-live`,
  `NEXT_PUBLIC_DUAL_STRATEGY_ADDRESS=...dual-stacking-strategy-live`.
- `npm run dev` against mainnet, confirm balances load.

### Phase 3 — Zest route (do first; no external dependency)
1. Deposit 0.0001 sBTC via the app → Zest.
2. Verify on explorer: `borrow-helper-v2-1-7 supply` called, `zsbtc-v2-0` minted to
   the strategy; position on dashboard. Capture txid.
3. Withdraw from dashboard. App fetches `/api/pyth-price`, strategy pays the STX fee,
   sBTC (principal + interest) returns; position closes. Capture txid.
4. If withdraw reverts: check the strategy's STX balance and that `/api/pyth-price`
   returns data.

### Phase 4 — Dual Stacking route
1. Confirm the Stacks-team dependency first.
2. Deposit 0.0001 sBTC via the app.
3. Call `enroll-in-program` (admin) once; verify `is-enrolled-in-next-cycle`.
4. Rewards begin next cycle and accrue over time (no instant yield).
5. Withdraw → principal (+ any rewards) returns; position closes. Capture txids.

### Phase 5 — Verify milestone criteria + evidence
- Route-specific position info visible on the dashboard.
- Route-specific risk info shown (copy still to be written).
- Proof page shows the new mainnet txs.
- Collect: 2 live routes, one mainnet tx per route (txids), position info, risk
  info, docs, M2 demo video. Submit.

## Also unblocked by the testing session
- Validate Zest `get-apy` raw-rate → percent conversion against the deployed
  contract, then wire the live APY display.
- Write the route-specific risk copy and flip the "Preview" framing to live.
