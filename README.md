# BitYield

> One-tap Bitcoin yield for every BTC holder. Built on Stacks.

**Live:** https://bityield.click

[![Built on Stacks](https://img.shields.io/badge/Built%20on-Stacks-orange)](https://stacks.co)
[![Asset](https://img.shields.io/badge/Asset-sBTC-yellow)](https://stacks.co/sbtc)
[![Network](https://img.shields.io/badge/Deployed%20on-Bitcoin%20Mainnet-brightgreen)](#deployment)
[![Stage](https://img.shields.io/badge/Stage-Controlled%20demo%20(v0.2)-blue)](#status)
[![License](https://img.shields.io/badge/License-MIT-green)](./LICENSE)

---

## Status

**v0.1 is deployed on Bitcoin mainnet as a controlled demo** — not yet an open public launch. Connect a Leather wallet,
deposit real sBTC, review the yield opportunity and risk disclosures, and
confirm — with every transaction's STX fee sponsored so users never need to
hold STX. The full flow is live and verifiable on-chain (see the demo
transactions under [v0.1 — deposit flow](#v01--deposit-flow)).

**v0.1** delivered the end-to-end **deposit flow** — wallet, balance, yield
opportunity, risk review, sponsored confirmation, on-chain position.
**v0.2 is now live**: real routing into both Zest Protocol lending and the
Dual Stacking rewards program, deployed on Bitcoin mainnet under a fresh,
isolated deployer, each with a confirmed real mainnet deposit. The contracts
are unaudited and owner-controlled by a single key today; a public launch is
gated on an independent audit and a multisig owner (see [Roadmap](#roadmap)).

- `YieldRouter` (mainnet, v0.2):
  [`SP37FXV56C8S6TNYGVTB06TE9Y449638WG9VK71YB.yield-router`](https://explorer.hiro.so/address/SP37FXV56C8S6TNYGVTB06TE9Y449638WG9VK71YB?chain=mainnet)
- Router points at the canonical mainnet sBTC token
  (`SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token`).
- **Live routing:** the `zest` strategy (`zest-strategy-live-v2`) routes real
  sBTC into Zest Protocol lending, with a **confirmed successful real deposit
  and withdrawal** through the app. The `dual-stacking` strategy
  (`dual-stacking-strategy-live`) routes real sBTC into the Stacks network's
  own Dual Stacking rewards program, with a **confirmed deposit-and-withdraw
  round trip**, and is currently enrolled and holding real principal pending
  its first reward cycle (see [v0.2 — real protocol
  routing](#v02--real-protocol-routing) below for both). Both routes'
  APY is read live from the protocol, not a fixed BitYield rate — it can be
  small (Zest's reflects real current borrowing demand). A third strategy,
  `hermetica`, is also deployed and registered on the router today, but
  remains a **preview** (fixed admin-set APY, does not route to a real
  protocol yet) — see [Roadmap](#roadmap).
- The v0.1 router (`SP360GQARJRHQEFBW21RP957MC8YPJYHYJQTPKVFN.yield-router`)
  and its preview strategies remain live and untouched; they are not part of
  v0.2 routing.

See [Deployment](#deployment) below and `contracts/DEPLOYMENT.md` for the full
deploy + verification details.

---

## The problem

$1.3 trillion in Bitcoin is earning 0%.

The people who own it are not passive by choice. They bought Bitcoin because
it is simple, safe, and self-custodial. Every existing path to yield asks
them to give up at least one of those three things: bridge your BTC to
another chain, wrap it into a token you do not recognize, learn an interface
designed for DeFi power users, pay gas in a token you do not hold, or trust
a protocol you have never heard of.

The result is a paradox. The infrastructure to make Bitcoin productive is
live, audited, and holding hundreds of millions in TVL. But Bitcoin's daily
active addresses on Stacks remain in the low thousands despite over 400,000
wallets created. The gap is not infrastructure. The gap is the consumer layer.

---

## What BitYield does

BitYield is a Bitcoin yield dashboard that connects passive BTC holders to
live yield protocols on Stacks in under two minutes, with no prior knowledge
of Stacks, sBTC, or DeFi required.

The user flow is four steps:

  Connect wallet  →  See your BTC  →  Choose yield  →  One tap to deploy

That is the entire experience. The complexity lives underneath.

What the user sees:
- Their Bitcoin balance shown in BTC, never in sBTC or STX
- A live yield rate from the best available strategy
- A single Start Earning button
- Their earnings denominated in Bitcoin

What BitYield handles for the user:
- Gas fees: fee abstraction so **no STX** is required from the user (live)
- sBTC on-ramp: links out to the official sBTC bridge to convert BTC → sBTC (live)
- Position tracking: yield shown in BTC terms the user understands (live)
- Protocol routing: real routing into Zest and Dual Stacking (live — see
  [Status](#status)); Hermetica remains a fixed-rate preview (roadmap)

---

## Why Stacks makes this possible

Three things are true on Stacks that are not true on any other chain.

First: your Bitcoin stays Bitcoin. sBTC is a 1:1 Bitcoin-backed asset. When
a user deposits, their Bitcoin stays on Bitcoin L1 under their own keys. No
bridge risk. No wrapped token risk. Bitcoin finality. This makes the trust
pitch uniquely honest: your Bitcoin does not go anywhere, it just starts working.

Second: the yield is real and live today.

| Protocol       | TVL         | Yield type                        |
|----------------|-------------|-----------------------------------|
| Zest Protocol  | $75.9M      | BTC lending yield                 |
| Hermetica      | Live        | BTC-denominated structured yield  |
| Dual Stacking  | $100M+      | PoX yield, up to 10% APY in BTC   |
| sBTC total     | $545M       | —                                 |

These are not testnet projects. They are production protocols that have
collectively paid out $500M+ in Bitcoin-denominated yield.

Third: the friction is actively being removed. Stacks' 2026 roadmap
specifically targets fee abstraction using sBTC for gas instead of STX,
passkey wallet creation, and Leather Wallet UX improvements. The technical
barriers to onboarding new users are being dismantled at the protocol level.
BitYield is the consumer product that meets users on the other side.

---

## Architecture

The system has three layers: a Clarity smart contract for routing and
accounting, a Next.js frontend for the user interface, and an integration
layer connecting to Hiro API, Leather SDK, and the underlying protocols.

High-level flow:

  Bitcoin Holder
        |
        v
  BitYield Dashboard (Next.js 16)
        |
        |-- Leather Wallet SDK -- links to sBTC bridge (BTC → sBTC)
        |
        |-- YieldRouter (Clarity smart contract)
        |       |-- Zest Protocol    lending yield
        |       |-- Hermetica        structured BTC yield
        |       |-- Dual Stacking    PoX yield
        |
        |-- Position Tracker
                |-- Live yield rates via Hiro API and DeFiLlama
                |-- BTC-denominated portfolio view
                |-- One-tap withdrawal

The design: `YieldRouter` is a routing and accounting layer that delegates
custody and yield to **pluggable strategy contracts** (each implements a shared
`yield-strategy-trait`). In the common case, adding a strategy is a single
`add-strategy` admin call on the **same** router, no redeploy needed. **v0.1
shipped four registered strategies** (`zest`, `hermetica`, `dual-stacking`,
`mock-yield`); each was a self-contained contract paying a fixed, admin-set
APY computed linearly from elapsed block height.

v0.2 was the one deliberate exception to "router never redeploys": Zest
requires a fresh Pyth price update passed through on `withdraw`, which the
original trait/router interface had no argument for. Rather than leave that
unreachable, the interface itself was extended (`withdraw` gained a
`price-feed-bytes` and an `oracle` argument, non-oracle strategies just pass
`none`/ignore it) and redeployed once, deliberately, pre-audit — see
[Deployment](#deployment) for why that required a fresh deployer address.

Core Clarity interface (as deployed on the current v0.2 router):

  (define-public (deposit (amount uint) (strategy-name (string-ascii 20))
                          (strategy <yield-strategy-trait>) (token <sip-010-trait>))
    ;; Verify strategy is registered + active and matches strategy-name
    ;; Transfer sBTC from caller to the strategy contract
    ;; Call the strategy's deposit; record position (entry block, APY)
    ;; Return position-id
  )

  (define-public (withdraw (position-id uint) (strategy <yield-strategy-trait>)
                           (token <sip-010-trait>) (oracle <oracle-trait>)
                           (price-feed-bytes (optional (buff 8192))))
    ;; Verify caller owns the open position and the strategy matches
    ;; Delegate to the strategy: return principal + accrued yield to caller
    ;; oracle/price-feed-bytes: Zest's live Pyth price update, ignored by
    ;; non-oracle-priced strategies (Dual Stacking, Hermetica preview)
    ;; Mark position closed
  )

  (define-read-only (get-position (owner principal) (position-id uint))
    ;; Return: amount, strategy, entry-block, apy-bps, closed
  )

  (define-read-only (get-strategy (name (string-ascii 20)))
    ;; Return the registered { contract, active } for a strategy name
  )

Frontend pages:

| Route       | Purpose                                                    |
|-------------|------------------------------------------------------------|
| /           | Landing — Your Bitcoin earns 0% right now + connect wallet |
| /dashboard  | Portfolio view — BTC balance, active yield, earnings       |
| /deposit    | Guided flow — amount, strategy, confirm, done              |
| /withdraw   | One-tap withdrawal with yield summary                      |

---

## Protocol integrations

| Protocol                                    | Role                          | Status                 |
|---------------------------------------------|-------------------------------|------------------------|
| Leather Wallet (leather.io)                 | Wallet + sBTC bridge link     | **Live** (SDK)         |
| Hiro Systems (hiro.so)                      | Stacks.js, API, Clarinet      | **Live** (infra)       |
| sBTC (stacks.co/sbtc)                       | 1:1 Bitcoin-backed deposit asset | **Live** (mainnet token) |
| Zest Protocol (zestprotocol.com)            | Primary lending yield         | **Live** (v0.2, mainnet) |
| Dual Stacking (stacks.co)                   | PoX yield                     | **Live** (v0.2, mainnet) — enrolled, reward payout pending first cycle |
| Hermetica (hermetica.fi)                    | Structured BTC yield          | Roadmap                |
| Circle USDCx / Bitflow                      | Stablecoin yield path         | Future track           |

---

## v0.1 — deposit flow

v0.1 delivers a **deposit flow live on Bitcoin mainnet** — from wallet
connection through sponsored deposit confirmation — running as a controlled,
team-funded demo. What shipped:

| Feature | Where it lives |
|----------------------|----------------|
| Connect a wallet | Leather / Stacks Connect — `/deposit`, `/dashboard` |
| View a yield opportunity + expected rate | Strategy cards on `/deposit` (APY, provider modelled, risk) |
| Review deposit details + **risk information** | Deposit preview + **Risk & disclosures** panel on confirm |
| Confirm a deposit flow | `deposit` contract call, sponsored, with pending/success states |
| No manual STX for gas (fee abstraction) | Sponsored transactions — `app/app/api/sponsor-tx` |
| Complete in a mainnet-ready environment | Contracts live on mainnet (see [Deployment](#deployment)) |
| Public repo + demo | This repo + demo video below |

**Demo video:** [youtu.be/0t2uiyaKrnA](https://youtu.be/0t2uiyaKrnA) — full mainnet deposit flow

> Note: the live `/proof` page in the app always reads whichever router it's
> currently configured against — today that's the v0.2 router below,
> not this v0.1 deployer. The transactions below are the original v0.1 evidence,
> viewable directly on the [v0.1 deployer's
> explorer page](https://explorer.hiro.so/address/SP360GQARJRHQEFBW21RP957MC8YPJYHYJQTPKVFN?chain=mainnet).

A first end-to-end mainnet deposit + withdrawal, both gas-sponsored
(user paid 0 STX), is recorded on the v0.1 deployment:

| Action | Transaction |
|--------|-------------|
| Deposit 0.0003 sBTC → Zest | [`0xca34c125…`](https://explorer.hiro.so/txid/0xca34c125fb54dfc24c1ed15efea6b93dfdb148116a6760cd5a9b91710f8da8df?chain=mainnet) |
| Withdrawal (principal returned) | [`0x3f58aa77…`](https://explorer.hiro.so/txid/0x3f58aa77f7d08afe5190fc6610f45eac5a6c56aaffba136719278ae3306e4ba4?chain=mainnet) |

To test it yourself: connect a Stacks wallet holding a small amount of sBTC,
open `/deposit`, pick a strategy, and confirm. You pay **no STX** — the fee is
sponsored. The resulting position is visible on `/dashboard` and `/proof`
(both read the current v0.2 router, see below).

---

## v0.2 — real protocol routing

v0.2 integrates BitYield with **two live Stacks yield protocols** —
Zest Protocol (lending interest) and Dual Stacking (the Stacks network's own
Bitcoin rewards program) — replacing the fixed, admin-set preview rate those
two routes paid under v0.1. Both route real sBTC into the named
protocol, at a rate read live from that protocol, not a number BitYield sets.
A third strategy, Hermetica, was also carried forward to this deployment and
is registered on the same router — see the note below the table. What
shipped:

| Feature | Where it lives |
|-----------------------|----------------|
| Two live Stacks yield opportunities | Zest (`zest-strategy-live-v2`) + Dual Stacking (`dual-stacking-strategy-live`), both registered on the v0.2 router |
| One mainnet interaction per route | Zest: real `supply`/`withdraw` into Zest's pool (below). Dual Stacking: real `enroll` into the rewards program, holding real principal (below) |
| Route-specific position status, visible to the user | `/deposit` and `/dashboard` show each route's real protocol-sourced value, live-read from the strategy contract — not a formula estimate |
| Route-specific protocol risk information | Per-route risk & disclosures panel on the deposit confirm screen (`/deposit`) |
| Documentation | This README + [`docs/m2-testing-guide.md`](docs/m2-testing-guide.md) (full deploy record, incident history, testing checklist) + [`docs/milestone-2-plan.md`](docs/milestone-2-plan.md) (design) |
| Transaction evidence | Table below, plus [`/proof`](https://bityield.click/proof) reading the live router straight from the chain |
| Demo video | _(recording in progress)_ |

**About the third route, Hermetica:** during this deployment a registration
bug was found and fixed — `hermetica` had never been re-registered on the
new router, so selecting it in the app would have hard-reverted any deposit.
That's now fixed and it's live on the router again. It is **not** counted as
one of v0.2's two live routes, though, because unlike Zest and Dual Stacking
it still pays a fixed, admin-set rate rather than actually routing sBTC into
Hermetica's protocol — live Hermetica routing is on the [Roadmap](#roadmap),
not shipped yet.

**Zest** — a real deposit and withdrawal through the app, with real sBTC, on
Bitcoin mainnet, both gas-sponsored:

| Action | Transaction |
|--------|-------------|
| Deposit into Zest | [`0x121a7328…`](https://explorer.hiro.so/txid/0x121a7328b0bd3601d3dc74dbad8ec83fb9d5d32bbf56af9eee4089b4c6ff2a88?chain=mainnet) |
| Withdrawal (principal returned from Zest) | [`0x7b909c7c…`](https://explorer.hiro.so/txid/0x7b909c7c6e8e9159659133ec61537f92e0fa93776c13731e675f8717d518be10?chain=mainnet) |

**Dual Stacking** — a real deposit-and-withdraw round trip, then a real
deposit left in and enrolled in the live rewards program:

| Action | Transaction |
|--------|-------------|
| Deposit + withdraw round trip | [`0x1f1678a3…`](https://explorer.hiro.so/txid/0x1f1678a38673c9c8a75fe1cff2be888e344d7fe0030b072c87079b18925eef2f?chain=mainnet) → [`0x92d8ec03…`](https://explorer.hiro.so/txid/0x92d8ec03e8c28e21af6c8adc9bfdbabac5e50c801fe6b2f0b91103e502c064b2?chain=mainnet) |
| Deposit held (10,000 sats, funds the enrollment minimum) | [`0x7d76917a…`](https://explorer.hiro.so/txid/0x7d76917a62ea892a1b54b57feac19ebfa931a08b035f4edae9f91708455e5af6?chain=mainnet) |
| `enroll-in-program` (real enrollment in the live rewards program) | [`0x100b7544…`](https://explorer.hiro.so/txid/0x100b7544af20c8c521394fe5bfa46359f2bfc6af310b08b60ed5eb7349caa36b?chain=mainnet) |

Dual Stacking's reward payout activates the *next* reward cycle after
enrollment (roughly two weeks), not immediately — so the strategy currently
holds real principal, enrolled, with the reward accrual itself still
pending. Once a cycle lands, the strategy's sBTC balance (and the live
position value shown in the app) will reflect it; a follow-up withdrawal
will complete the round trip with real yield.

Full deployment record, addresses, and testing/incident history — including
a real oracle-rotation incident on Zest and how it was fixed — are in
[`docs/m2-testing-guide.md`](docs/m2-testing-guide.md).

---

## Deployment

**Mainnet (current — v0.2)** — deployer
`SP37FXV56C8S6TNYGVTB06TE9Y449638WG9VK71YB`
([explorer](https://explorer.hiro.so/address/SP37FXV56C8S6TNYGVTB06TE9Y449638WG9VK71YB?chain=mainnet)),
the deployment the live app (bityield.click) actually points at today:

| Contract | Role |
|----------|------|
| `yield-router` | Non-custodial routing + accounting layer |
| `zest-strategy-live-v2` | Routes real sBTC into Zest Protocol lending (**live**) |
| `dual-stacking-strategy-live` | Routes real sBTC into the Stacks Dual Stacking rewards program (**live**) |
| `hermetica-strategy-live` | Preview strategy (fixed APY; models Hermetica, does not route to it yet) |
| `yield-strategy-trait` / `sip-010-trait` | Shared traits |

Every contract id is `SP37FXV56C8S6TNYGVTB06TE9Y449638WG9VK71YB.<contract-name>`.
The router is pointed at the canonical mainnet sBTC token
`SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token`, and all three strategies
are registered and active — verify with the router's `get-strategy` /
`get-sbtc-token` read-only functions on the explorer, or on the app's `/proof` page.

A fresh deployer was used for this redeploy (not a reuse of the v0.1 address
below) because the `withdraw` interface itself changed (an optional
price-feed buffer, needed for Zest's oracle) — Clarity contracts are
immutable, so the old `yield-router` and `yield-strategy-trait` names were
already taken by the incompatible v0.1 versions. Full rationale, the deploy
phases, and a real incident (Zest rotated its oracle contract after this was
first verified, which stranded a small amount of dust before being caught
and fixed as `-v2`) are in
[`docs/m2-testing-guide.md`](docs/m2-testing-guide.md).

<details>
<summary><strong>Mainnet (superseded) — v0.1</strong></summary>

Deployer `SP360GQARJRHQEFBW21RP957MC8YPJYHYJQTPKVFN`
([explorer](https://explorer.hiro.so/address/SP360GQARJRHQEFBW21RP957MC8YPJYHYJQTPKVFN?chain=mainnet)) —
the v0.1 deployment, kept live and untouched so its existing demo
positions remain withdrawable, but **not** the deployment the app routes new
activity through:

| Contract | Role |
|----------|------|
| `yield-router` | Non-custodial routing + accounting layer |
| `zest-strategy` / `hermetica-strategy` / `dual-stacking-strategy` | Preview strategies (fixed APY; model the named protocols) |
| `mock-yield-strategy` | Self-contained 5% strategy |
| `yield-strategy-trait` / `sip-010-trait` | Shared traits |

Every contract id is `SP360GQARJRHQEFBW21RP957MC8YPJYHYJQTPKVFN.<contract-name>`.

</details>

Full deploy + registration steps (testnet and mainnet), and how to redeploy,
are in [`contracts/DEPLOYMENT.md`](contracts/DEPLOYMENT.md).

---

## Setup & running locally

```
# 1. Contracts — run the Clarity test suite (in-memory simnet, no funds needed)
cd contracts && npm install && npm test

# 2. Frontend
cd app && npm install
cp .env.example .env.local     # then fill in the values below
npm run dev                    # http://localhost:3000
```

Required `app/.env.local` values, matching the current live (v0.2)
deployment (see `app/.env.example` and `contracts/DEPLOYMENT.md`):

```
NEXT_PUBLIC_STACKS_NETWORK=mainnet            # or testnet
NEXT_PUBLIC_YIELD_ROUTER_ADDRESS=SP37FXV56C8S6TNYGVTB06TE9Y449638WG9VK71YB.yield-router
NEXT_PUBLIC_SBTC_CONTRACT_ADDRESS=SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token
NEXT_PUBLIC_ZEST_STRATEGY_ADDRESS=SP37FXV56C8S6TNYGVTB06TE9Y449638WG9VK71YB.zest-strategy-live-v2
NEXT_PUBLIC_DUAL_STRATEGY_ADDRESS=SP37FXV56C8S6TNYGVTB06TE9Y449638WG9VK71YB.dual-stacking-strategy-live
NEXT_PUBLIC_HERMETICA_STRATEGY_ADDRESS=SP37FXV56C8S6TNYGVTB06TE9Y449638WG9VK71YB.hermetica-strategy-live
SPONSOR_PRIVATE_KEY=...        # server-only; funds the fee-abstraction sponsor
```

If left unset, `NEXT_PUBLIC_ZEST_STRATEGY_ADDRESS` /
`NEXT_PUBLIC_DUAL_STRATEGY_ADDRESS` / `NEXT_PUBLIC_HERMETICA_STRATEGY_ADDRESS`
each fall back to the router's deployer prefix plus the old **preview** name
(e.g. `<deployer>.zest-strategy`) — which does not exist under the v0.2
deployer, so the live routes above must be set explicitly (`app/lib/stacks/network.ts`).

---

## Roadmap

**v0.1 — deposit flow live on mainnet**
- [x] YieldRouter + pluggable strategy contracts deployed on **Bitcoin mainnet**
- [x] Next.js frontend: deposit, withdraw, dashboard
- [x] Leather Wallet integration, real on-chain sBTC balances
- [x] Fee abstraction via sponsored transactions (no STX required from users)
- [x] Deposit preview, confirmation, and risk/audit disclosures
- [x] Demo video of the full mainnet deposit flow

**v0.2 — real protocol routing**
- [x] Route the `zest` strategy into live **Zest Protocol** lending (real BTC yield)
- [x] Route the `dual-stacking` strategy into the live **Dual Stacking** rewards program
- [x] Read live APY from each protocol instead of a fixed rate, across the app
- [ ] Dual Stacking's first live reward cycle, confirmed and withdrawn (pending; enrollment activates the cycle after next)
- [ ] Demo video covering both live routes
- [ ] Independent audit of the routing contracts before public launch
- [ ] Move contract ownership to a multisig / cold wallet

**Later**
- [ ] Live Hermetica routing (currently a fixed-rate preview strategy)
- [ ] Mobile-optimized UX
- [ ] USDCx stablecoin yield path

---

## Who this is for

Primary user: a Bitcoin holder who bought BTC 2 to 5 years ago, holds it
on Coinbase or a hardware wallet, has never moved it to earn yield, is
aware yield exists but considers it too risky or complicated, and would
not recognize the words Stacks, Clarity, or sBTC.

This is not for DeFi natives, existing Stacks users, or protocol
researchers. Those people already know where to go. BitYield is for
everyone else.

---

## Tech stack

| Layer          | Technology                              |
|----------------|-----------------------------------------|
| Smart contracts| Clarity on Stacks blockchain            |
| Frontend       | Next.js 16, TypeScript, Tailwind CSS    |
| Wallet         | Leather Wallet, Stacks.js               |
| Testing        | Clarinet for contracts, Vitest frontend |
| Data           | Hiro Stacks Extended API, DeFiLlama     |
| Deployment     | Vercel for frontend, Stacks mainnet     |

---

## Contributing

BitYield is an active project. Issues and PRs for the
frontend, contracts, and docs are welcome. See `CONTRIBUTING.md`.

---

## License

MIT

---

*Built on Stacks — Bitcoin's leading L2*
*Deployed on Bitcoin mainnet (controlled demo) — v0.2*
