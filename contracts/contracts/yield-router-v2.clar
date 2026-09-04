;; yield-router-v2.clar
;;
;; FROZEN, CHAIN-VERIFIED SNAPSHOT -- this is the exact source of the contract
;; deployed as SP37FXV56C8S6TNYGVTB06TE9Y449638WG9VK71YB.yield-router-v2
;; (2026-08-23), pulled verbatim via `GET /v2/contracts/source/...` from
;; api.mainnet.hiro.so. DO NOT EDIT (Clarity contracts are immutable; editing
;; this file can't change what's live, only make the snapshot stop matching
;; chain). NOT tracked in Clarinet.toml: it references `.yield-strategy-trait-v2`
;; and `.oracle-trait`, deploy-specific names chosen only to avoid colliding
;; with the OLD yield-router/yield-strategy-trait already on this deployer --
;; see docs/m2-testing-guide.md, "Router registry fix: strategy-contract
;; pinning". contracts/yield-router.clar is the actively-developed source
;; (local-devnet names); this file is a historical record of one specific
;; mainnet deploy, kept only because it currently has no strategy that can
;; register on it -- see the docs section for why.
;;
;; Non-custodial routing + accounting layer for BitYield deposits.
;; Delegates actual deposit custody and yield generation to registered strategy contracts.

(use-trait sip-010-trait .sip-010-trait.sip-010-trait)
(use-trait yield-strategy-trait .yield-strategy-trait-v2.yield-strategy-trait)
(use-trait oracle-trait .oracle-trait.oracle-trait)

(define-constant CONTRACT-OWNER tx-sender)
(define-constant BLOCKS-PER-YEAR u52560) ;; ~10 minute block time
(define-constant BPS-DENOMINATOR u10000)

(define-constant ERR-NOT-OWNER (err u100))
(define-constant ERR-ZERO-AMOUNT (err u101))
(define-constant ERR-NOT-FOUND (err u102))
(define-constant ERR-ALREADY-CLOSED (err u103))
(define-constant ERR-TOO-MANY-POSITIONS (err u104))
(define-constant ERR-STRATEGY-NOT-REGISTERED (err u105))
(define-constant ERR-STRATEGY-INACTIVE (err u106))
(define-constant ERR-STRATEGY-MISMATCH (err u107))
(define-constant ERR-INVALID-TOKEN (err u108))

(define-data-var position-nonce uint u0)
(define-data-var sbtc-token-contract principal .mock-sbtc-token)

;; Registry of strategies mapping name to contract principal and active status
(define-map strategy-contracts
  (string-ascii 20)
  { contract: principal, active: bool }
)

(define-map positions
  { owner: principal, position-id: uint }
  {
    amount: uint,
    strategy: (string-ascii 20),
    ;; The strategy contract resolved from the registry AT DEPOSIT TIME, pinned
    ;; here so withdraw always redeems from the contract funds actually went
    ;; into -- never re-resolved through `strategy-contracts` by name. Without
    ;; this, an admin repointing a name to a different contract (e.g. deploying
    ;; a v3 fix and calling add-strategy again) would silently redirect an
    ;; existing open position's withdraw to a contract that never received its
    ;; funds.
    strategy-contract: principal,
    entry-block: uint,
    apy-bps: uint,
    closed: bool
  }
)

(define-map owner-positions principal (list 50 uint))

;; Best rate cache to allow read-only lookups without trait passing
(define-data-var best-strategy-name (string-ascii 20) "mock-yield")
(define-data-var best-apy-bps uint u500)
(define-data-var best-tvl uint u0)

;; --- Public functions ---

(define-public (deposit (amount uint) (strategy-name (string-ascii 20)) (strategy <yield-strategy-trait>) (token <sip-010-trait>))
  (begin
    (asserts! (> amount u0) ERR-ZERO-AMOUNT)
    (asserts! (is-eq (contract-of token) (var-get sbtc-token-contract)) ERR-INVALID-TOKEN)
    (let (
        (registry (unwrap! (map-get? strategy-contracts strategy-name) ERR-STRATEGY-NOT-REGISTERED))
        (strategy-contract (contract-of strategy))
        (position-id (var-get position-nonce))
        (existing (default-to (list) (map-get? owner-positions tx-sender)))
      )
      ;; Safety checks
      (asserts! (get active registry) ERR-STRATEGY-INACTIVE)
      (asserts! (is-eq strategy-contract (get contract registry)) ERR-STRATEGY-MISMATCH)

      ;; Transfer sBTC directly from user to the strategy contract
      (try! (contract-call? token transfer amount tx-sender strategy-contract none))

      ;; Call deposit on the strategy
      (try! (contract-call? strategy deposit amount))

      ;; Record position with entry block height and current APY from strategy
      (let ((apy (unwrap-panic (contract-call? strategy get-apy))))
        (map-set positions { owner: tx-sender, position-id: position-id }
          {
            amount: amount,
            strategy: strategy-name,
            strategy-contract: strategy-contract,
            entry-block: block-height,
            apy-bps: apy,
            closed: false
          }
        )
        (map-set owner-positions tx-sender
          (unwrap! (as-max-len? (append existing position-id) u50) ERR-TOO-MANY-POSITIONS))
        (var-set position-nonce (+ position-id u1))
        (ok position-id)
      )
    )
  )
)

