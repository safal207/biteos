# Living Business — offer review boundary v0.1

Stacked on BiteOS #6. Operator-side local scenario only. Extracts the
existing financial candidate gate so a business user can select a catalog
SKU without accessing a guest's device memory. The guest advice path still
delegates to the same gate. No additional ranking or cost formulas.

The strict business-offer input combines a current Istanbul-day
Business Brain bundle, selected catalog SKU, margin floor (at least the
existing 20 percent review floor) and campaign spending cap.
First recompute all five existing Business Brain engines. Existing holds
and missing/invalid sources outrank candidate review. Then recompute
the candidate's stock reserve and contribution from the exact same
operator-declared plan, costs, discount and campaign. No independently
supplied dashboard totals or customer/session IDs. Does not interpret
a favorable experiment as evidence of a personalized offer's impact.

Review-only means a scenario is eligible for human examination, not
verified profitability, owner approval, safe physical stock, a live
price, or launch authorization. No marketing, data transfer, telemetry,
payments, user interface or production change. The tests are synthetic.
Actual data, independent source reconciliation and exact-head CI remain
necessary. Robys #495 visual and #505 performance gates are separate.

Before broad rollout, consolidate overlapping draft PRs and obtain
owner acceptance of the basic menu. Do not add a live campaign sender.
