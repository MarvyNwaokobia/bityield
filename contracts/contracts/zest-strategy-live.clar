;; zest-strategy-live.clar
;;
;; LIVE Zest lending strategy: routes real sBTC into Zest via as-contract.
;; Conforms to yield-strategy-trait. References Zest mainnet contracts confirmed
;; from real on-chain sBTC supply/withdraw transactions (see docs/milestone-2-plan.md
;; section 3). Deployable/testable only against mainnet state (Clarinet remote
;; data), never the self-contained local project.
;;
;; Zest contracts (deployer SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N):
;;   borrow-helper-v2-1-7  supply / withdraw wrapper (guarded by tx-sender==contract-caller)
;;   zsbtc-v2-0            sBTC receipt token (lp), accrues to this strategy
;;   pool-0-reserve-v2-0   reserve + user state
;;   stx-btc-oracle-v1-4   sBTC oracle
;;   incentives-v2-2       rewards contract
;; sBTC: SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token

(impl-trait .yield-strategy-trait.yield-strategy-trait)
(use-trait sip-010-trait .sip-010-trait.sip-010-trait)

(define-constant ERR-NOT-OWNER (err u200))
(define-constant ERR-NOT-ROUTER (err u201))
(define-constant ERR-BALANCE-READ (err u202))

(define-data-var authorized-router principal .yield-router)
;; Sum of open-position principal supplied through this strategy. The sBTC value
;; of the pooled zsbtc (zsbtc get-balance, which is interest-inclusive) above
;; this is accrued interest, shared out pro-rata on withdraw.
(define-data-var total-principal uint u0)

(define-private (is-authorized-router)
  (is-eq contract-caller (var-get authorized-router))
)

;; Deposit: supply sBTC (already transferred here by the router) into Zest.
;; as-contract makes tx-sender == contract-caller inside Zest, clearing its guard
;; (proven in the week-1 spike), and mints zsbtc-v2-0 to this strategy (owner).
(define-public (deposit (amount uint))
  (begin
    (asserts! (is-authorized-router) ERR-NOT-ROUTER)
    (let ((self (as-contract tx-sender)))
      (try! (as-contract
        (contract-call? 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.borrow-helper-v2-1-7 supply
          'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.zsbtc-v2-0        ;; lp
          'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.pool-0-reserve-v2-0 ;; pool-reserve
          'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token       ;; asset
          amount
          self                                                        ;; owner
          none                                                        ;; referral
          'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.incentives-v2-2   ;; incentives
        )))
      (var-set total-principal (+ (var-get total-principal) amount))
      (ok true)
    )
  )
)

;; Withdraw: redeem this position's PRO-RATA share of the pool from Zest and send
;; it to the recipient. redeem-amount = amount * total-value / total-principal,
;; where total-value is the interest-inclusive sBTC value of the pooled zsbtc
;; (zsbtc get-balance). So the position gets principal + its share of accrued
;; interest, not just principal. Zest sends the underlying to `owner` (this
;; strategy), so we forward the measured balance delta. price-feed-bytes carries
;; the fresh Pyth update Zest requires.
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
        (self (as-contract tx-sender))
        (principal-total (var-get total-principal))
        (total-value (unwrap! (contract-call? 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.zsbtc-v2-0 get-balance (as-contract tx-sender)) ERR-BALANCE-READ))
        (redeem-amount (if (> principal-total u0) (/ (* amount total-value) principal-total) amount))
        (bal-before (unwrap! (contract-call? token get-balance (as-contract tx-sender)) ERR-BALANCE-READ))
      )
      (try! (as-contract
        (contract-call? 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.borrow-helper-v2-1-7 withdraw
          'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.zsbtc-v2-0            ;; lp
          'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.pool-0-reserve-v2-0   ;; pool-reserve
          'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token          ;; asset
          'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.stx-btc-oracle-v1-4   ;; oracle
          redeem-amount
          self                                                           ;; owner
          ;; assets: MUST list every Zest reserve asset, in registry order, for
          ;; the health-factor check (validate-assets enforces len match).
          ;; Order/ids ground-truthed from a real sBTC withdraw tx (0xcee0ca58).
          (list
            { asset: 'SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG.ststx-token, lp-token: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.zststx-v2-0, oracle: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.stx-btc-oracle-v1-4 }
            { asset: 'SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-aeusdc, lp-token: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.zaeusdc-v2-0, oracle: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.aeusdc-oracle-v1-0 }
            { asset: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.wstx, lp-token: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.zwstx-v2-0, oracle: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.stx-btc-oracle-v1-4 }
            { asset: 'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.arkadiko-token, lp-token: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.zdiko-v2-0, oracle: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.diko-oracle-v1-1 }
            { asset: 'SPN5AKG35QZSK2M8GAMR4AFX45659RJHDW353HSG.usdh-token-v1, lp-token: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.zusdh-v2-0, oracle: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.usdh-oracle-v1-0 }
            { asset: 'SP2XD7417HGPRTREMKF748VNEQPDRR0RMANB7X1NK.token-susdt, lp-token: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.zsusdt-v2-0, oracle: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.susdt-oracle-v1-0 }
            { asset: 'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.usda-token, lp-token: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.zusda-v2-0, oracle: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.usda-oracle-v1-1 }
            { asset: 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token, lp-token: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.zsbtc-v2-0, oracle: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.stx-btc-oracle-v1-4 }
            { asset: 'SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.token-alex, lp-token: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.zalex-v2-0, oracle: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.alex-oracle-v1-1 }
            { asset: 'SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG.ststxbtc-token-v2, lp-token: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.zststxbtc-v2_v2-0, oracle: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.stx-btc-oracle-v1-4 }
          )                                                              ;; assets
          'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.incentives-v2-2       ;; incentives
          price-feed-bytes)))
      (let (
          (bal-after (unwrap! (contract-call? token get-balance (as-contract tx-sender)) ERR-BALANCE-READ))
          (received (- bal-after bal-before))
        )
        ;; Reduce tracked principal by this position's principal (not redeem-amount,
        ;; which includes its interest share). Clamp to avoid underflow.
        (var-set total-principal (if (>= principal-total amount) (- principal-total amount) u0))
        (try! (as-contract (contract-call? token transfer received (as-contract tx-sender) recipient none)))
        (ok received)
      )
    )
  )
)

;; Admin-only: update authorized router.
(define-public (set-authorized-router (new-router principal))
  (begin
    (asserts! (is-eq contract-caller (var-get authorized-router)) ERR-NOT-OWNER)
    (var-set authorized-router new-router)
    (ok new-router)
  )
)

;; TVL = this strategy's zsbtc-v2-0 balance (an interest-bearing aToken, so it
;; already reflects principal + accrued interest in sBTC terms).
(define-read-only (get-tvl)
  (contract-call? 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.zsbtc-v2-0 get-balance (as-contract tx-sender))
)

;; APY: raw Zest reserve current-liquidity-rate. NOTE: this is Zest's internal
;; rate encoding, not yet basis points. UI/router conversion to bps is a
;; follow-up; withdraw payout comes from Zest directly, not from this number.
(define-read-only (get-apy)
  (ok (get current-liquidity-rate
    (try! (contract-call? 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.pool-0-reserve-v2-0 get-reserve-state
      'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token))))
)
