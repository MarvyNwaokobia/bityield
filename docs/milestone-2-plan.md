# v0.2 Plan: Live Protocol Routing

> Integrate BitYield with live Stacks yield protocol routing, into at least two
> live yield opportunities, with at least one mainnet interaction per route.

**Status:** Build in progress, LOCAL ONLY. Milestone 1 is still under review, so
nothing here is deployed to mainnet and nothing is committed to git yet, by
design. Real-fund / mainnet-transaction testing is deferred to a later session
(the user will run it). Contracts and app code are being assembled now so that
only real-transaction testing remains when the M1 result lands. Route 1 (Zest)
and Route 2 (Dual Stacking) are the two routes; Bitflow and Hermetica are on the
roadmap behind them.

**What is code-complete vs what still needs testing:**
- Withdraw price-feed interface change, `zest-strategy-live`, `dual-stacking-strategy-live`: written locally.
- Zest funded DEPOSIT: proven in a mainnet-fork simnet.
- Zest funded WITHDRAW and Dual Stacking end to end: **still need real-fund testing** (see §11). No blocking contract issues known; the remaining proof is a small real mainnet round-trip.

---

## 1. The milestone, in one paragraph

The Stacks Endowment pays out 30% when BitYield is integrated with at least two
live Stacks yield opportunities, at least one mainnet transaction or protocol
interaction has completed through BitYield for each route, route-specific
position information is visible to the user, and documentation, transaction
evidence, and a demo are available.

The two routes we are building now:

1. **Zest** (route 1): lending interest. Supply sBTC, earn the interest
   borrowers pay. Bitcoin in, Bitcoin out.
2. **Dual Stacking** (route 2): the Stacks network's own Bitcoin rewards
   program. Enroll sBTC, earn BTC-denominated rewards. sBTC is never locked or
   transferred away, and rewards are paid in sBTC.

Two structurally different kinds of Bitcoin yield (borrowing interest vs network
rewards), both paid in Bitcoin. That is a clean story for the Endowment.

---

## 2. Where we are today

The router and strategy architecture already exists and is live on mainnet. What
is missing is the actual protocol connection.

- [`yield-router`](../contracts/contracts/yield-router.clar) is a non-custodial
  routing and accounting layer. It transfers a user's sBTC to a strategy
  contract, records a position, and delegates yield to that strategy.
- Each strategy implements the shared
  [`yield-strategy-trait`](../contracts/contracts/yield-strategy-trait.clar)
  (`deposit`, `withdraw`, `get-apy`, `get-tvl`).
- Today the [`zest-strategy`](../contracts/contracts/zest-strategy.clar) and
  [`dual-stacking-strategy`](../contracts/contracts/dual-stacking-strategy.clar)
  are **preview** contracts: they hold the sBTC themselves and pay a fixed,
  admin-set APY computed linearly from elapsed block height. They model the
  target protocols but do not route to them.

