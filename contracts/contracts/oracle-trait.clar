;; oracle-trait.clar
;;
;; Generic price-oracle trait, defined locally (same rationale as
;; sip-010-trait.clar) so yield-strategy-trait.clar and yield-router.clar can
;; `use-trait` it without depending on an externally-deployed trait contract
;; address. Structurally matches Zest's own oracle-trait
;; (SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.oracle-trait), so a Zest oracle
;; contract satisfies this trait too, and can be forwarded straight into a
;; Zest contract-call that expects its own oracle-trait.
(use-trait sip-010-trait .sip-010-trait.sip-010-trait)

(define-trait oracle-trait
  (
    ;; Current price for the given asset, in the oracle's own units.
    (get-asset-price (<sip-010-trait>) (response uint uint))
  )
)
