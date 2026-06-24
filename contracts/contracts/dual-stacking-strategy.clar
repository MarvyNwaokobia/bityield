;; dual-stacking-strategy.clar
;;
;; Dual Stacking PoX yield strategy conforming to yield-strategy-trait.

(impl-trait .yield-strategy-trait.yield-strategy-trait)
(use-trait sip-010-trait .sip-010-trait.sip-010-trait)

(define-constant CONTRACT-OWNER tx-sender)
(define-constant BLOCKS-PER-YEAR u52560)
(define-constant BPS-DENOMINATOR u10000)

(define-constant ERR-NOT-OWNER (err u200))
(define-constant ERR-NOT-ROUTER (err u201))

(define-data-var authorized-router principal .yield-router)
(define-data-var current-apy-bps uint u850) ;; Dual Stacking: 8.50%
(define-data-var tvl-sats uint u0)

(define-private (is-authorized-router)
  (is-eq contract-caller (var-get authorized-router))
)

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
      (if (>= (var-get tvl-sats) amount)
        (var-set tvl-sats (- (var-get tvl-sats) amount))
        (var-set tvl-sats u0)
      )
      (try! (as-contract (contract-call? token transfer payout tx-sender recipient none)))
      (ok payout)
    )
  )
)

(define-public (set-apy (new-apy-bps uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-OWNER)
    (var-set current-apy-bps new-apy-bps)
    (ok new-apy-bps)
  )
)

(define-public (set-authorized-router (new-router principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-OWNER)
    (var-set authorized-router new-router)
    (ok new-router)
  )
)

(define-read-only (get-apy)
  (ok (var-get current-apy-bps))
)

(define-read-only (get-tvl)
  (ok (var-get tvl-sats))
)
