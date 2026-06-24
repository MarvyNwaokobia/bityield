# Security Review & Audit Notes — BitYield Contracts

This document outlines the security review, sanity checks, and validation safeguards implemented in the BitYield routing and strategy contracts to ensure user safety and protocol integrity prior to launch.

---

## 1. Authentication & Authorization Safeguards

### Core Router Access Restrictions
* **Objective**: Prevent users from bypassing the `yield-router` to spoof deposits or execute arbitrary withdrawals on strategy contracts.
* **Mechanism**: Each strategy contract (Zest, Hermetica, Dual Stacking) stores an authorized router address (`authorized-router` principal) initialized to the yield router.
* **Checks**:
  * Every public `deposit` and `withdraw` entrypoint on the strategy contracts asserts `(is-eq contract-caller (var-get authorized-router))` to reject any caller that is not the official router.
  * Router updates (`set-authorized-router`) are locked behind `asserts! (is-eq tx-sender CONTRACT-OWNER)` checks.

### Router Position Ownership
* **Objective**: Prevent unauthorized third parties from withdrawing user funds.
* **Mechanism**: The `yield-router` maps positions on-chain using a composite key: `{ owner: principal, position-id: uint }`.
* **Checks**:
  * The `withdraw` function retrieves the position details for `tx-sender`. By scoping lookup to `tx-sender`, it is mathematically impossible for another principal to successfully submit a withdrawal transaction for a position they do not own.

---

## 2. Asset Integrity & Token Validation

### Prevent SIP-010 Token Spoofing
* **Objective**: Prevent malicious users from calling `deposit` or `withdraw` using custom fake tokens that mimic sBTC but manipulate accounting or bypass transfers.
* **Mechanism**: The `yield-router` tracks the official sBTC token address in a data-var `sbtc-token-contract`.
* **Checks**:
  * Both `deposit` and `withdraw` perform `(asserts! (is-eq (contract-of token) (var-get sbtc-token-contract)) ERR-INVALID-TOKEN)` sanity checks.
  * This guarantees that only transfers on the official sBTC token ledger can trigger accounting updates.

---

## 3. Dynamic Strategy Mismatch Validation

### Strict Contract Verification
* **Objective**: Prevent calling unauthorized strategy contracts or misrouting deposits/withdrawals.
* **Mechanism**: The `yield-router` maintains a `strategy-contracts` map registry populated by the contract owner.
* **Checks**:
  * During `deposit`, the router looks up the strategy name, checks if it is marked `active`, and asserts that the passed strategy trait address (`contract-of strategy`) matches the registered contract principal.
  * During `withdraw`, the router asserts that the passed strategy contract matches the registered contract address for the specific strategy name stored in the user's position record (`ERR-STRATEGY-MISMATCH`). This prevents users from selecting a different strategy contract to exploit or bypass specific yield payout logic on withdrawal.

---

## 4. Error Management & Safeguards

### Clarity Status Return
* All public operations use return assertions (`try!` and `unwrap!`) to revert the entire transaction state if any individual step (such as token transfer or strategy contract call) fails. This ensures atomic execution — either the entire deposit/withdrawal succeeds or the state is fully rolled back, preventing orphaned funds.

---

## 5. Mainnet Readiness Checklist
- [x] Enforce token contract validation (sBTC verification).
- [x] Restrict strategy entrypoints to authorized router callers.
- [x] Map strategy names to exact contract principals to prevent parameter hijacking.
- [ ] Configure `sbtc-token-contract` to the official Stacks Mainnet sBTC contract address post-deployment.
- [ ] Set deployer key strictly to a multi-signature cold wallet for contract upgrades or administrative operations.
