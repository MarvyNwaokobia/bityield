;; dual-stacking-strategy-live.clar
;;
;; LIVE Dual Stacking strategy (route 2). Enrolls the sBTC this strategy holds
;; into Stacks' first-party sBTC rewards program, so BTC-denominated rewards
;; accrue to the strategy, then distributes them pro-rata to positions on
;; withdraw. Conforms to yield-strategy-trait.
;;
;; Rewards program (verified from deployed source):
;;   SP804CDG3KBN9M6E00AD744K8DC697G7HBCG520Q.sbtc-yield-rewards-v3
;;   - enroll (rewarded-address (optional principal)): no tx-sender==contract-caller
;;     guard; checks contract-caller's sBTC balance vs min-hold and enrols
;;     contract-caller. So this strategy can enrol itself (no as-contract needed).
;;   - distribute-rewards is admin-driven: the program pushes sBTC rewards to the
;;     enrolled address each cycle (enrolment applies from the NEXT cycle).
;;   sBTC: SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token
;;
;; NEEDS TESTING (deferred): enrol + a real reward cycle + withdraw must be
;; verified on mainnet, and the Stacks team must confirm an enrolled CONTRACT is
;; picked up by distribute-rewards (see docs/milestone-2-plan.md, outreach).

(impl-trait .yield-strategy-trait.yield-strategy-trait)
(use-trait sip-010-trait .sip-010-trait.sip-010-trait)

;; ~0.5% base sBTC rate; the boosted rate (up to ~5% with STX stacked) is read
;; live from the program for display. get-apy is informational only: real payout
;; comes from the sBTC rewards actually pushed to this strategy.
(define-constant DUAL-BASE-APR-BPS u50)

(define-constant ERR-NOT-OWNER (err u200))
(define-constant ERR-NOT-ROUTER (err u201))
(define-constant ERR-BALANCE-READ (err u202))

(define-data-var authorized-router principal .yield-router)
(define-data-var contract-owner principal tx-sender)
;; Sum of open-position principal held by this strategy. Any sBTC balance above
;; this is accrued rewards to share out pro-rata.
(define-data-var total-principal uint u0)

(define-private (is-authorized-router)
  (is-eq contract-caller (var-get authorized-router))
)

;; Deposit: the router has already transferred `amount` sBTC to this strategy.
;; Nothing to route: the sBTC simply sits here and its balance accrues rewards
;; once enrolled. We only track principal for later pro-rata accounting.
(define-public (deposit (amount uint))
  (begin
    (asserts! (is-authorized-router) ERR-NOT-ROUTER)
    (var-set total-principal (+ (var-get total-principal) amount))
    (ok true)
  )
)

;; Withdraw: pay back principal plus this position's pro-rata share of accrued
;; rewards. reward-share = amount / total-principal * (balance - total-principal).
;; NOTE: pro-rata by principal, not time-weighted; a time-weighted refinement is
;; a follow-up. price-feed-bytes is unused (Dual Stacking needs no oracle).
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
        (bal (unwrap! (contract-call? token get-balance (as-contract tx-sender)) ERR-BALANCE-READ))
        (principal-total (var-get total-principal))
        (rewards (if (> bal principal-total) (- bal principal-total) u0))
        (reward-share (if (> principal-total u0) (/ (* amount rewards) principal-total) u0))
        (payout (+ amount reward-share))
      )
      (var-set total-principal (if (>= principal-total amount) (- principal-total amount) u0))
      (try! (as-contract (contract-call? token transfer payout (as-contract tx-sender) recipient none)))
      (ok payout)
    )
  )
)

;; Admin: enrol this strategy into the rewards program. Call once, after the
;; strategy holds at least the program minimum (0.0001 sBTC). rewarded-address
;; defaults to contract-caller (this strategy), so rewards are pushed here.
(define-public (enroll-in-program)
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) ERR-NOT-OWNER)
    (contract-call? 'SP804CDG3KBN9M6E00AD744K8DC697G7HBCG520Q.sbtc-yield-rewards-v3 enroll none)
  )
)

;; Admin: leave the rewards program.
(define-public (opt-out-of-program)
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) ERR-NOT-OWNER)
    (contract-call? 'SP804CDG3KBN9M6E00AD744K8DC697G7HBCG520Q.sbtc-yield-rewards-v3 opt-out)
  )
)

(define-public (set-authorized-router (new-router principal))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) ERR-NOT-OWNER)
    (var-set authorized-router new-router)
    (ok new-router)
  )
)

;; TVL = this strategy's sBTC balance (principal + accrued rewards).
(define-read-only (get-tvl)
  (contract-call? 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token get-balance (as-contract tx-sender))
)

(define-read-only (get-apy)
  (ok DUAL-BASE-APR-BPS)
)
