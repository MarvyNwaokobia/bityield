# v0.2 Testing and Deploy Guide (handoff)

Status as of 2026-08-13: **M1 approved; M2 DEPLOYED TO MAINNET and CONFIRMED
WORKING.** A full Zest deposit and withdrawal completed successfully through
the app on real mainnet: deposit
[`0x121a7328…`](https://explorer.hiro.so/txid/0x121a7328b0bd3601d3dc74dbad8ec83fb9d5d32bbf56af9eee4089b4c6ff2a88?chain=mainnet),
withdrawal
[`0x7b909c7c…`](https://explorer.hiro.so/txid/0x7b909c7c6e8e9159659133ec61537f92e0fa93776c13731e675f8717d518be10?chain=mainnet),
both `success`. The Zest route hit a real issue during the first dust test
(Zest rotated an oracle contract), which was diagnosed, fixed, and redeployed
as `zest-strategy-live-v2`; see "Zest incident" below for that story. Dual
Stacking's router plumbing is dust-tested (deposit+withdraw round trip,
confirmed `success`), and it now holds 0.0001 sBTC and is enrolled in the sBTC
rewards program, pending the next reward cycle; see "Dual Stacking
enrollment" below. Hermetica (preview) was found broken (never re-registered
after the M2 redeploy) and fixed as `hermetica-strategy-live`; see "Hermetica
re-registration" below. See also `docs/milestone-2-plan.md` for the full
design and evidence.

## Deployed M2 contracts (mainnet)

Deployer / owner: `SP37FXV56C8S6TNYGVTB06TE9Y449638WG9VK71YB` (fresh, isolated).

