;; hermetica-strategy-live.clar
;;
;; Hermetica structured BTC yield strategy conforming to yield-strategy-trait.
;; Preview strategy: pays a fixed, admin-set APY. Does not route to Hermetica
;; itself yet (live routing to Hermetica is on the roadmap).
;;
;; NOTE: matches the yield-strategy-trait shape actually deployed on mainnet
;; under this deployer (withdraw with no oracle-trait argument), which
;; predates the local oracle-dynamic redesign. Kept as a standalone file,
;; deliberately not tracked by the local Clarinet.toml, since the local
;; yield-strategy-trait.clar has since moved ahead to the oracle-inclusive
;; shape that is not yet deployed. See docs/m2-testing-guide.md.

(impl-trait .yield-strategy-trait.yield-strategy-trait)
(use-trait sip-010-trait .sip-010-trait.sip-010-trait)

(define-constant BLOCKS-PER-YEAR u52560)
(define-constant BPS-DENOMINATOR u10000)

(define-constant ERR-NOT-OWNER (err u200))
(define-constant ERR-NOT-ROUTER (err u201))

(define-data-var authorized-router principal .yield-router)
(define-data-var contract-owner principal tx-sender)
(define-data-var current-apy-bps uint u620) ;; Hermetica: 6.20%
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

(define-public (withdraw
    (amount uint)
    (recipient principal)
    (entry-block uint)
    (apy-bps uint)
    (token <sip-010-trait>)
    (price-feed-bytes (optional (buff 8192)))
  )
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
    (asserts! (is-eq tx-sender (var-get contract-owner)) ERR-NOT-OWNER)
    (var-set current-apy-bps new-apy-bps)
    (ok new-apy-bps)
  )
)

(define-public (set-authorized-router (new-router principal))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) ERR-NOT-OWNER)
    (var-set authorized-router new-router)
    (ok new-router)
  )
)

;; Owner-only: transfer ownership (e.g. to a multisig).
(define-public (set-contract-owner (new-owner principal))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) ERR-NOT-OWNER)
    (var-set contract-owner new-owner)
    (ok new-owner)
  )
)

;; Owner-only emergency: sweep held sBTC out to `recipient`. Recovery escape
;; hatch for the controlled testing phase, matching the other live strategies.
(define-public (owner-sweep-ft (token <sip-010-trait>) (amount uint) (recipient principal))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) ERR-NOT-OWNER)
    (as-contract (contract-call? token transfer amount tx-sender recipient none))
  )
)

;; Owner-only: sweep loose STX out of the strategy.
(define-public (owner-sweep-stx (amount uint) (recipient principal))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) ERR-NOT-OWNER)
    (as-contract (stx-transfer? amount tx-sender recipient))
  )
)

(define-read-only (get-apy)
  (ok (var-get current-apy-bps))
)

(define-read-only (get-tvl)
  (ok (var-get tvl-sats))
)