Milestone 2 is the work of making these two strategies route into the real
protocols. This also requires one deliberate, breaking change to the router and
trait `withdraw` interface (to carry Zest's price feed), done now while the
system is a pre-launch controlled demo. See sections 4 and 11.

---

## 3. The two routes we build now

### Route 1: Zest (lending interest)

- **What it is:** Zest is the largest lending market on Stacks, an Aave v3 style
  protocol written in Clarity. You supply sBTC into the pool, borrowers pay
  interest, and you earn it. You receive a `zsBTC` receipt token that redeems
  for your sBTC plus accrued interest.
- **Mainnet contracts: CONFIRMED from real successful sBTC transactions.**
  Deployer `SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N`. Every contract below was
  read off a real, successful, on-chain sBTC deposit and withdrawal (not GitHub,
  not existence checks). Evidence: supply tx `0xae517f80…`, sBTC withdraw tx
  `0xcee0ca58…` (plus three more consistent sBTC withdraws).

  | Contract | Role | Confirmed by |
  |----------|------|--------------|
  | `borrow-helper-v2-1-7` | The live wrapper we call: `supply` / `withdraw` | both txs |
  | `pool-borrow-v2-4` | Core pool the helper delegates to | helper source |
  | `pool-0-reserve-v2-0` | Reserve / user state, for live value + APY reads | both txs |
  | `zsbtc-v2-0` | sBTC receipt token, passed as `lp`, accrues to our strategy | both txs |
  | `stx-btc-oracle-v1-4` | sBTC oracle, passed as `oracle` on `withdraw` | 4 sBTC withdraws |
  | `incentives-v2-2` | Rewards contract, passed as `incentives` (must pass `is-rewards-contract`) | both txs |

  Asset: `SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token` (canonical, matches
  the router). Price feed on withdraw: a Pyth update payload
  (`(some 0x504e4155…)`) sourced from
  `SP2T5JKWWP3FYYX4YRK8GK5BG2YCNGEAEY2P2PKN0.pyth-oracle-v2` / `pyth-store-v1`.

  NOTE ON EARLIER DRAFTS: prior versions of this doc named `borrow-helper-v2-1`,
  `pool-borrow-v2-1`, and `sbtc-oracle-v1-0`. All three were wrong; the live path
  uses `-v2-1-7`, `pool-borrow-v2-4`, and `stx-btc-oracle-v1-4`. Only the
  real-transaction trace is authoritative.
- **Supply path (confirmed):** `borrow-helper-v2-1-7.supply(lp=zsbtc-v2-0,
  pool-reserve=pool-0-reserve-v2-0, asset=sbtc-token, amount, owner,
  referral, incentives=incentives-v2-2)`, mints `zsbtc-v2-0`. The deployed
  `supply` asserts `(is-eq tx-sender contract-caller)`, so the strategy must
  call via `as-contract`. This guard is real (read in deployed source).
- **Withdraw path (confirmed):** `borrow-helper-v2-1-7.withdraw(lp, pool-reserve,
  asset, oracle=stx-btc-oracle-v1-4, amount, owner, assets, incentives,
  price-feed-bytes)`. Real sBTC withdraws pass `price-feed-bytes` as
  `(some 0x…Pyth update)`, never `none`. So our withdraw MUST source and pass a
  fresh Pyth price update. This is confirmed, not hypothetical.
- **Key constraint:** Zest's `supply` and `withdraw` assert
  `(is-eq tx-sender contract-caller)`. A plain contract-to-contract call fails
  this. The way through is for our `zest-strategy` to hold the sBTC and call Zest
  via `(as-contract ...)`, so inside Zest both `tx-sender` and `contract-caller`
  are the strategy contract. The `zsBTC` then accrues to the strategy, matching
  our existing custody model.
- **Spike outcome (2026-07-15):** both route-1 unknowns are now settled against
  live contracts. `as-contract` clears the guard (proven), and the price-feed
  bytes must be carried through the withdraw interface (design decided). Full
  detail in section 11.
- **Built (local, needs testing):** `contracts/zest-strategy-live.clar`. Pooled
  design: all users' sBTC is supplied into one Zest position; the strategy tracks
  `total-principal`. On withdraw it redeems the position's **pro-rata share of
  the pool** (`amount * total-value / total-principal`, where `total-value` is
  the interest-inclusive `zsbtc get-balance`), so a position gets principal plus
  its share of accrued interest. This matches the Dual Stacking strategy's model.
  Pro-rata by principal for now; time-weighting is a follow-up.

### Route 2: Dual Stacking (network rewards)

- **What it is:** Stacks' first-party Bitcoin rewards program. You enroll your
  sBTC and the network pays you rewards in sBTC. Your sBTC is never locked or
  moved. Base rate is around 0.5% on sBTC alone, rising toward roughly 5% when
  STX is stacked alongside. Minimum to enroll is 0.0001 sBTC.
- **Contract:** `SP804CDG3KBN9M6E00AD744K8DC697G7HBCG520Q.sbtc-yield-rewards-v3`
  (verified against deployed source).
- **Enroll path:** `enroll (rewarded-address (optional principal))`. Verified:
  there is **no** `tx-sender == contract-caller` guard. It checks that the
  caller is not already enrolled, is not blacklisted, and holds at least the
  minimum sBTC. A contract that holds sBTC passes all three, so our
  `dual-stacking-strategy` can enroll itself. The contract also exposes an
  admin-gated `enroll-defi (defi-contract principal ...)` built specifically to
  enroll DeFi protocol contracts.
- **The one real dependency:** reward distribution is admin-driven
  (`distribute-rewards` is called by the program admin over a list of
  participants). We need to confirm with the Stacks team that our enrolled
  strategy contract gets picked up, and ideally get it registered via
  `enroll-defi`. Start this conversation early. It is not a code blocker, but it
  is an external dependency.
- **Main engineering:** rewards arrive as extra sBTC in the strategy over time.
  The strategy needs pro-rata accounting to split rewards fairly across open
  positions by amount and time, replacing the current fixed-APY formula.
- **Built (local, needs testing):** `contracts/dual-stacking-strategy-live.clar`.
  `deposit` tracks principal (the router already moved the sBTC here); an admin
  `enroll-in-program` calls the rewards contract's `enroll` (no `as-contract`
  needed, since `enroll` keys off `contract-caller` = this strategy); `withdraw`
  pays principal plus the position's pro-rata share of accrued rewards
  (`balance - total-principal`). The pro-rata split is by principal for now;
  time-weighting is a follow-up. Still needs: mainnet enrol + a real reward
  cycle + withdraw, and the Stacks-team confirmation that an enrolled contract
  is picked up by `distribute-rewards`.