| Contract | Deploy tx |
|----------|-----------|
| `SP37FXV5….yield-router` | `0xfc904892…f98e77b4` |
| `SP37FXV5….yield-strategy-trait` | `0xf6abb496…be82cf5a` |
| `SP37FXV5….sip-010-trait` | `0x86ec0b02…64e8795` |
| `SP37FXV5….mock-sbtc-token` | `0x9b752683…dc57a732` |
| `SP37FXV5….zest-strategy-live` (SUPERSEDED, see incident) | `0xae20ad6f…6c9c583649` |
| `SP37FXV5….zest-strategy-live-v2` (SUPERSEDED, see incident #2, 2026-09-08) | `0x3dcce3b1…36a6e2a11` |
| `SP37FXV5….zest-strategy-live-v4` (CURRENT; not `-v3`, see "Oracle-dynamic redesign" below) | `0x79e833cf…45a4d1462` |
| `SP37FXV5….dual-stacking-strategy-live` | `0x8e48dd90…b43744aaa` |
| `SP37FXV5….hermetica-strategy-live` | `0x5d74f5e1…ac91e73b2` |

For `zest-strategy-live-v2` specifically: `contracts/contracts/zest-strategy-live.clar`
(no "-v2" suffix) has since drifted ahead to prototype the oracle-dynamic
redesign below and no longer matches what's deployed. The frozen,
chain-verified source of what's actually live is
[`contracts/contracts/zest-strategy-live-v2.clar`](../contracts/contracts/zest-strategy-live-v2.clar),
pulled verbatim from `api.mainnet.hiro.so` — read that file, not the
similarly-named one, for ground truth.

Post-deploy config (all confirmed success):
- `set-sbtc-token` -> `SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token` (`0x1c75cd5f…c1a32fb`)
- `add-strategy "zest"` -> `zest-strategy-live` (`0xcc8a8734…a99eae11`), later repointed to
  `zest-strategy-live-v2` (`0x69206d33…0406f515e5e4`) -- see incident below
- `add-strategy "dual-stacking"` -> `dual-stacking-strategy-live` (`0x8e853d92…1eff1467`)
- funded `zest-strategy-live` with 1 STX for Pyth fees (`0x6cbe8e1f…480f22c`); funded
  `zest-strategy-live-v2` likewise (`0xc04d329e…f79f388b60b8ab`)
- enrolled `dual-stacking-strategy-live` in `sbtc-yield-rewards-v3`
  (`0x100b7544…349caa36b`) -- see "Dual Stacking enrollment" below
- `add-strategy "hermetica"` -> `hermetica-strategy-live` (`0x0166744c…2cae76f01`)
  -- see "Hermetica re-registration" below

## Zest incident: oracle rotation, dust loss, redeploy (2026-08-13)

First real mainnet dust test on Zest (via bityield.click, test wallet
`SP2JS7…PJT3`):
- **Deposit succeeded**: `0xee763c65…9e2b93147`, 1000 sats (0.00001 sBTC) supplied
  into Zest through `zest-strategy-live`, confirmed on-chain.
- **Withdraw reverted**: `0x3b042433…d13eda027`, `(err u30010)` =
  `ERR_INVALID_ORACLE`. Root cause: Zest rotated the sBTC reserve's oracle from
  `stx-btc-oracle-v1-4` (what was verified during design/spike) to
  `stx-btc-oracle-v1-6` sometime after that verification. Our strategy hardcoded
  the old oracle. Confirmed live via `pool-0-reserve-v2-0.get-reserve-state`: all
  four reserve entries that used `stx-btc-oracle-v1-4` (ststx, wstx, sbtc,
  ststxbtc) now use `v1-6`. This was a stale external reference, not a logic bug;
  the revert protected the funds as designed.
- **Recovery attempt FAILED, dust is a permanent small loss (~1000 sats, ~$0.63).**
  Tried: (1) `owner-sweep-ft` the zsBTC out to the deployer -> failed
  `(err u14401)` `ERR_UNAUTHORIZED`, because zsBTC's own `transfer` gates on
  `is-approved-contract`, a Zest-internal whitelist our strategy is not on (zsBTC
  is NOT a freely transferable SIP-010 token in practice, despite implementing
  the interface). (2) direct redeem from the deployer as a plain wallet -> failed
  `(err u30002)` `ERR_NOT_ZERO`, a downstream consequence of (1) never having
  moved any balance. With the sweep path closed and the old contract's oracle
  hardcoded and immutable, there is no on-chain path left to extract this dust.
  Txids: `0x7aaea132…761d7e3` (failed sweep), `0x0d78f672…8efb3dc8b` (failed
  direct redeem).
- **Fix + redeploy**: updated `contracts/zest-strategy-live.clar`, all 6
  references of `stx-btc-oracle-v1-4` -> `stx-btc-oracle-v1-6`, compile-checked
  against a mainnet fork (bumped fork height past the oracle's deploy block
  8712357). Deployed as `zest-strategy-live-v2` (`0x3dcce3b1…36a6e2a11`), router
  `"zest"` re-registered to it, funded 1 STX. `app/.env.local` and
  bityield.click's production env updated to `zest-strategy-live-v2`.
  **The old `zest-strategy-live` should be treated as retired**; do not deposit
  into it again (it is no longer registered on the router, so the app cannot
  route to it, but do not construct manual calls against it either).

**Design lesson (not yet acted on, flag for a future decision):** the oracle
principal is hardcoded as a literal inside `zest-strategy-live`'s Clarity source,
even though Zest's own `borrow-helper-v2-1-7.withdraw` already accepts the
oracle as a caller-supplied trait argument. Had it been threaded through as a
parameter (the same pattern already used for `price-feed-bytes`), an oracle
rotation would have been survivable by updating a parameter, not by losing funds
in an immutable contract. Making this fully dynamic requires another
trait/router interface change (bigger scope than the fix above). Worth deciding
before scaling past dust amounts, since Zest has now rotated this oracle at
least once (v1-4 -> v1-6) during this project's lifetime.

## Dual Stacking enrollment (2026-08-13): in progress, pending next reward cycle

Real dust round trip first, same as Zest: deposit + withdraw 10 sats through
`dual-stacking-strategy-live` via the app, confirmed `success` via the Hiro
API (deposit `0x1f1678a3…`, withdraw `0x92d8ec03…`, both `(ok ...)` on-chain
despite the explorer UI showing "Failed" for both when viewed via BitYield's
own "watch it confirm" link at the time -- a real bug (missing "0x" prefix
on the txid in that link), root-caused and fixed; see "Explorer link bug"
below).
Withdraw returned exactly the deposited amount, as expected: the strategy
was never enrolled, so there was nothing to earn.

**First `enroll-in-program` attempt reverted: `(err u127)` =
`ERR_ENROLL_MINIMUM_HOLD_NOT_MET`, from `sbtc-yield-rewards-v3` itself, not a
bug in our contract.** Root cause: `enroll` checks the caller's *live* sBTC
balance at call time (`get-balance-available`), not cumulative deposit
history. The strategy had just round-tripped its dust back out, so it held 0
sBTC when enrollment was attempted -- below the program's minimum
(`get-min-hold-for-enrollment` = 10,000 sats / 0.0001 sBTC). No funds were at
risk; the call simply reverted and only the STX fee was spent.

**Before retrying, verified this route cannot repeat the Zest failure mode.**
Read the actual deployed `sbtc-yield-rewards-v3.enroll` source: it never
calls `transfer` or takes custody of anything, only writes a participant
registration entry against the caller's principal. So the sBTC never leaves
our strategy contract to enroll. Also re-read sBTC's own `transfer`: unlike
zsBTC, it has no `is-approved-contract`-style whitelist, only the standard
SIP-010 sender check -- so `owner-sweep-ft` on `dual-stacking-strategy-live`
would work as an escape hatch if it were ever needed, which it wasn't here.

**Fix + retry**: funded the test wallet, deposited 10,000 sats via the app
into Dual Stacking (`0x7d76917a…5e5af6`, confirmed via post-conditions +
API -- corrected here from an earlier mistranscribed txid) and left it in
(no withdraw). Called `enroll-in-program` from the deployer immediately
after -- confirmed `success`, `(ok true)` (`0x100b7544…349caa36b`).

**Current state**: `dual-stacking-strategy-live` holds 10,000 sats principal,
enrolled. Enrollment activates the *next* reward cycle (~2 weeks), not
immediately, so there is nothing to observe yet. **Still open**: whether
`distribute-rewards` actually credits an enrolled *contract* the same as a
wallet -- the original Stacks-team question (`docs/outreach-dual-stacking.md`),
never confirmed by them. This will be settled empirically: after the next
cycle, check the strategy's sBTC balance for an increase. If rewards land,
withdraw to prove the full round trip with real yield and capture txids for
the milestone; if not, that's the trigger to actually send the outreach.

## Hermetica re-registration (2026-08-13): found broken during a frontend audit, fixed

A full frontend accuracy pass turned up a real functional bug, not just stale
copy: `"hermetica"` was never registered on the M2 router at all. Confirmed
via `get-strategy` returning `none`. Since the router's `deposit` asserts the
strategy name is registered before doing anything else, any user who
selected Hermetica Structured in the app and confirmed a deposit would have
hit a hard revert. Root cause: the M2 redeploy under the fresh `SP37FXV5…`
deployer only carried over `zest-strategy-live` and `dual-stacking-strategy-live`
(the two routes that needed new withdraw logic); `hermetica-strategy` was
simply never redeployed or re-registered under the new deployer, unlike M1
where it was registered on the old `SP360…` router.

**First fix attempt failed and surfaced a more important finding.** Tried
deploying the current local `contracts/hermetica-strategy.clar` as-is --
reverted immediately with `vm_error: "use of unresolved contract
'SP37FXV56C8S6TNYGVTB06TE9Y449638WG9VK71YB.oracle-trait'"`
(`0xe4211055…ba1db32`, small STX fee spent, no funds at risk). Root cause:
**the local repo has moved ahead of what is actually deployed on mainnet.**
The oracle-dynamic redesign (see below) added `<oracle-trait>` to
`yield-strategy-trait.clar` and every strategy contract's `withdraw`
signature locally, but that redesign was never deployed -- confirmed by
reading the actual deployed `yield-strategy-trait` source, whose `withdraw`
is still `(uint principal uint uint <sip-010-trait> (optional (buff 8192)))`,
6 args, no oracle. So any local strategy file written against the *current*
local trait (oracle-inclusive) is incompatible with what the live router
and live `yield-strategy-trait` actually require, and will fail to resolve
`.oracle-trait` (which doesn't exist under this deployer) before it even
reaches trait-conformance checking.

**Fix**: wrote `contracts/hermetica-strategy-live.clar`, matching the
*actually-deployed* (pre-redesign) interface -- structurally mirrored
against the real deployed `dual-stacking-strategy-live` source (fetched
directly from chain as ground truth, since that contract is proven correct
against the live trait by its own successful round-trip test earlier).
Added the same owner-recovery functions (`owner-sweep-ft`, `owner-sweep-stx`,
`set-contract-owner`) the other two live strategies already have, since none
existed on the original `hermetica-strategy.clar`. Deliberately NOT added to
`Clarinet.toml` -- the local project's `yield-strategy-trait.clar` is the
newer, oracle-inclusive shape, so this file will never pass local
`impl-trait` conformance against it; it is a mainnet-target file, not a
locally-checked one. Deployed successfully (`0x5d74f5e1…ac91e73b2`),
registered on the router (`0x0166744c…2cae76f01`), `.env.local` and the
deposit page updated to point at it, and the app's temporary UI-level
"disabled" workaround removed.

**Standing gotcha for future deploys**: any strategy contract redeployed
under `SP37FXV5…` going forward must match the *actually-deployed* trait
shape (no oracle-trait) until the full oracle-dynamic redesign (router +
trait + all strategies) is deployed together as one coordinated cutover --
mixing local "-live" filenames written against the newer local trait with a
deploy under the current live router will hit this exact
`unresolved contract 'oracle-trait'` error.

## Key accounts (mainnet)

| Role | Address | Notes |
|------|---------|-------|
| M2 deployer / owner | `SP37FXV56C8S6TNYGVTB06TE9Y449638WG9VK71YB` | Fresh isolated deployer; owns the M2 contracts (emergency recovery + admin). Mnemonic in `contracts/settings/Mainnet.toml` (gitignored). |
| Sponsor | `SP1FMF8WWHPNW2X20N0SCV6Q144K2GNQG8K6YDND3` | Pays user tx fees. Key in `app/.env.local` (gitignored, never print). |
| Test wallet | `SP2JS7GJEYRD7MAD5CF9EHSTN1MNA9E219TZ6PJT3` | ~0.00044 sBTC; connect in browser for the deposit test. |
| M1 router (old, live) | `SP360...yield-router` | M1 demo positions; do not reuse. |

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
**DONE through step 3 as of 2026-08-13** (see "Dual Stacking enrollment"
above); waiting on step 4-5.
1. Deposit ≥ 0.0001 sBTC via the app -- and **do not withdraw it**. Enrollment
   checks the strategy's live balance at call time, not deposit history, so
   there must be real principal sitting in the contract when you enroll.
2. Call `enroll-in-program` (admin, deployer key) once the strategy actually
   holds ≥ the program minimum (`sbtc-yield-rewards-v3.get-min-hold-for-enrollment`,
   currently 10,000 sats). Verify success and check enrollment status via the
   rewards contract's read-onlys.
3. Rewards begin the *next* cycle (~2 weeks) and accrue over time, not
   instantly. The Stacks-team dependency (does an enrolled contract get
   credited like a wallet?) is unconfirmed -- treat this cycle as the real
   test of that, rather than waiting on a reply first.
4. After a cycle, check the strategy's sBTC balance for an increase.
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

## Oracle-dynamic redesign (2026-08-13): in progress, NOT deployed

To prevent the Zest incident's exact failure mode (an oracle rotation
permanently stranding funds in an immutable contract), the withdraw interface
was extended so Zest's oracle contract is supplied fresh by the caller at
withdraw time, instead of hardcoded. Local-only so far, not deployed.

**Design:**
- New `contracts/oracle-trait.clar`, defined locally (same rationale as
  `sip-010-trait.clar`), matching Zest's own `oracle-trait` shape.
- `yield-strategy-trait.withdraw` and `yield-router.withdraw` both gained an
  `<oracle-trait>` argument, threaded through exactly like `price-feed-bytes`.
  All 6 strategy contracts updated to accept it (non-Zest strategies ignore it).
- `zest-strategy-live`'s TOP-LEVEL oracle argument (the one that actually broke:
  Zest's `(asserts! (is-eq (contract-of oracle) (get oracle reserve-state))
  ERR_INVALID_ORACLE)`) is now caller-supplied. A future rotation of *this*
  check is a parameter update, not a redeploy.
- The `assets` list's four entries that also reference the STX/BTC oracle
  (ststx, wstx, sbtc, ststxbtc) remain hardcoded literals. This is a genuine
  Clarity limitation, not a choice: a trait-typed parameter can be passed as a
  bare function argument, but cannot be embedded as a value inside a
  tuple/list literal built in contract code (confirmed by compiling: fails
  with a `CallableType(Trait)`/`PrincipalType` mismatch). Making those dynamic
  too would require the caller to supply the entire 10-entry `assets` list as
  a raw transaction argument, pushing Zest's specific structure into the
  shared trait -- a much bigger change, not done.
- Local production test suite (5/5) passes with a `mock-oracle.clar` added for
  the self-contained project.
- Compiles and deploys against a mainnet fork as `zest-strategy-live-v3`.

**STACK-DEPTH ISSUE: ROOT CAUSE FOUND AND FIXED.** A funded deposit + withdraw
attempt, passing the real `stx-btc-oracle-v1-6` contract as the dynamic
`<oracle-trait>` argument, originally failed with `MaxStackDepthReached` deep
inside Zest's own health-factor calculation chain. Confirmed via the actual
stacks-core Rust source (`clarity-types/src/lib.rs`) that this is a REAL
PROTOCOL-LEVEL limit (`MAX_CALL_STACK_DEPTH = 128` in current epochs, `= 64`
legacy; `CallStack.depth() = stack.len() + apply_depth`, incremented per
named function/contract-call and per nested argument-evaluation, per
`clarity/src/vm/mod.rs`), not a simulator artifact. Dynamic trait dispatch
adds real stack frames at each contract boundary the trait value crosses, and
Zest's own logic is already close to the ceiling, so **our own extra
indirection was the fixable part**. Fix applied: inlined the private
`redeem-and-forward` function directly into `withdraw` and
`owner-emergency-zest-redeem` (removing one call-stack frame each), and
reverted the sBTC balance/transfer calls back to the hardcoded literal
instead of the `token` trait parameter (an accidental second trait dispatch
introduced during inlining, caught and fixed). **Result: a funded fork test
with the inlined code got completely past the entire depth-limited health-
factor chain**, reaching a later-stage error instead of `MaxStackDepthReached`
-- proof the fix works. This is the load-bearing, proven result of this
investigation.

**Getting a fully clean end-to-end fork run remains elusive, but for reasons
that look like fork-testing artifacts, not new contract bugs.** Subsequent
re-runs hit inconsistent secondary errors (`u3001` Pyth-fee-insufficient when
the strategy wasn't funded with STX; `u7004` `ERR_DOES_NOT_EXIST` once,
traced exhaustively through every `get-reserve-state` call site in the chain
with no origin found despite all 10 assets confirmed live both at the fork's
height and currently; a Pyth decoder byte-slice error plus a RECURRENCE of
`MaxStackDepthReached` when STX-funding was added, because `transferSTX`
mines an extra block that shifts the fork's timing relative to a
pre-fetched Pyth update). This pattern points at the fork's inability to hold
Pyth timing, Wormhole guardian-set state, and block-mining side effects
consistent together (the same class of limitation documented in
`docs/milestone-2-plan.md` section 11 from the original spike), not at a
regression of the depth fix.

**Recommendation: the depth question is answered; the next decisive step is a
small real mainnet test**, which has correct, non-simulated Pyth/Wormhole
state by construction and would either confirm the inlined design cleanly or
surface a genuinely new issue without fork noise. This has NOT been done.

**STILL NOT DEPLOYED.** `zest-strategy-live-v2` (hardcoded oracle, no trait
dispatch, so structurally not exposed to this depth issue at all) remains the
live, production strategy on mainnet. It has been fixed and redeployed after
the original incident but its own withdraw path has not yet had a full
real-fund confirmation either (see "Zest incident" above) -- that is the
recommended immediate test (see app UI status below), independent of and
simpler than the v3 oracle-dynamic work.

## Explorer link bug: root cause and fix (2026-08-13)

The "watch it confirm on the explorer" link on `/deposit` and `/withdraw`
showed Hiro's explorer rendering genuinely successful BitYield transactions
as "Failed" (or a flat 404, "could not find transaction by ID"). An earlier
pass misdiagnosed this as a Hiro-side rendering quirk specific to sponsored
transactions and shipped a caveat message instead of a real fix -- **that
diagnosis was wrong.**

**Actual root cause, found by directly comparing a broken link against a
manually corrected one**: `@stacks/transactions`' `broadcastTransaction()`
returns the raw Stacks node RPC response body, which is the bare hex txid
with **no `0x` prefix** (confirmed in `fetch.js`: `text.replace(/["]+/g, '')`
strips quotes but never adds `0x`). `app/api/sponsor-tx/route.ts` passed
this bare txid straight through, and `lib/stacks/network.ts`'s
`explorerTxUrl` interpolated it directly into the URL with no normalization
-- producing a link like `.../txid/e79cd72a...` instead of
`.../txid/0xe79cd72a...`. Hiro's explorer either 404s on the malformed id or
renders a false "Failed" badge for it; the transaction itself was correct
and successful the whole time.

This explains why only the deposit/withdraw confirming-flow link was ever
affected, and why the Dashboard and Proof page links looked fine: both of
those source their txids from Hiro's own indexer API (`tx_id` field on
`GET /extended/v1/tx/...` and search results), which always includes `0x`.
Only the raw broadcast-response path -- used solely by the sponsored
deposit/withdraw flow -- was missing it.

