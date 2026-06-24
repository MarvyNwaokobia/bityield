;; mock-yield-strategy.clar
;;
;; Self-contained mock yield strategy conforming to yield-strategy-trait.
;; Accrues mock yield linearly based on blocks elapsed and admin-set APY.

(impl-trait .yield-strategy-trait.yield-strategy-trait)
(use-trait sip-010-trait .sip-010-trait.sip-010-trait)

(define-constant CONTRACT-OWNER tx-sender)
(define-constant BLOCKS-PER-YEAR u52560)
(define-constant BPS-DENOMINATOR u10000)

(define-constant ERR-NOT-OWNER (err u200))
(define-constant ERR-NOT-ROUTER (err u201))

;; Router contract authorized to call this strategy
(define-data-var authorized-router principal .yield-router)

(define-data-var current-apy-bps uint u500)
(define-data-var tvl-sats uint u0)

;; --- Authorization helper ---
(define-private (is-authorized-router)
  (is-eq contract-caller (var-get authorized-router))
)

;; --- Public functions ---

(define-public (deposit (amount uint))
  (begin
    (asserts! (is-authorized-router) ERR-NOT-ROUTER)
    (var-set tvl-sats (+ (var-get tvl-sats) amount))
    (ok true)
  )
)

(define-public (withdraw (amount uint) (recipient principal) (entry-block uint) (apy-bps uint) (token <sip-010-trait>))
  (begin
    (asserts! (is-authorized-router) ERR-NOT-ROUTER)
    (let (
        (elapsed (- block-height entry-block))
        (yield (/ (* amount apy-bps elapsed) (* BPS-DENOMINATOR BLOCKS-PER-YEAR)))
        (payout (+ amount yield))
      )
      ;; Update TVL (subtract principal amount)
      (if (>= (var-get tvl-sats) amount)
        (var-set tvl-sats (- (var-get tvl-sats) amount))
        (var-set tvl-sats u0)
      )
      ;; Transfer principal + yield back to the recipient from strategy contract
      (try! (as-contract (contract-call? token transfer payout tx-sender recipient none)))
      (ok payout)
    )
  )
)

;; Admin-only to update APY
(define-public (set-apy (new-apy-bps uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-OWNER)
    (var-set current-apy-bps new-apy-bps)
    (ok new-apy-bps)
  )
)

;; Admin-only to update authorized router contract
(define-public (set-authorized-router (new-router principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-OWNER)
    (var-set authorized-router new-router)
    (ok new-router)
  )
)

;; --- Read-only functions ---

(define-read-only (get-apy)
  (ok (var-get current-apy-bps))
)

(define-read-only (get-tvl)
  (ok (var-get tvl-sats))
)
