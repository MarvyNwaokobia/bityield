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
    ;; The trailing (optional (buff 8192)) carries a fresh oracle price update
    ;; (e.g. Zest's Pyth price-feed bytes) end to end. Strategies that need no
    ;; price feed ignore it by accepting `none`.
    (withdraw (uint principal uint uint <sip-010-trait> (optional (buff 8192))) (response uint uint))

    ;; Get the current APY in basis points (e.g. 500 = 5.00%).
    (get-apy () (response uint uint))

    ;; Get the current TVL in satoshis.
    (get-tvl () (response uint uint))
  )
)
