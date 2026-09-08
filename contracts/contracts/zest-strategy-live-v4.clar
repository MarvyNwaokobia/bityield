;; zest-strategy-live-v4.clar
;;
;; NOT YET DEPLOYED. Fixes zest-strategy-live-v2 (frozen snapshot in
;; zest-strategy-live-v2.clar), which hardcodes two Zest mainnet contracts
;; that Zest has since rotated out from under it:
;;   borrow-helper-v2-1-7 -> borrow-helper-v2-1-8
;;   stx-btc-oracle-v1-6  -> stx-btc-oracle-v1-7
;;
;; Named v4, not v3: "zest-strategy-live-v3" already refers, in
;; docs/m2-testing-guide.md ("Oracle-dynamic redesign"), to an abandoned
;; caller-supplied-<oracle-trait> design that was deployed to mainnet and
;; failed for an unfixable reason (Zest's own withdraw chain forwards the
;; oracle through 3 hops of dynamic dispatch, hitting Clarity's stack-depth
;; limit). That name 404s on-chain today (the failed deploy never created a
;; contract, so it's technically free), but reusing it here would collide
;; with that documented history. This file does NOT use a dynamic
;; <oracle-trait> - the oracle stays a hardcoded literal, exactly like v2 -
;; so it is not exposed to that dead end at all.
;;
;; Root cause (confirmed on-chain, 2026-09-08): Zest's incentives-v2-2
;; contract no longer has borrow-helper-v2-1-7 in its approved-contracts
;; allowlist (only v2-1-8 is approved now), so both `deposit` and `withdraw`
;; abort inside borrow-helper's internal `claim-rewards-to-vault` call with
;; (err u8000001) (incentives-v2-2's ERR_UNAUTHORIZED). Verified via direct
;; read-only calls:
;;   incentives-v2-2.is-approved-contract('...borrow-helper-v2-1-7) -> (err u8000001)
;;   incentives-v2-2.is-approved-contract('...borrow-helper-v2-1-8) -> (ok true)
;; zest-strategy-live-v2's on-chain TVL is 0 (confirmed via get-tvl), so this
;; is a clean swap - no funds are stuck, nothing to migrate.
;;
;; The oracle also rotated (confirmed via pool-0-reserve-v2-0.get-reserve-state):
;; every reserve priced off the shared STX/BTC oracle (sbtc, ststx, wstx,
;; ststxbtc) now reports `oracle: stx-btc-oracle-v1-7`, not v1-6. The other six
;; reserves (aeusdc, diko, usdh, susdt, usda, alex) still use their original,
;; unchanged oracles - only the four below were touched. Reserve order and
;; every lp-token (a-token-address) are unchanged (both reconfirmed on-chain
;; against pool-borrow-v2-4.get-assets and each reserve's current state, not
;; carried over from the old file).
;;
;; KNOWN GAP (not fixed by this contract): stx-btc-oracle-v1-7 verifies Pyth
;; *Lazer* updates (`pyth-lazer-oracle.verify-price-feeds` /
;; `pyth-lazer-decoder-v1`), not the old Pyth Hermes/Wormhole PNAU format
;; v1-6 used. app/app/api/pyth-price/route.ts still fetches the old Hermes
;; PNAU format, so a live `withdraw` will still fail until that route (and
;; app/lib/stacks/pyth.ts) are switched to a Pyth Lazer update source. Deposit
;; does not take price-feed-bytes at all, so it is unaffected by this gap.
;;
;; Zest contracts (deployer SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N):
;;   borrow-helper-v2-1-8  supply / withdraw wrapper (guarded by tx-sender==contract-caller)
;;   zsbtc-v2-0            sBTC receipt token (lp), accrues to this strategy
;;   pool-0-reserve-v2-0   reserve + user state
;;   stx-btc-oracle-v1-7   sBTC oracle (Zest rotated from v1-6 to v1-7 alongside the helper bump)
;;   incentives-v2-2       rewards contract
;; sBTC: SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token

(impl-trait .yield-strategy-trait.yield-strategy-trait)
(use-trait sip-010-trait .sip-010-trait.sip-010-trait)

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
        (contract-call? 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.borrow-helper-v2-1-8 supply
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

;; Private: redeem `redeem-amount` sBTC from Zest and forward the measured balance
;; delta to `recipient`. sBTC is hardcoded (this strategy only ever holds sBTC),
;; so no trait needs threading through. Shared by the router withdraw and the
;; owner emergency redeem.
(define-private (redeem-and-forward
    (redeem-amount uint)
    (recipient principal)
    (price-feed-bytes (optional (buff 8192)))
  )
  (let (
      (bal-before (unwrap! (contract-call? 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token get-balance (as-contract tx-sender)) ERR-BALANCE-READ))
    )
    (try! (as-contract
      (contract-call? 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.borrow-helper-v2-1-8 withdraw
        'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.zsbtc-v2-0            ;; lp
        'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.pool-0-reserve-v2-0   ;; pool-reserve
        'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token          ;; asset
        'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.stx-btc-oracle-v1-7   ;; oracle
        redeem-amount
        (as-contract tx-sender)                                        ;; owner = self
        ;; assets: MUST list every Zest reserve asset, in registry order, for
        ;; the health-factor check (validate-assets enforces len match).
        ;; Order and lp-tokens ground-truthed 2026-09-08 against
        ;; pool-borrow-v2-4.get-assets and each reserve's live get-reserve-state
        ;; (not carried over from the v2 file's tx-derived list). Oracle rotated
        ;; to v1-7 on the four STX/BTC-priced reserves only.
        (list
          { asset: 'SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG.ststx-token, lp-token: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.zststx-v2-0, oracle: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.stx-btc-oracle-v1-7 }
          { asset: 'SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-aeusdc, lp-token: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.zaeusdc-v2-0, oracle: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.aeusdc-oracle-v1-0 }
          { asset: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.wstx, lp-token: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.zwstx-v2-0, oracle: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.stx-btc-oracle-v1-7 }
          { asset: 'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.arkadiko-token, lp-token: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.zdiko-v2-0, oracle: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.diko-oracle-v1-1 }
          { asset: 'SPN5AKG35QZSK2M8GAMR4AFX45659RJHDW353HSG.usdh-token-v1, lp-token: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.zusdh-v2-0, oracle: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.usdh-oracle-v1-0 }
          { asset: 'SP2XD7417HGPRTREMKF748VNEQPDRR0RMANB7X1NK.token-susdt, lp-token: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.zsusdt-v2-0, oracle: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.susdt-oracle-v1-0 }
          { asset: 'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.usda-token, lp-token: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.zusda-v2-0, oracle: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.usda-oracle-v1-1 }
          { asset: 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token, lp-token: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.zsbtc-v2-0, oracle: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.stx-btc-oracle-v1-7 }
          { asset: 'SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.token-alex, lp-token: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.zalex-v2-0, oracle: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.alex-oracle-v1-1 }
          { asset: 'SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG.ststxbtc-token-v2, lp-token: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.zststxbtc-v2_v2-0, oracle: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.stx-btc-oracle-v1-7 }
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

;; Withdraw: redeem this position's PRO-RATA share of the pool from Zest and send
;; it to the recipient. redeem-amount = amount * total-value / total-principal,
;; where total-value is the interest-inclusive sBTC value of the pooled zsbtc
;; (zsbtc get-balance). So the position gets principal + its share of accrued
;; interest, not just principal. `token` is kept for trait conformance; the
;; strategy always transacts in the canonical sBTC hardcoded above.
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
        (principal-total (var-get total-principal))
        (total-value (unwrap! (contract-call? 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.zsbtc-v2-0 get-balance (as-contract tx-sender)) ERR-BALANCE-READ))
        (redeem-amount (if (> principal-total u0) (/ (* amount total-value) principal-total) amount))
      )
      (let ((received (try! (redeem-and-forward redeem-amount recipient price-feed-bytes))))
        ;; Reduce tracked principal by this position's principal (not redeem-amount,
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
;; multisig (see docs).

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
;; normal withdraw path is broken.
(define-public (owner-emergency-zest-redeem
    (amount uint)
    (recipient principal)
    (price-feed-bytes (optional (buff 8192)))
  )
  (begin
    (asserts! (is-owner) ERR-NOT-OWNER)
    (redeem-and-forward amount recipient price-feed-bytes)
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
