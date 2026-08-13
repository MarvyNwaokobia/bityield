;; mock-oracle.clar
;;
;; Minimal oracle-trait implementer used only by the test suite, so
;; preview/mock strategies (which ignore the oracle argument entirely) have a
;; valid <oracle-trait> value to pass at withdraw time.
(impl-trait .oracle-trait.oracle-trait)
(use-trait sip-010-trait .sip-010-trait.sip-010-trait)

(define-read-only (get-asset-price (asset <sip-010-trait>))
  (ok u100000000)
)
