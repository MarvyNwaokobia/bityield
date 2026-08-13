;; zest-strategy-live.clar
;;
;; !!! NOT WHAT IS DEPLOYED. THIS FILE IS AHEAD OF MAINNET. !!!
;; This is the in-progress "oracle-dynamic redesign" prototype (see
;; docs/m2-testing-guide.md, "Oracle-dynamic redesign" — informally called
;; zest-strategy-live-v3 there). It has NOT been deployed. The contract that
;; is actually live on mainnet today, registered on the router as "zest", is
;; a different (earlier, hardcoded-oracle) version — see the frozen,
;; chain-verified snapshot at contracts/contracts/zest-strategy-live-v2.clar
;; for what's really running. Do not treat anything in this file (including
;; the withdraw signature below) as proof of live behavior.
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
;;   incentives-v2-2       rewards contract
;; sBTC: SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token
;;
;; ORACLE IS CALLER-SUPPLIED, NOT HARDCODED. Zest rotated the sBTC reserve's
;; oracle once already (stx-btc-oracle-v1-4 -> v1-6, discovered 2026-08-13 when
;; a prior version of this contract, which hardcoded v1-4, got permanently stuck
;; holding dust: Zest's withdraw rejects a mismatched oracle, and Zest's zsBTC
;; token cannot be moved out by an unapproved contract, so an immutable wrong
;; hardcoded oracle means unrecoverable funds). To survive future rotations
;; without a redeploy, the oracle contract is passed in fresh on every withdraw
;; (see yield-strategy-trait.withdraw's <oracle-trait> argument), the same way
;; price-feed-bytes already is. The caller (frontend, ultimately the router) is
;; responsible for supplying Zest's current oracle; read it live from
;; pool-0-reserve-v2-0.get-reserve-state before submitting, never hardcode it
;; client-side either.

(impl-trait .yield-strategy-trait.yield-strategy-trait)
(use-trait sip-010-trait .sip-010-trait.sip-010-trait)
(use-trait oracle-trait .oracle-trait.oracle-trait)

(define-constant ERR-NOT-OWNER (err u200))
(define-constant ERR-NOT-ROUTER (err u201))
(define-constant ERR-BALANCE-READ (err u202))

(define-data-var authorized-router principal .yield-router)
;; Owner (deployer) may repoint the router and trigger emergency recovery. This
;; is a single-key admin power for the controlled testing phase; a public launch
;; moves ownership to a multisig (see docs).
(define-data-var contract-owner principal tx-sender)
;; Sum of open-position principal supplied through this strategy. The sBTC value
;; of the pooled zsbtc (zsbtc get-balance, which is interest-inclusive) above
;; this is accrued interest, shared out pro-rata on withdraw.
(define-data-var total-principal uint u0)

(define-private (is-authorized-router)
  (is-eq contract-caller (var-get authorized-router))
)

(define-private (is-owner)
  (is-eq tx-sender (var-get contract-owner))
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

;; NOTE ON INLINING: `redeem-and-forward` used to be a shared private function
;; called by both `withdraw` and `owner-emergency-zest-redeem`. It is now
;; inlined into each (duplicated below) instead of shared, purely to remove
;; one call-stack frame from the path into Zest's withdraw. Discovered
;; 2026-08-13: a funded mainnet-fork test hit `MaxStackDepthReached` (a real
;; Stacks protocol limit, `MAX_CALL_STACK_DEPTH`, confirmed in stacks-core
;; source; not a simulator artifact) deep inside Zest's own health-factor
;; calculation, specifically when the oracle argument is a caller-supplied
;; `<oracle-trait>` value rather than a hardcoded literal -- dynamic trait
;; dispatch appears to add real depth at each contract boundary the value
;; crosses, and Zest's own call chain already leaves little headroom. This
;; inlining removes one guaranteed frame (the private-function-call boundary);
;; whether it is enough on its own is not yet proven (see
;; docs/m2-testing-guide.md, "Oracle-dynamic redesign").
;;
;; The `assets` list below still hardcodes each entry's oracle as a literal,
;; INCLUDING the four (ststx, wstx, sbtc, ststxbtc) that share the same
;; STX/BTC oracle as the top-level argument. This is a real Clarity limitation,
;; not a choice: a trait-typed parameter can be passed as a bare function
;; argument, but cannot be embedded as a value inside a tuple/list literal
;; constructed in contract code (confirmed by compiling: `oracle: oracle`
;; inside these tuples fails with a CallableType(Trait)/PrincipalType
;; mismatch). Making the assets-list oracles dynamic too would require the
;; caller to supply the entire `assets` list as a raw transaction argument,
;; pushing Zest's full 10-asset structure into the shared yield-strategy-trait
;; interface -- a much bigger change, not done. The 2026-08-13 incident was
;; specifically the top-level check, not these entries, so this scope matches
;; the actual failure observed.

;; Withdraw: redeem this position's PRO-RATA share of the pool from Zest and send
;; it to the recipient. redeem-amount = amount * total-value / total-principal,
;; where total-value is the interest-inclusive sBTC value of the pooled zsbtc
;; (zsbtc get-balance). So the position gets principal + its share of accrued
;; interest, not just principal. `token` is kept for trait conformance; the
;; strategy always transacts in the canonical sBTC hardcoded above. `oracle` is
;; the caller-supplied current STX/BTC oracle (see file header) -- this is the
;; exact check that broke in the 2026-08-13 incident, so making it caller-
;; supplied fixes that failure mode: a future rotation is a parameter update,
;; not a redeploy (subject to the stack-depth caveat above).
(define-public (withdraw
    (amount uint)
    (recipient principal)
    (entry-block uint)
    (apy-bps uint)
    (token <sip-010-trait>)
    (oracle <oracle-trait>)
    (price-feed-bytes (optional (buff 8192)))
  )
  (begin
    (asserts! (is-authorized-router) ERR-NOT-ROUTER)
    (let (
        (principal-total (var-get total-principal))
        (total-value (unwrap! (contract-call? 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.zsbtc-v2-0 get-balance (as-contract tx-sender)) ERR-BALANCE-READ))
        (redeem-amount (if (> principal-total u0) (/ (* amount total-value) principal-total) amount))
        (bal-before (unwrap! (contract-call? 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token get-balance (as-contract tx-sender)) ERR-BALANCE-READ))
      )
      (try! (as-contract
        (contract-call? 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.borrow-helper-v2-1-7 withdraw
          'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.zsbtc-v2-0            ;; lp
          'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.pool-0-reserve-v2-0   ;; pool-reserve
          'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token          ;; asset
          oracle                                                         ;; oracle (caller-supplied)
          redeem-amount
          (as-contract tx-sender)                                        ;; owner = self
          (list
            { asset: 'SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG.ststx-token, lp-token: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.zststx-v2-0, oracle: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.stx-btc-oracle-v1-6 }
            { asset: 'SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-aeusdc, lp-token: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.zaeusdc-v2-0, oracle: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.aeusdc-oracle-v1-0 }
            { asset: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.wstx, lp-token: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.zwstx-v2-0, oracle: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.stx-btc-oracle-v1-6 }
            { asset: 'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.arkadiko-token, lp-token: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.zdiko-v2-0, oracle: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.diko-oracle-v1-1 }
            { asset: 'SPN5AKG35QZSK2M8GAMR4AFX45659RJHDW353HSG.usdh-token-v1, lp-token: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.zusdh-v2-0, oracle: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.usdh-oracle-v1-0 }
            { asset: 'SP2XD7417HGPRTREMKF748VNEQPDRR0RMANB7X1NK.token-susdt, lp-token: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.zsusdt-v2-0, oracle: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.susdt-oracle-v1-0 }
            { asset: 'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.usda-token, lp-token: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.zusda-v2-0, oracle: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.usda-oracle-v1-1 }
            { asset: 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token, lp-token: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.zsbtc-v2-0, oracle: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.stx-btc-oracle-v1-6 }
            { asset: 'SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.token-alex, lp-token: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.zalex-v2-0, oracle: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.alex-oracle-v1-1 }
            { asset: 'SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG.ststxbtc-token-v2, lp-token: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.zststxbtc-v2_v2-0, oracle: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.stx-btc-oracle-v1-6 }
          )                                                              ;; assets
          'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.incentives-v2-2       ;; incentives
          price-feed-bytes)))
      (let (
          (bal-after (unwrap! (contract-call? 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token get-balance (as-contract tx-sender)) ERR-BALANCE-READ))
          (received (- bal-after bal-before))
        )
        (try! (as-contract (contract-call? 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token transfer received (as-contract tx-sender) recipient none)))
        ;; Reduce tracked principal by this position's principal (not received,
        ;; which includes its interest share). Clamp to avoid underflow.
        (var-set total-principal (if (>= principal-total amount) (- principal-total amount) u0))
        (ok received)
      )
    )
  )
)

;; --- Owner administration and emergency recovery ---
;; These are single-key powers for the controlled testing phase. They exist so
;; that if the router-driven withdraw path is ever unusable, funds are still
;; recoverable, instead of being stranded. A public launch moves ownership to a
;; multisig (see docs). Until then, treat deposits here as controlled testing.

;; Owner-only: point the strategy at a (new) router. Needed at deploy time.
(define-public (set-authorized-router (new-router principal))
  (begin
    (asserts! (is-owner) ERR-NOT-OWNER)
    (var-set authorized-router new-router)
    (ok new-router)
  )
)

;; Owner-only: transfer ownership (e.g. to a multisig).
(define-public (set-contract-owner (new-owner principal))
  (begin
    (asserts! (is-owner) ERR-NOT-OWNER)
    (var-set contract-owner new-owner)
    (ok new-owner)
  )
)

;; Owner-only emergency: redeem `amount` sBTC from Zest directly to `recipient`,
;; bypassing the router and pro-rata accounting. Use only for recovery if the
;; normal withdraw path is broken. Inlined (not shared with `withdraw`) for the
;; same stack-depth reason noted at `withdraw` above.
(define-public (owner-emergency-zest-redeem
    (amount uint)
    (recipient principal)
    (oracle <oracle-trait>)
    (price-feed-bytes (optional (buff 8192)))
  )
  (begin
    (asserts! (is-owner) ERR-NOT-OWNER)
    (let (
        (bal-before (unwrap! (contract-call? 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token get-balance (as-contract tx-sender)) ERR-BALANCE-READ))
      )
      (try! (as-contract
        (contract-call? 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.borrow-helper-v2-1-7 withdraw
          'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.zsbtc-v2-0            ;; lp
          'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.pool-0-reserve-v2-0   ;; pool-reserve
          'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token          ;; asset
          oracle                                                         ;; oracle (caller-supplied)
          amount
          (as-contract tx-sender)                                        ;; owner = self
          (list
            { asset: 'SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG.ststx-token, lp-token: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.zststx-v2-0, oracle: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.stx-btc-oracle-v1-6 }
            { asset: 'SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-aeusdc, lp-token: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.zaeusdc-v2-0, oracle: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.aeusdc-oracle-v1-0 }
            { asset: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.wstx, lp-token: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.zwstx-v2-0, oracle: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.stx-btc-oracle-v1-6 }
            { asset: 'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.arkadiko-token, lp-token: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.zdiko-v2-0, oracle: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.diko-oracle-v1-1 }
            { asset: 'SPN5AKG35QZSK2M8GAMR4AFX45659RJHDW353HSG.usdh-token-v1, lp-token: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.zusdh-v2-0, oracle: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.usdh-oracle-v1-0 }
            { asset: 'SP2XD7417HGPRTREMKF748VNEQPDRR0RMANB7X1NK.token-susdt, lp-token: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.zsusdt-v2-0, oracle: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.susdt-oracle-v1-0 }
            { asset: 'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.usda-token, lp-token: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.zusda-v2-0, oracle: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.usda-oracle-v1-1 }
            { asset: 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token, lp-token: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.zsbtc-v2-0, oracle: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.stx-btc-oracle-v1-6 }
            { asset: 'SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.token-alex, lp-token: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.zalex-v2-0, oracle: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.alex-oracle-v1-1 }
            { asset: 'SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG.ststxbtc-token-v2, lp-token: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.zststxbtc-v2_v2-0, oracle: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.stx-btc-oracle-v1-6 }
          )                                                              ;; assets
          'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.incentives-v2-2       ;; incentives
          price-feed-bytes)))
      (let (
          (bal-after (unwrap! (contract-call? 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token get-balance (as-contract tx-sender)) ERR-BALANCE-READ))
          (received (- bal-after bal-before))
        )
        (try! (as-contract (contract-call? 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token transfer received (as-contract tx-sender) recipient none)))
        (ok received)
      )
    )
  )
)

;; Owner-only: sweep a loose fungible token out of the strategy (e.g. sBTC that
;; landed here but is not in Zest). Recovery escape hatch.
(define-public (owner-sweep-ft (token <sip-010-trait>) (amount uint) (recipient principal))
  (begin
    (asserts! (is-owner) ERR-NOT-OWNER)
    (as-contract (contract-call? token transfer amount tx-sender recipient none))
  )
)

;; Owner-only: sweep loose STX (e.g. leftover Pyth-fee funding) out of the strategy.
(define-public (owner-sweep-stx (amount uint) (recipient principal))
  (begin
    (asserts! (is-owner) ERR-NOT-OWNER)
    (as-contract (stx-transfer? amount tx-sender recipient))
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
