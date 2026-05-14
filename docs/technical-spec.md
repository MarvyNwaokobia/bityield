# BitYield — Technical Specification

## Overview

BitYield is built across three layers:
1. Clarity smart contracts handling on-chain logic and protocol routing
2. Next.js 14 frontend handling all user-facing interface
3. Integration layer connecting to Hiro API, Leather SDK, and yield protocols

---

## Layer 1: Smart contracts in Clarity

### YieldRouter contract

The core contract. Routes user deposits to the appropriate yield protocol
and tracks positions on-chain.

Key design principles:
- Non-custodial: BitYield never holds user funds at any point
- Protocol-agnostic: new yield strategies can be added without migration
- sBTC-native: all accounting is in sBTC units, STX never appears to users
- Upgradeable: admin can register new strategies after deployment

Data structures:

  (define-map positions
    { user: principal, position-id: uint }
    {
      amount: uint,
      strategy: (string-ascii 20),
      entry-block: uint,
      entry-rate: uint
    }
  )

  (define-map strategy-contracts
    (string-ascii 20)
    principal
  )

  (define-data-var position-nonce uint u0)

Public functions:

  deposit: accepts sBTC from the caller, validates the chosen strategy
  exists in strategy-contracts, calls the strategy contract's deposit
  function, records the position with current block and rate, increments
  the nonce, returns the new position ID.

  withdraw: verifies the caller owns the given position ID, calls the
  strategy contract's withdrawal function, transfers returned sBTC plus
  yield to the caller, marks the position as closed.

  add-strategy: admin-only function that registers a new protocol contract
  address under a strategy name, enabling future routing to it.

Read-only functions:

  get-position: returns the full position record for a user and position ID.

  get-best-rate: queries all registered strategy contracts for their current
  APY and returns the highest available rate with its strategy name and TVL.

  get-all-positions: returns all open positions for a given user address.

---

### PositionNFT contract (optional v0.2 feature)

Issues a non-transferable receipt token for each open position. Allows
future composability with other Stacks DeFi protocols that want to use
BitYield positions as collateral or proof of yield.

---

## Layer 2: Frontend in Next.js 14

### Route structure

/ — Landing page
The only content is a BTC yield counter showing approximate yield the
user is missing, and a single Connect Wallet button. No numbers, charts,
or protocol names are shown before wallet connection. This prevents
confusion from seeing figures the user cannot act on yet.

/dashboard — Portfolio view
Shows the user's connected BTC balance, all active positions with
current yield in BTC terms, total earned to date, and action buttons
for deposit and withdraw. All values are shown in BTC. sBTC is never
shown as a unit to the user.

/deposit — Guided deposit flow
Step 1: enter an amount in BTC
Step 2: see the available yield strategies with plain-language descriptions
Step 3: confirm screen showing exactly what happens and what the user receives
Step 4: processing screen with honest wait time indication
Step 5: success screen showing the new position and projected monthly earnings

/withdraw — Withdrawal flow
Shows each open position with current value and earned yield.
Single Withdraw button per position. Confirms the amount being returned.
Shows estimated time to completion.

### Key UX decisions

Show everything in BTC, never in sBTC. Users who do not know what sBTC
is should never encounter the word. The conversion is handled internally.

Show yield as concrete amounts, not percentages. Saying you have earned
0.00042 BTC this month is more meaningful to the target user than saying
6.2% APY. Use both but lead with the concrete amount.

Write all error messages in plain English. Transaction reverted becomes
Your deposit could not be completed. Please try again. Protocol errors
are never shown to users.

Never show empty states without a clear action. If the user has no
positions, show a prompt to make their first deposit, not an empty table.

---

## Layer 3: Integration layer

Hiro Stacks Extended API
Used for: reading on-chain state, fetching contract data, submitting
transactions, querying block information for position age calculations.
Documentation: docs.hiro.so

Stacks.js
Used for: building and signing Clarity transactions from the frontend,
reading contract state, handling wallet connections.
Documentation: stacks.js.org

Leather Wallet SDK
Used for: connecting the user's Bitcoin wallet, initiating the sBTC
peg-in process, signing transactions on Stacks.
Documentation: leather.io/developers

DeFiLlama API
Used for: fetching live TVL data for Zest and other integrated protocols
to display current pool sizes and confidence signals to users.
Documentation: defillama.com/docs/api

---

## Development environment setup

Prerequisites:
- Node.js version 20 or higher
- pnpm version 9 or higher
- Clarinet CLI for Clarity contract development and testing
- Hiro Wallet or Leather Wallet browser extension for local testing

Install Clarinet:
  brew install clarinet
  or
  cargo install clarinet

Clone and install frontend dependencies:
  git clone https://github.com/MarvyNwaokobia/bityield
  cd bityield
  pnpm install
  pnpm dev

Run contract tests:
  cd contracts
  clarinet test

---

## Environment variables required

NEXT_PUBLIC_STACKS_NETWORK — testnet or mainnet
NEXT_PUBLIC_HIRO_API_URL — Hiro API endpoint
NEXT_PUBLIC_YIELD_ROUTER_ADDRESS — deployed YieldRouter contract address
NEXT_PUBLIC_SBTC_CONTRACT_ADDRESS — sBTC contract address on target network
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID — WalletConnect project ID
