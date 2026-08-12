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

1. The router interface changed (withdraw now takes an optional price-feed buffer).
   Clarity contracts are immutable, so deploy a NEW router under a NEW name, e.g.
   `yield-router-v2`. The M1 router and its positions stay untouched.
2. The live strategies default `authorized-router` to `.yield-router` (the OLD one).
   After deploy, call `set-authorized-router` on each live strategy to point at
   `...yield-router-v2`, or deposits fail authorization.
3. The live strategies reference mainnet Zest / rewards contracts by principal, so
   they can only be deployed against mainnet (not a bare local/testnet project). A
   Clarinet deployment plan that includes them must declare those mainnet contracts
   as requirements so it typechecks.
4. `zest-strategy-live` must hold a little STX (~1 STX) to pay the Pyth update fee
   charged on withdraw.

## SAFETY (do not skip)

- Test with dust amounts only (e.g. 0.0001 sBTC). Contracts are unaudited and the
  withdraw path is unproven on mainnet.
- RISK: neither live strategy has an owner emergency-withdraw. If the router
  withdraw path has a bug, deposited sBTC could be stuck (recoverable only through
  a working withdraw). STRONGLY consider adding an owner-only `emergency-withdraw`
  to both live strategies before depositing real funds, or accept that the dust
  test amount is at risk.

## Phases

### Phase 0 — Prerequisites
- Deployer STX for deploys (have ~6, enough) + ~1 STX to fund the Zest strategy.
- Test wallet with a little sBTC for deposits.
- Sponsor account funded (have ~12 STX).
- For Dual Stacking: Stacks-team confirmation that an enrolled CONTRACT is picked
  up by `distribute-rewards` (send `docs/outreach-dual-stacking.md`). Zest needs none.

### Phase 1 — Deploy contracts (mainnet, user-executed)
1. Deploy `yield-router-v2` (new name), `zest-strategy-live`, `dual-stacking-strategy-live`.
2. `set-authorized-router` on each live strategy → `...yield-router-v2`.
3. On the router: `set-sbtc-token` to canonical sBTC; `add-strategy "zest" → ...zest-strategy-live`;
   `add-strategy "dual-stacking" → ...dual-stacking-strategy-live`. Verify `get-strategy`.
4. Send ~1 STX to `...zest-strategy-live`.

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
