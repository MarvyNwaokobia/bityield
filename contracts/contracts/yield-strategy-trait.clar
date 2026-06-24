;; yield-strategy-trait.clar
;;
;; Definition of the trait that all BitYield yield strategies must implement.

(use-trait sip-010-trait .sip-010-trait.sip-010-trait)

(define-trait yield-strategy-trait
  (
    ;; Deposit sBTC into the strategy.
    ;; The caller is the YieldRouter contract.
    (deposit (uint) (response bool uint))

    ;; Withdraw sBTC from the strategy, calculating yield based on entry parameters.
    ;; The caller is the YieldRouter contract.
    (withdraw (uint principal uint uint <sip-010-trait>) (response uint uint))

    ;; Get the current APY in basis points (e.g. 500 = 5.00%).
    (get-apy () (response uint uint))

    ;; Get the current TVL in satoshis.
    (get-tvl () (response uint uint))
  )
)