**Fix**: `explorerTxUrl` in `lib/stacks/network.ts` now normalizes
(`txid.startsWith('0x') ? txid : `0x${txid}``) regardless of source
formatting. The Dashboard and Proof pages each had their own duplicate local
copy of this function; both now import the single normalized one instead.
The inaccurate "explorer badge is known to mislabel sponsored transactions"
caveat text was removed from `TransactionStatus.tsx` since the actual bug is
fixed, not papered over.

## App UI status (2026-08-13)

`/deposit` now reflects the real per-route status instead of a uniform
"Preview" label: Zest shows **Live** (routes real sBTC into Zest, with a risk
note that it is a new, unaudited deployment with limited testing), Dual
Stacking also shows **Live** (a full deposit-and-withdraw round trip
confirmed on-chain, then a real deposit held and enrolled in the rewards
program — risk note flags that reward payout itself isn't confirmed yet),
Hermetica stays **Preview** (unchanged, no real routing). The risk &
disclosures panel on the confirm screen is now dynamic per selected route
rather than one fixed "preview" paragraph for all three.

## Oracle-dynamic redesign: CONFIRMED BLOCKED, not deployable (2026-08-23)

Follow-up to "Oracle-dynamic redesign" above. That section's "the depth
question is answered, next step is a small real mainnet test" was too
optimistic: the real mainnet test has now been run, and it fails, for a
different and unfixable reason. Do not resume work on a caller-supplied
`<oracle-trait>` for Zest without reading this section first.

**What was tried.** A registry-pinning fix (see "Router registry fix" below)
was deployed alongside an attempt to finish and ship the oracle-dynamic
strategy. New contracts published under the M2 deployer
(`SP37FXV56C8S6TNYGVTB06TE9Y449638WG9VK71YB`):
- `oracle-trait` -- [deploy tx](https://explorer.hiro.so/txid/0x82b3b578aa7df9bff748d7b375d4e706aeef6974d27944c297b5954344d9bb25?chain=mainnet)
- `yield-strategy-trait-v2` (oracle-inclusive withdraw signature) -- [deploy tx](https://explorer.hiro.so/txid/0xd542685361d00923733e2b6e320203e600347970199c5275f53272b462a050a2?chain=mainnet)
- `yield-router-v2` (registry-pinning fix, see below) -- [deploy tx](https://explorer.hiro.so/txid/0xfb972f59bf4d59b0117a28d82cce5b5b26f7b7b66cf587f3fa5620b10b63a1b4?chain=mainnet), confirmed success
- `zest-strategy-live-v3` -- [deploy tx](https://explorer.hiro.so/txid/0xe61e6ec404c00bdebd5b8be8207f4c81de335dbd023dbe11e1993fd4495a1a6c?chain=mainnet), **FAILED**, `abort_by_response`, `vm_error: ":0:0: use of unresolved function 'as-contract'"`. This generic/nonsensical-looking error (`as-contract` is a real builtin) is the Clarity analyzer's fallback message for an internal limit hit during static analysis, not a real problem with that syntax.

**Root cause, confirmed by direct source inspection of Zest's contracts.**
`zest-strategy-live-v3.withdraw` receives `oracle` as a caller-supplied
`<oracle-trait>` value and forwards it into
`borrow-helper-v2-1-7.withdraw`. That function does NOT resolve the oracle
to a concrete value -- it forwards the same trait-typed value again into
`pool-borrow-v2-4.withdraw`, which forwards it a THIRD time into
`pool-0-reserve-v2-0.check-balance-decrease-allowed` (the exact function
whose `(asserts! (is-eq (contract-of oracle) (get oracle reserve-state))
ERR_INVALID_ORACLE)` check broke on 2026-08-13). So a caller-supplied oracle
means three chained hops of dynamic trait dispatch across three separate
real Zest contracts before it's ever used. `zest-strategy-live-v2`'s
hardcoded-literal-oracle approach avoids this entirely -- passing a literal
principal only needs a cheap, bounded conformance check against one known
contract, not full dynamic-dispatch cost analysis three hops deep.

**Verified this is the actual cause, not size/complexity of BitYield's own
code**, via a minimal (~1KB) isolated diagnostic contract
(`zestv3-diag1.clar`, not part of the app) that does nothing but forward a
caller-supplied `<oracle-trait>` into the real `borrow-helper-v2-1-7.withdraw`
with a 1-entry assets list -- [deploy tx](https://explorer.hiro.so/txid/0x7dc8808de0b68ec86bf81336758e88535f6f4d746e2f2118ff42818b7826a995?chain=mainnet),
confirmed on-chain, same identical error. Ruled out first (for free, no
mainnet cost) via local Clarinet tests that forwarding a trait value into a
*different* structurally-identical trait, even with multiple trait args and
`try!`/`as-contract` nesting, type-checks fine in general -- the failure is
specific to Zest's real, multi-hop call chain, not the general pattern.

**Conclusion: this is not fixable from BitYield's side.** The dynamic-dispatch
depth is baked into Zest's own contract architecture (borrow-helper ->
pool-borrow-v2-4 -> pool-0-reserve-v2-0, each re-forwarding the oracle
rather than resolving it early). BitYield only controls the first hop; once
a dynamic trait value enters Zest's chain, their contracts propagate it
three hops deep regardless of how our strategy contract is structured. Only
Zest changing their own withdraw call chain would unblock this -- not
something BitYield can fix by rewriting `zest-strategy-live-v3`. Do not
retry this design without a response from Zest confirming a different entry
point exists.

**`zest-strategy-live-v3` and `yield-strategy-trait-v2` are dead ends as
currently designed.** `zest-strategy-live-v2` (hardcoded oracle) remains the
correct, only-viable strategy for the Zest route. The residual risk from the
2026-08-13 incident (a future oracle rotation stranding funds with no
recovery path, since Zest's zsBTC can only move through their own gated
redeem, which requires the exact current oracle) is not solvable at the
contract level. Mitigate operationally: keep Zest TVL low until there's a
fast detect-and-redeploy runbook, and lean on the router registry fix below
so a redeploy-on-rotation no longer risks misdirecting existing positions.

## Zest incident #2: borrow-helper rotation + a second oracle bump (2026-09-08)

`zest-strategy-live-v2` broke: a real deposit aborted with `(err u8000001)`.
Root cause, redeploy, and the residual Pyth-Lazer gap in the withdraw
price-feed source are all written up in
[`contracts/DEPLOYMENT.md`](../contracts/DEPLOYMENT.md#zest-incident-2-borrow-helper-rotation--a-second-oracle-bump-2026-09-08)
rather than duplicated here. Short version: Zest revoked the old
`borrow-helper-v2-1-7` from `incentives-v2-2`'s approved-contracts allowlist
in favor of `v2-1-8`, and bundled in a second oracle rotation
(`stx-btc-oracle-v1-6` -> `v1-7`, also switching to Pyth Lazer). Fixed as
`zest-strategy-live-v4` (deliberately not `-v3` - see that file's header and
"Oracle-dynamic redesign" below for why that name is reserved for a
different, abandoned design). TVL was `0` at the time, so no funds were at
risk.

## Router registry fix: strategy-contract pinning (2026-08-23)

Separate from the above, fixed and deployed: `yield-router.clar`'s
`positions` map previously stored only a `strategy` name
(`string-ascii 20`), re-resolved through the mutable `strategy-contracts`
registry on every withdraw. If an admin ever repointed a name to a new
contract (e.g. exactly the kind of v2 -> v3 cutover this session attempted),
an already-open position's withdraw would silently resolve against the new
contract instead of the one its funds actually sit in -- best case a revert,
worst case paying out of a different strategy's pooled balance.

**Fix**: positions now store `strategy-contract: principal`, pinned at
deposit time from the registry lookup, and `withdraw` validates the caller's
strategy argument against that pinned value instead of a fresh registry
lookup. Deployed as `yield-router-v2` (`SP37FXV56C8S6TNYGVTB06TE9Y449638WG9VK71YB.yield-router-v2`,
[deploy tx](https://explorer.hiro.so/txid/0xfb972f59bf4d59b0117a28d82cce5b5b26f7b7b66cf587f3fa5620b10b63a1b4?chain=mainnet),
confirmed success) alongside `oracle-trait` and `yield-strategy-trait-v2`
(needed as `yield-router-v2` dependencies, both also live).

**Not yet wired to live traffic.** No strategies are registered on
`yield-router-v2` and the frontend still points at the original router --
the currently-live Zest route (`zest-strategy-live-v2`) is unaffected and
serving users exactly as before. Since the paired Zest v3 fix above is a
dead end, `yield-router-v2` has no strategy to register yet without either
(a) accepting `zest-strategy-live-v2`'s hardcoded-oracle shape (6-arg
withdraw, no oracle-trait -- meaning `yield-router-v2`'s oracle-inclusive
withdraw signature doesn't match it either, so it can't be registered as-is)
or (b) a further redesign. Follow-up needed before this fix protects
anything live.