---

## 4. Architecture: how this plugs in

**Design decision (updated after the week-1 spike): each strategy hardcodes the
protocol's mainnet principals, AND the `withdraw` interface gains an optional
price-feed buffer, which requires a one-time router + trait redeploy now.**

Each new strategy **hardcodes the known mainnet principals** of the protocol it
routes into (for Zest: `borrow-helper-v2-1-7`, `pool-borrow-v2-4`, `zsbtc-v2-0`,
`stx-btc-oracle-v1-4`, `incentives-v2-2`), so those never need to travel through
the router. That keeps the router free of protocol-specific references.

The one thing that cannot be hidden inside the strategy is Zest's Pyth
`price-feed-bytes` on `withdraw`: the spike (section 11) confirmed the bytes
originate off-chain and must flow frontend -> router -> strategy -> Zest. The
current trait and router `withdraw` have no buffer argument, so we **add
`(price-feed-bytes (optional (buff 8192)))` to both and pass it through**.
Non-oracle strategies ignore it (`none`). This is a breaking change to the
router, done deliberately now, pre-launch and pre-audit, so the audited
interface is the final one. See section 11 for the full rationale. Deposit and
supply need no price feed, so that interface is unchanged.

Consequences to handle:

- **Real yield is variable, not a formula.** The strategy's `withdraw` returns
  the actual payout from the protocol, and the router already returns whatever
  the strategy returns, so on-chain payout is correct. But the router's
  read-only `get-position-value` still estimates value from the stored fixed
  APY. For real strategies the live "current value" shown in the UI must instead
  read from the protocol (Zest reserve state, or accrued Dual Stacking rewards).
  This is frontend plus read-only work, not a router change.
- **Custody is unchanged.** The router still transfers the user's sBTC to the
  strategy on deposit. For Zest the strategy forwards it into the pool; for Dual
  Stacking the strategy simply holds it (that is what accrues rewards).

After the one-time `withdraw` interface change above, adding each live route is a
single `add-strategy` admin call on the (new) router, or a swap of the preview
strategy for the live one. The redeploy happens once, now, for the price-feed
change; it is not per-route.

---

## 5. Roadmap (behind the two we build now)

### Route 3: Bitflow (liquidity-pool yield) — next

Bitflow is the main DEX on Stacks. You provide sBTC into a trading pool and earn
a share of swap fees plus incentives. Live sBTC pools today: STX-sBTC (around
$358K TVL, ~11.4% APR) and sBTC-USDCx (around $300K TVL, ~31.7% APR), both DLMM.
Its `add-liquidity` and `withdraw-liquidity` have no `tx-sender` guard and no
oracle arguments, so it is actually cleaner to call than Zest. It ranks third
only because it is a two-sided pool: it carries **impermanent loss**, needs a
USD-token leg or a single-sided bin, and can return a mix of sBTC and USD. That
rubs against the "your Bitcoin stays Bitcoin" pitch, so we hold it until the LP
UX is designed properly.

