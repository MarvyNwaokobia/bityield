# BitYield

> One-tap Bitcoin yield for every BTC holder. Built on Stacks.

[![Built on Stacks](https://img.shields.io/badge/Built%20on-Stacks-orange)](https://stacks.co)
[![Asset](https://img.shields.io/badge/Asset-sBTC-yellow)](https://stacks.co/sbtc)
[![Stage](https://img.shields.io/badge/Active-Stacks%20Foundry%3A%20Validate%20Cohort%20May%E2%80%93June%202026-blue)](#validation)
[![License](https://img.shields.io/badge/License-MIT-green)](./LICENSE)

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

What BitYield handles invisibly:
- sBTC bridge: converting BTC to sBTC for Stacks protocols
- Gas fees: fee abstraction so no STX is required from the user
- Protocol routing: finding the best yield across Zest, Hermetica, Dual Stacking
- Position tracking: displaying yield in BTC terms the user understands

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
  BitYield Dashboard (Next.js 14)
        |
        |-- Leather Wallet SDK -- sBTC bridge (invisible to user)
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

The YieldRouter contract is a routing and accounting layer only. BitYield
never holds user funds. Positions are held by the underlying protocols.

Core Clarity interface:

  (define-public (deposit (amount uint) (strategy (string-ascii 20)))
    ;; Accept sBTC from caller
    ;; Route to selected protocol
    ;; Record position with entry price and timestamp
    ;; Return position receipt
  )

  (define-public (withdraw (position-id uint))
    ;; Verify caller owns position
    ;; Withdraw from underlying protocol
    ;; Return sBTC plus accrued yield to caller
  )

  (define-read-only (get-position (user principal))
    ;; Return: amount, strategy, current-yield, entry-time, btc-value
  )

  (define-read-only (get-best-rate)
    ;; Compare live rates across all integrated protocols
    ;; Return: strategy-name, current-apy, tvl
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

| Protocol                                    | Role                          | Integration type       |
|---------------------------------------------|-------------------------------|------------------------|
| Zest Protocol (zestprotocol.com)            | Primary lending yield         | Clarity contract call  |
| Hermetica (hermetica.fi)                    | Structured BTC yield          | Clarity contract call  |
| Dual Stacking (stacks.co)                   | PoX yield                     | Clarity contract call  |
| Leather Wallet (leather.io)                 | Wallet and sBTC bridge UX     | SDK                    |
| Hiro Systems (hiro.so)                      | Stacks.js, API, Clarinet      | Developer infrastructure|
| Circle USDCx                                | Stablecoin yield path v2      | Future track           |
| Bitflow (bitflow.finance)                   | sBTC/USDCx liquidity          | Future track           |

---

## Validation

BitYield has been accepted into Stacks Foundry: Validate, a 5-week program by
the Stacks Endowment for early-stage builders. The project is now in active
Week 1 discovery.

Core assumption being tested:

  The barrier to Bitcoin yield on Stacks is a UX and communication problem,
  not a trust or risk problem. A sufficiently simple interface with honest
  framing will convert passive BTC holders into active sBTC depositors.

Validation plan by week:

| Week | Focus                | What we are testing                        |
|------|----------------------|--------------------------------------------|
| 1    | Discovery interviews | What is the real hesitation?               |
| 2    | Problem framing      | Does your Bitcoin stays Bitcoin land?      |
| 3    | Concept test         | Does the mockup convert?                   |
| 4    | Prototype test       | Does the flow complete on testnet?         |
| 5    | Decision             | Build, pivot, narrow, or stop              |

Success criteria:

| Signal                                    | Threshold |
|-------------------------------------------|-----------|
| Clicks Start Earning in concept test      | > 40%     |
| Completes deposit on testnet              | > 25%     |
| Cites too complicated as reason to stop   | < 20%     |
| Would recommend to another BTC holder     | > 50%     |

See docs/validation-plan.md for the full research protocol.

---

## Roadmap

Validation stage: May to June 2026
- [ ] User discovery interviews with 20 to 30 non-technical BTC holders
- [ ] Problem framing and message testing
- [ ] Prototype deposit flow on Stacks testnet
- [ ] Validate or invalidate core assumption

v0.1: July 2026 if validation confirms
- [ ] YieldRouter Clarity contract on testnet
- [ ] Next.js frontend with deposit flow only
- [ ] Leather Wallet integration
- [ ] Zest Protocol as primary yield option

v0.2: August 2026
- [ ] Hermetica integration
- [ ] Dual Stacking integration
- [ ] Portfolio dashboard
- [ ] Withdrawal flow

v1.0: Q4 2026
- [ ] Mainnet deployment
- [ ] Fee abstraction using sBTC for gas
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
| Frontend       | Next.js 14, TypeScript, Tailwind CSS    |
| Wallet         | Leather Wallet, Stacks.js               |
| Testing        | Clarinet for contracts, Vitest frontend |
| Data           | Hiro Stacks Extended API, DeFiLlama     |
| Deployment     | Vercel for frontend, Stacks mainnet     |

---

## Contributing

BitYield is in the validation stage. Contributions to research, design,
and documentation are welcome now. Engineering contributions will open
after validation is complete and the build decision is made.

---

## License

MIT

---

*Built on Stacks — Bitcoin's leading L2*
*Active in Stacks Foundry: Validate — May–June 2026*
