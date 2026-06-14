# Deployment guide

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

This deploys, in order, `sip-010-trait`, `mock-sbtc-token`, and `yield-router`
to your deployer's address.

> `mock-sbtc-token` is only needed for end-to-end testing before the real sBTC
> contract (step 5) is wired up. Once `NEXT_PUBLIC_SBTC_CONTRACT_ADDRESS` points
> at the real sBTC token, `mock-sbtc-token` can stay deployed-but-unused, or be
> removed from the deployment plan before applying.

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
