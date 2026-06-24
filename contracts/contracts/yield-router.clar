;; yield-router.clar
;;
;; Non-custodial routing + accounting layer for BitYield deposits.
;; Delegates actual deposit custody and yield generation to registered strategy contracts.

(use-trait sip-010-trait .sip-010-trait.sip-010-trait)
(use-trait yield-strategy-trait .yield-strategy-trait.yield-strategy-trait)

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

(define-public (withdraw (position-id uint) (strategy <yield-strategy-trait>) (token <sip-010-trait>))
  (let (
      (caller tx-sender)
      (pos (unwrap! (map-get? positions { owner: tx-sender, position-id: position-id }) ERR-NOT-FOUND))
      (strategy-name (get strategy pos))
      (registry (unwrap! (map-get? strategy-contracts strategy-name) ERR-STRATEGY-NOT-REGISTERED))
      (strategy-contract (contract-of strategy))
    )
    (asserts! (not (get closed pos)) ERR-ALREADY-CLOSED)
    (asserts! (is-eq (contract-of token) (var-get sbtc-token-contract)) ERR-INVALID-TOKEN)
    (asserts! (is-eq strategy-contract (get contract registry)) ERR-STRATEGY-MISMATCH)

    ;; Delegate withdrawal and payout calculations to the strategy contract
    (let (
        (payout (try! (contract-call? strategy withdraw (get amount pos) caller (get entry-block pos) (get apy-bps pos) token)))
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

(define-read-only (get-accrued-yield (pos { amount: uint, strategy: (string-ascii 20), entry-block: uint, apy-bps: uint, closed: bool }))
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