### Later: Hermetica and a USD / stablecoin track

Hermetica is a real, working protocol. Its main yield (8 to 16%) comes from
converting Bitcoin into its dollar stablecoin USDh and staking that to sUSDh.
That is why it is not one of the first two routes: it turns Bitcoin into a
synthetic dollar, which is the opposite of the promise the first two routes
keep.

But it points at a deliberate product expansion for later. When we add
Hermetica, BitYield stops being Bitcoin-only and gains a **USD / stablecoin
track**:

- Offer a dollar-denominated yield option (USDh / sUSDh) alongside the Bitcoin
  ones, clearly labeled as dollar exposure, not Bitcoin.
- Add **conversion routes both ways**: let a user move sBTC / BTC into a USD
  position, and let a user bring USD in and convert it to sBTC / BTC to earn
  Bitcoin yield. BitYield becomes the on-ramp between the two sides rather than
  Bitcoin-only.

This is a roadmap item, not current scope. It is noted here so the two-track
design is intentional when we get to it.

---

## 6. Frontend changes

The strategy plumbing already exists in
[`network.ts`](../app/lib/stacks/network.ts) (both `zest` and `dual-stacking`
are first-class strategies).

**Wired (local, 2026-07-15):**
- Withdraw carries the Pyth price feed. New `app/app/api/pyth-price/route.ts`
  fetches a fresh Hermes update (STX/USD + BTC/USD) server-side;
  `app/lib/stacks/pyth.ts` decodes it; `submitWithdrawTx` fetches it right before
  submit and passes `(some bytes)` for oracle-priced routes (Zest) and `none`
  for the rest. Typechecks clean.
- Live-strategy addresses are env-driven: set `NEXT_PUBLIC_ZEST_STRATEGY_ADDRESS`
  and `NEXT_PUBLIC_DUAL_STRATEGY_ADDRESS` to the deployed `-live` contracts after
  deploy (documented in `app/.env.example`). `PYTH_HERMES_URL` overridable.

**Deliberately deferred (need live data and/or founder copy):**
- Route cards on `/deposit`: live APY per route. Zest's `get-apy` returns a raw
  reserve rate, not a percentage; the conversion is plausible but must be
  validated against the deployed contract before display, or we risk showing a
  wrong number. Do at testing time.
- Route-specific **position status**: real current value comes from the deployed
  strategy, so validate live.
- Route-specific **risk information** and flipping the "Preview" framing to live
  routing: user-facing copy the founder owns, and it must ship in lockstep with
  the live contracts (otherwise it is false). Satisfies the milestone's "relevant
  protocol risk information" criterion; to be written with founder input.
- `/proof` page: surface the per-route mainnet interactions once they exist.

---

## 7. Testing approach

Zest and the Dual Stacking rewards program are mainnet-only, so there is no
shared testnet to integrate against. Two-layer approach:

1. **Clarinet simnet against mainnet state** (mainnet requirements / execution
   snapshot) to exercise the strategy calls into the real protocol contracts
   without spending funds.
2. **Small real mainnet interactions** per route (the project already does this
   with 0.0003 sBTC test deposits), which also produce the transaction evidence
   the milestone requires.

---

## 8. Deliverables mapping

| Acceptance criterion | Where it is satisfied |
|----------------------|------------------------|
| Two live yield opportunities | Zest (lending) + Dual Stacking (rewards) |
| One mainnet interaction per route | Real supply into Zest; real enroll + accrual for Dual Stacking, on `/proof` |
| Route-specific position info | Per-route cards and position status on `/deposit` and `/dashboard` |
| Protocol risk information | Per-route risk panels |
| Documentation | This doc plus updated README and DEPLOYMENT |
| Transaction evidence | `/proof` page plus explorer links |
| Demo | Demo video covering the routing flow |

---

## 9. Timeline