(define-public (withdraw (position-id uint) (strategy <yield-strategy-trait>) (token <sip-010-trait>) (oracle <oracle-trait>) (price-feed-bytes (optional (buff 8192))))
  (let (
      (caller tx-sender)
      (pos (unwrap! (map-get? positions { owner: tx-sender, position-id: position-id }) ERR-NOT-FOUND))
      (strategy-contract (contract-of strategy))
    )
    (asserts! (not (get closed pos)) ERR-ALREADY-CLOSED)
    (asserts! (is-eq (contract-of token) (var-get sbtc-token-contract)) ERR-INVALID-TOKEN)
    ;; Validate against the contract PINNED on the position at deposit time, not
    ;; a fresh registry lookup by name -- the registry entry for this name may
    ;; have since been repointed to a different contract (e.g. a v2/v3 redeploy),
    ;; which must never redirect an already-open position's withdraw.
    (asserts! (is-eq strategy-contract (get strategy-contract pos)) ERR-STRATEGY-MISMATCH)

    ;; Delegate withdrawal and payout calculations to the strategy contract
    (let (
        (payout (try! (contract-call? strategy withdraw (get amount pos) caller (get entry-block pos) (get apy-bps pos) token oracle price-feed-bytes)))
      )
      (map-set positions { owner: caller, position-id: position-id } (merge pos { closed: true }))
      (ok payout)
    )
  )
)

;; Admin-only: Register a new strategy contract principal
(define-public (add-strategy (name (string-ascii 20)) (contract principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-OWNER)
    (map-set strategy-contracts name { contract: contract, active: true })
    (ok true)
  )
)

;; Admin-only: Enable or disable a registered strategy
(define-public (set-strategy-status (name (string-ascii 20)) (active bool))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-OWNER)
    (let ((curr (unwrap! (map-get? strategy-contracts name) ERR-STRATEGY-NOT-REGISTERED)))
      (map-set strategy-contracts name (merge curr { active: active }))
      (ok true)
    )
  )
)

;; Admin-only: Update the official sBTC token contract principal
(define-public (set-sbtc-token (new-token principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-OWNER)
    (var-set sbtc-token-contract new-token)
    (ok new-token)
  )
)

;; Admin-only: Update the best rate cache variables
(define-public (set-best-rate (name (string-ascii 20)) (apy-bps uint) (tvl uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-OWNER)
    (var-set best-strategy-name name)
    (var-set best-apy-bps apy-bps)
    (var-set best-tvl tvl)
    (ok true)
  )
)

;; --- Read-only functions ---

(define-read-only (get-accrued-yield (pos { amount: uint, strategy: (string-ascii 20), strategy-contract: principal, entry-block: uint, apy-bps: uint, closed: bool }))
  (let ((elapsed (- block-height (get entry-block pos))))
    (/ (* (get amount pos) (get apy-bps pos) elapsed) (* BPS-DENOMINATOR BLOCKS-PER-YEAR))
  )
)

(define-read-only (get-position (owner principal) (position-id uint))
  (map-get? positions { owner: owner, position-id: position-id })
)

(define-read-only (get-position-value (owner principal) (position-id uint))
  (match (map-get? positions { owner: owner, position-id: position-id })
    pos (some {
      amount: (get amount pos),
      accrued-yield: (get-accrued-yield pos),
      closed: (get closed pos)
    })
    none
  )
)

(define-read-only (get-all-position-ids (owner principal))
  (default-to (list) (map-get? owner-positions owner))
)

(define-read-only (get-best-rate)
  {
    strategy: (var-get best-strategy-name),
    apy-bps: (var-get best-apy-bps),
    tvl: (var-get best-tvl)
  }
)

(define-read-only (get-strategy (name (string-ascii 20)))
  (map-get? strategy-contracts name)
)

(define-read-only (get-sbtc-token)
  (var-get sbtc-token-contract)
)
