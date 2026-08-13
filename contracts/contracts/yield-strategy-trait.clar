;; yield-strategy-trait.clar
;;
;; Definition of the trait that all BitYield yield strategies must implement.

(use-trait sip-010-trait .sip-010-trait.sip-010-trait)
(use-trait oracle-trait .oracle-trait.oracle-trait)

(define-trait yield-strategy-trait
  (
    ;; Deposit sBTC into the strategy.
    ;; The caller is the YieldRouter contract.
    (deposit (uint) (response bool uint))

    ;; Withdraw sBTC from the strategy, calculating yield based on entry parameters.
    ;; The caller is the YieldRouter contract.
    ;; The <oracle-trait> is the price oracle contract to use for this withdrawal,
    ;; supplied fresh by the caller at transaction time (not stored on-chain), so
    ;; a strategy is never stuck if the underlying protocol rotates its oracle
    ;; contract. Strategies that need no oracle ignore the argument.
    ;; The trailing (optional (buff 8192)) carries a fresh oracle price update
    ;; (e.g. Zest's Pyth price-feed bytes) end to end. Strategies that need no
    ;; price feed ignore it by accepting `none`.
    (withdraw (uint principal uint uint <sip-010-trait> <oracle-trait> (optional (buff 8192))) (response uint uint))

    ;; Get the current APY in basis points (e.g. 500 = 5.00%).
    (get-apy () (response uint uint))

    ;; Get the current TVL in satoshis.
    (get-tvl () (response uint uint))
  )
)