Today is 2026-07-15. Estimate is roughly 3 weeks of focused build plus buffer,
with August 15 as the external deliverable date.

- **Week 1 (Jul 15 to 22): Zest.** Resolve the price-feed spike, build the live
  `zest-strategy`, first real mainnet supply and withdraw, live APY read.
- **Week 2 (Jul 22 to 29): Dual Stacking.** Build enroll plus pro-rata reward
  accounting into `dual-stacking-strategy`, enroll on mainnet, verify accrual.
  Start the Stacks-team `enroll-defi` conversation at the beginning of this week.
- **Week 3 (Jul 29 to Aug 5): Frontend and evidence.** Route cards, live
  position values, per-route risk copy, `/proof` updates.
- **Buffer (Aug 5 to 15):** documentation, transaction evidence, demo video, and
  slack for on-chain surprises.

Dual Stacking is a lighter integration than an LP would have been (no second
asset, no impermanent loss, no oracle), so the plan trends toward the shorter
end. August 15 is comfortable rather than tight.

---

## 10. Open questions and dependencies

1. **`as-contract` clears the guard: PROVEN** (week-1 spike, section 11). No
   longer open.
2. **Zest withdraw price feed: RESOLVED, with a design decision required.** All
   real sBTC withdraws pass `price-feed-bytes` as `(some 0x…Pyth update)`, never
   `none`, so our `withdraw` must carry fresh Pyth bytes end to end. The current
   `yield-strategy-trait.withdraw` has no buffer argument, so the bytes cannot
   reach the strategy. Decision (section 11): add an optional price-feed buffer
   to the trait and router `withdraw` now, pre-launch, and redeploy. Confirm as
   a build task, but the direction is set.
3. **Zest mainnet principals: RESOLVED by on-chain evidence** (section 3,
   Route 1). Still worth a courtesy confirmation with the Zest team that these
   versions are not about to be migrated, and that `incentives-v2-2` passes their
   `is-rewards-contract` check for a contract caller.
4. **Withdraw with `none`:** secondary optimization. Unknown whether Zest's
   withdraw succeeds with `price-feed-bytes = none` when a fresh price already
   exists from another transaction. Not a blocker (we design to always carry
   bytes); worth confirming later as it could simplify some flows.
5. **Dual Stacking distribution:** confirm with the Stacks team that an enrolled
   strategy contract is picked up by `distribute-rewards`, and register via
   `enroll-defi` if needed. Also confirm `sbtc-yield-rewards-v3` is the active
   program (a `-v2` also exists on-chain).

### Verification protocol before any user funds (non-negotiable)

This plan is scoping research, not a safety certification. Before real money
moves through any route: identify the canonical live contract from actual
on-chain usage, read its deployed source in full, confirm with the protocol
team, prove the flow in a Clarinet simnet against mainnet state, run tiny
real mainnet test transactions (single-digit-dollar sBTC), and only then keep
the existing gates the README already requires: an independent audit of the
routing contracts and multisig ownership before any public launch.

---

## 11. Week-1 Zest spike results (executed 2026-07-15)

The spike ran a Clarinet mainnet-fork simnet (`clarinet-sdk` remote data,
`api_url = https://api.hiro.so`) that executes the **real deployed Zest
contracts**, and answered the two questions that gated route 1.

Reproducible artifacts (spike-only, not deployed; the main `Clarinet.toml` is
untouched and the production test suite is unaffected):

- `contracts/Clarinet.spike.toml` (remote-data manifest)
- `contracts/contracts/spike-zest-supplier.clar` (calls Zest `supply` two ways)
- `contracts/spike/run-guard-test.mjs` (the assertion runner)

Run with: `node spike/run-guard-test.mjs` from `contracts/`.

### Result 1: `as-contract` clears Zest's guard — PROVEN

`borrow-helper-v2-1-7.supply` opens with
`(asserts! (is-eq tx-sender contract-caller) ERR_UNAUTHORIZED)`
(`ERR_UNAUTHORIZED = u1000000000000`). Because this assert precedes any token
transfer, the error code alone proves whether the guard passed, with no sBTC
funding needed.

