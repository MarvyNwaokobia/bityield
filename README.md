# BitYield

> One-tap Bitcoin yield for every BTC holder. Built on Stacks.

**Live:** https://bityield-tau.vercel.app

[![Built on Stacks](https://img.shields.io/badge/Built%20on-Stacks-orange)](https://stacks.co)
[![Asset](https://img.shields.io/badge/Asset-sBTC-yellow)](https://stacks.co/sbtc)
[![Network](https://img.shields.io/badge/Live%20on-Bitcoin%20Mainnet-brightgreen)](#deployment)
[![License](https://img.shields.io/badge/License-MIT-green)](./LICENSE)

---

## Status

**v0.1 is live on Bitcoin mainnet** (Stacks Endowment grant, Milestone 1).
Connect a Leather wallet, deposit real sBTC, review the yield opportunity and
risk disclosures, and confirm — with every transaction's STX fee sponsored so
users never need to hold STX.

- `YieldRouter` (mainnet):
  [`SP360GQARJRHQEFBW21RP957MC8YPJYHYJQTPKVFN.yield-router`](https://explorer.hiro.so/address/SP360GQARJRHQEFBW21RP957MC8YPJYHYJQTPKVFN?chain=mainnet)
- Router points at the canonical mainnet sBTC token
  (`SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token`); deposit → position
  → withdraw and the fee-sponsorship pipeline were verified end-to-end on
  testnet with real sBTC before the mainnet deploy.
- **Honest scope:** the yield strategies (Zest / Hermetica / Dual Stacking) are
  currently **BitYield's own strategy contracts**, each paying a fixed,
  admin-set APY. They *model* the target protocols but do not route to them
  yet — live protocol integration (starting with **Zest**) is Milestone 2. The
  app labels these "Preview" and links each strategy contract on the explorer
  so anyone can verify exactly what it does. See [Roadmap](#roadmap).

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
- Protocol routing: routing deposits to the best live yield across Zest,
  Hermetica, and Dual Stacking (roadmap — see [Status](#status))

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
`yield-strategy-trait`). This is the key to the roadmap — a new strategy (e.g.
real Zest routing) is added with a single `add-strategy` admin call on the
**same** router; existing positions never migrate and the router is never
redeployed. **v0.1 ships four registered strategies** (`zest`, `hermetica`,
`dual-stacking`, `mock-yield`); each is currently a self-contained contract
paying a fixed, admin-set APY computed linearly from elapsed block height.
Milestone 2 swaps the `zest` strategy's implementation for one that actually
supplies into Zest Protocol — no router change required.

Core Clarity interface (as deployed):

  (define-public (deposit (amount uint) (strategy-name (string-ascii 20))
                          (strategy <yield-strategy-trait>) (token <sip-010-trait>))
    ;; Verify strategy is registered + active and matches strategy-name
    ;; Transfer sBTC from caller to the strategy contract
    ;; Call the strategy's deposit; record position (entry block, APY)
    ;; Return position-id
  )

  (define-public (withdraw (position-id uint) (strategy <yield-strategy-trait>) (token <sip-010-trait>))
    ;; Verify caller owns the open position and the strategy matches
    ;; Delegate to the strategy: return principal + accrued yield to caller
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
| Zest Protocol (zestprotocol.com)            | Primary lending yield         | Roadmap — Milestone 2  |
| Hermetica (hermetica.fi)                    | Structured BTC yield          | Roadmap                |
| Dual Stacking (stacks.co)                   | PoX yield                     | Roadmap                |
| Circle USDCx / Bitflow                      | Stablecoin yield path         | Future track           |

---

## Milestone 1 — Stacks Endowment grant

Milestone 1 delivers a **mainnet-ready deposit flow** from wallet connection
through deposit confirmation. Mapping to the acceptance criteria:

| Acceptance criterion | Where it lives |
|----------------------|----------------|
| Connect a wallet | Leather / Stacks Connect — `/deposit`, `/dashboard` |
| View a yield opportunity + expected rate | Strategy cards on `/deposit` (APY, provider modelled, risk) |
| Review deposit details + **risk information** | Deposit preview + **Risk & disclosures** panel on confirm |
| Confirm a deposit flow | `deposit` contract call, sponsored, with pending/success states |
| No manual STX for gas (fee abstraction) | Sponsored transactions — `app/app/api/sponsor-tx` |
| Complete in a mainnet-ready environment | Contracts live on mainnet (see [Deployment](#deployment)) |
| Public repo + demo | This repo + demo video below |

**Demo video:** _(link coming — records the full mainnet deposit flow)_

To test it yourself: connect a Stacks wallet holding a small amount of sBTC,
open `/deposit`, pick a strategy, and confirm. You pay **no STX** — the fee is
sponsored. The resulting position is visible on `/dashboard` and on the
[explorer](https://explorer.hiro.so/address/SP360GQARJRHQEFBW21RP957MC8YPJYHYJQTPKVFN?chain=mainnet).

---

## Deployment

**Mainnet** — deployer `SP360GQARJRHQEFBW21RP957MC8YPJYHYJQTPKVFN`
([explorer](https://explorer.hiro.so/address/SP360GQARJRHQEFBW21RP957MC8YPJYHYJQTPKVFN?chain=mainnet)):

| Contract | Role |
|----------|------|
| `yield-router` | Non-custodial routing + accounting layer |
| `zest-strategy` / `hermetica-strategy` / `dual-stacking-strategy` | Preview strategies (fixed APY; model the named protocols) |
| `mock-yield-strategy` | Self-contained 5% strategy |
| `yield-strategy-trait` / `sip-010-trait` | Shared traits |

The router is pointed at the canonical mainnet sBTC token
`SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token`, and all four strategies
are registered and active — verify with the router's `get-strategy` /
`get-sbtc-token` read-only functions on the explorer.

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

Required `app/.env.local` values (see `app/.env.example` and
`contracts/DEPLOYMENT.md`):

```
NEXT_PUBLIC_STACKS_NETWORK=mainnet            # or testnet
NEXT_PUBLIC_YIELD_ROUTER_ADDRESS=SP360...yield-router
NEXT_PUBLIC_SBTC_CONTRACT_ADDRESS=SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token
SPONSOR_PRIVATE_KEY=...        # server-only; funds the fee-abstraction sponsor
```

Strategy contract addresses are derived from the router's deployer prefix
automatically (`app/lib/stacks/network.ts`).

---

## Roadmap

**Milestone 1 — mainnet-ready deposit flow (shipped)**
- [x] YieldRouter + pluggable strategy contracts deployed on **Bitcoin mainnet**
- [x] Next.js frontend: deposit, withdraw, dashboard
- [x] Leather Wallet integration, real on-chain sBTC balances
- [x] Fee abstraction via sponsored transactions (no STX required from users)
- [x] Deposit preview, confirmation, and risk/audit disclosures
- [ ] Demo video of the full mainnet deposit flow

**Milestone 2 — real protocol routing**
- [ ] Route the `zest` strategy into live **Zest Protocol** lending (real BTC yield)
- [ ] Read live APY/TVL from the protocol instead of a fixed rate
- [ ] Independent audit of the routing contracts before public launch
- [ ] Move contract ownership to a multisig / cold wallet

**Later**
- [ ] Hermetica and Dual Stacking live integrations
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

BitYield is an active grant project (Stacks Endowment). Issues and PRs for the
frontend, contracts, and docs are welcome. See `CONTRIBUTING.md`.

---

## License

MIT

---

*Built on Stacks — Bitcoin's leading L2*
*Live on Bitcoin mainnet — Stacks Endowment grant, Milestone 1*
