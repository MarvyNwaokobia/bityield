;; yield-router.clar
;;
;; Non-custodial routing + accounting layer for BitYield deposits.
;;
;; v0.1 uses a single self-contained "mock-yield" strategy: deposited sBTC is
;; held by this contract and accrues yield at an admin-settable APY, computed
;; linearly from elapsed block height since the position was opened. Real
;; protocol routing (Zest, Hermetica, Dual Stacking) is a future strategy that
;; can be added without migrating existing positions - the `strategy` field on
;; each position is already recorded for that purpose, it just isn't validated
;; against a strategy registry yet.

(use-trait sip-010-trait .sip-010-trait.sip-010-trait)

(define-constant CONTRACT-OWNER tx-sender)
(define-constant BLOCKS-PER-YEAR u52560) ;; ~10 minute block time
(define-constant BPS-DENOMINATOR u10000)

(define-constant ERR-NOT-OWNER (err u100))
(define-constant ERR-ZERO-AMOUNT (err u101))
(define-constant ERR-NOT-FOUND (err u102))
(define-constant ERR-ALREADY-CLOSED (err u103))
(define-constant ERR-TOO-MANY-POSITIONS (err u104))

;; Current APY for new positions, in basis points (500 = 5.00%).
(define-data-var current-apy-bps uint u500)

(define-data-var position-nonce uint u0)

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

;; --- Public functions ---

(define-public (deposit (amount uint) (strategy (string-ascii 20)) (token <sip-010-trait>))
  (begin
    (asserts! (> amount u0) ERR-ZERO-AMOUNT)
    (try! (contract-call? token transfer amount tx-sender (as-contract tx-sender) none))
    (let (
        (position-id (var-get position-nonce))
        (existing (default-to (list) (map-get? owner-positions tx-sender)))
      )
      (map-set positions { owner: tx-sender, position-id: position-id }
        {
          amount: amount,
          strategy: strategy,
          entry-block: block-height,
          apy-bps: (var-get current-apy-bps),
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

(define-public (withdraw (position-id uint) (token <sip-010-trait>))
  (let (
      (caller tx-sender)
      (pos (unwrap! (map-get? positions { owner: tx-sender, position-id: position-id }) ERR-NOT-FOUND))
    )
    (asserts! (not (get closed pos)) ERR-ALREADY-CLOSED)
    (let ((payout (+ (get amount pos) (get-accrued-yield pos))))
      (map-set positions { owner: caller, position-id: position-id } (merge pos { closed: true }))
      (try! (as-contract (contract-call? token transfer payout tx-sender caller none)))
      (ok payout)
    )
  )
)

;; Admin-only: updates the APY applied to positions opened from this point
;; forward. Existing open positions keep the APY they were opened with.
(define-public (set-apy (new-apy-bps uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-OWNER)
    (var-set current-apy-bps new-apy-bps)
    (ok new-apy-bps)
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

;; Convenience read for the frontend: current principal + accrued yield for a
;; position, without the caller having to re-implement the accrual formula.
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
  { strategy: "mock-yield", apy-bps: (var-get current-apy-bps), tvl: u0 }
)