| Call path | Result | Meaning |
|-----------|--------|---------|
| Intermediary contract, no `as-contract` | `(err u1000000000000)` | Guard blocks it, as expected |
| `as-contract` wrapping the call | `(err u1)` | Guard cleared; ran the real supply logic and failed only at the final sBTC transfer (no funds), the expected shape |

The `as-contract` path additionally executed Zest's real rewards and pool
accounting and set `assets-supplied: (sbtc-token)` **attributed to the strategy
contract as owner**. So the intended custody model (strategy holds the position
and the `zsbtc-v2-0`) is confirmed against live contracts, not just in theory.
The only thing that stopped a complete supply was the deliberate absence of
funding.

### Result 2: price-feed pass-through — design decided

Confirmed constraint: Zest `withdraw` needs a fresh Pyth `price-feed-bytes`
in the same transaction, and those bytes originate off-chain (frontend fetches
from Pyth). They must therefore flow: frontend -> `router.withdraw` ->
`strategy.withdraw` -> Zest. The current interfaces cannot carry them:

- Trait: `withdraw (uint principal uint uint <sip-010-trait>)` — no buffer.
- Router: calls `strategy withdraw` with a fixed 5-arg shape, no buffer.

**Decision: add `(price-feed-bytes (optional (buff 8192)))` to the `withdraw`
of both the `yield-strategy-trait` and the `yield-router`, and pass it through.
Non-oracle strategies (`mock-yield`, `dual-stacking`) ignore it by passing
`none`; `zest-strategy` forwards it into Zest.** This requires a router
redeploy, which breaks the "router never redeployed, positions never migrate"
property. That property matters after public launch, not now: today the system
is a controlled, pre-audit, single-key demo holding only tiny test positions.
Making the breaking interface change **now**, during Milestone 2 and before the
audit, means the audited interface is the final correct one. Deposit/supply
needs no price feed and its interface is unchanged.

### Result 3: interface change implemented + funded round-trip in the fork

Built on the above (all in-repo, production Clarinet suite still 5/5 green):

- The `withdraw` price-feed buffer was added to the trait, the router, and all
  four strategies, and the router passes it through. Production tests pass.
- A live `zest-strategy-live.clar` was written and **compiles and deploys against
  the mainnet fork**, which also proves literal contract principals work as
  trait arguments, including the trait-typed tuple fields in Zest's withdraw
  `assets` list (the riskiest compile question).
- **Funded DEPOSIT proven end to end.** Impersonating a ~276 sBTC whale, a 0.01
  sBTC (`u1000000`) deposit through the real `yield-router` into
  `zest-strategy-live` into real Zest `supply` succeeded: `(ok u0)` and the
  strategy's `zsbtc-v2-0` balance went `u0 -> u1000000`. The whale's sBTC fell
  by exactly the deposit. This is the entire deposit path with real funds, not a
  mock.
- **Withdraw with `none` correctly rejected.** A withdraw passing
  `price-feed-bytes = none` returned `(err u30024)` and Zest printed
  `"no-feed-update"`. This both (a) answers open question 4 (Zest requires a
  fresh Pyth update; `none` does not work) and (b) proves our price-feed
  plumbing reaches Zest end to end, since the `none` we passed was forwarded
  through router and strategy and acted on by Zest.
- **Withdraw with a live Pyth update: all real requirements identified; a fully
  green fork withdraw is blocked only by a Wormhole/fork artifact.** Forking at
  the tip and passing a live Pyth Hermes update (STX/USD + BTC/USD), the update
  verified and `pyth-storage-v4` logged both feeds `updated`. Peeling the errors
  in order surfaced the real requirements a live `zest-strategy` withdraw must
  satisfy, each now understood:
  1. `u30024` (`ERR_INVALID_ASSETS`): the `assets` argument must list **every**
     Zest reserve asset (10 of them), in registry order, each with its
     `{asset, lp-token, oracle}`. Ground-truthed from a real sBTC withdraw tx
     and hardcoded in `zest-strategy-live`.
  2. `u3001` (`ERR_BALANCE_INSUFFICIENT` in `pyth-oracle-v4`): the Pyth update
     charges an **STX fee** to `tx-sender` (= the strategy under `as-contract`).
     The strategy must hold a small STX balance to pay it. IMPORTANT product
     note: the user still pays no STX; BitYield funds the strategy's STX, in the
     same spirit as the existing fee-sponsorship. Fee is tiny (~2 uSTX for 2
     feeds) but must be > 0 balance.
  3. `u1103` (`ERR_VAA_CHECKS_GUARDIAN_SET_CONSISTENCY` in `wormhole-core-v4`):
     appears only after funding STX via a `transferSTX` that mines an extra
     block, which perturbs the fork's Wormhole guardian-set state. Without that
     extra block the same VAA verified fine (feeds updated). This is a
     fork-harness limitation of replaying live Wormhole VAAs against historical
     guardian state while advancing the clock, NOT a Zest or BitYield contract
     issue.
  Conclusion: deposit is proven with real funds; the withdraw path is fully
  understood and its contract requirements are implemented. The **definitive**
  end-to-end withdraw proof is a small real mainnet round-trip (checklist track
  D), where the client fetches a live update and pays the fee in one real block,
  with no fork/guardian-set mismatch.

Artifacts: `contracts/contracts/zest-strategy-live.clar`,
`contracts/Clarinet.zest.toml`, `contracts/spike/run-roundtrip.mjs`.

---

## 12. v0.2 completion checklist

Grouped by track. "Done" items reflect the research and week-1 spike already
completed. This checklist targets grant acceptance; the audit and multisig items
are gated to public launch, not to Milestone 2 sign-off, and are listed
separately at the end.

### A. Research and de-risking
- [x] Confirm Zest live sBTC contracts from real on-chain transactions
- [x] Confirm Dual Stacking rewards contract from deployed source
- [x] Prove `as-contract` clears Zest's `tx-sender == contract-caller` guard (mainnet-fork spike)
- [x] Decide the price-feed pass-through design (optional buffer on `withdraw`)
- [ ] Confirm `sbtc-yield-rewards-v3` is the active Dual Stacking program (vs `-v2`)

### B. Outreach (has lead time, start now)
- [ ] Stacks team: confirm an enrolled contract is picked up by `distribute-rewards`
- [ ] Stacks team: request `enroll-defi` registration for the strategy contract
- [ ] Zest team: courtesy confirm no imminent contract-version migration (optional)

### C. Contracts (build)
- [ ] Add `(price-feed-bytes (optional (buff 8192)))` to `yield-strategy-trait.withdraw`
- [ ] Add the same optional buffer to `yield-router.withdraw` and pass it through
- [ ] Redeploy the router + re-register strategies (one-time, pre-audit)
- [ ] Build live `zest-strategy`: `as-contract` supply into `borrow-helper-v2-1-7`; withdraw with Pyth bytes; real payout accounting
- [ ] Build live `dual-stacking-strategy`: enroll once; pro-rata reward accounting across positions
- [ ] Read live APY/TVL from each protocol (replace fixed preview rate)

### D. Testing and evidence
- [ ] Funded Zest supply -> withdraw round-trip in mainnet-fork simnet (settles Pyth sourcing)
- [ ] Funded Dual Stacking enroll + accrual test in simnet
- [ ] One real mainnet interaction per route (small, team-funded) for transaction evidence
- [ ] Production Clarinet test suite green for the new strategies + router

### E. Frontend
- [ ] Route cards on `/deposit` show real live APY per route
- [ ] Route-specific position status (value read from the protocol, in BTC terms)
- [ ] Route-specific risk information panels (lending risk; rewards-timing/program risk)
- [ ] `/proof` surfaces the per-route mainnet interactions with explorer links

### F. Deliverables (milestone sign-off)
- [ ] Update README + DEPLOYMENT with the live routes and new addresses
- [ ] Transaction evidence page/links assembled
- [ ] Demo video covering the two-route flow
- [ ] Submit for Endowment verification

### Gated to public launch (NOT required for v0.2 sign-off)
- [ ] Independent audit of the routing + strategy contracts
- [ ] Move contract ownership to a multisig / cold wallet
