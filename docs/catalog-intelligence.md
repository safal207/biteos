# BiteOS Catalog Intelligence + Revenue Lab

## Evidence and permissions

The Business Discovery view at `/#business` exposes **read-only source snapshots**, not checkout catalogs. The copy of the source fields is intentionally small (stable ID, category, original name, optionally price in integer minor units). No images, customer data, sales logs or commercial cost data are copied.

| Business | Catalog source | Source type | Items | Missing price | Owner-approved prices |
| --- | --- | --- | ---: | ---: | ---: |
| MIORA | `safal207/miora-coffee/docs/source-menu-2026-11-05.json` | Historic menu capture | 93 | 2 | 0 confirmed in BiteOS |
| Sefa Beach | `safal207/sefa-beach/menu-baseline.json` | Historic baseline | 123 | 5 | 0 confirmed in BiteOS |
| Riva Bella | `safal207/riva-bella-revenue/data/catalog-draft.json` | Draft without approved items | 0 | N/A | 0 |
| Bite Burger / Roby's | Internal BiteOS delivery model | Demo-only | Derived at runtime | Variable | 0 confirmed in BiteOS |

The read-only snapshots are stored in `apps/kiosk/src/data` with source path and Git blob SHA. The source change is not automatically applied. A catalog is not owner-approved just because its price is present.

**Riva Bella:** the public Revenue Lab contains eight fictional products, and its draft owner-review catalog has zero items. A separate 176-item Gazipaşa concept is private. None of these private items, images or unpublished prices are exported to BitOS. A future approved public export must pass the source repository's product approval gate.

### Refresh protocol

1. Re-read source data and pinned source blob SHA; compare IDs, categories, missing prices and counts.
2. Confirm catalog validity, approved vendor use, translations, actual availability and price changes.
3. Save refreshed read-only snapshot in its own PR with evidence; never write directly into ordering catalog.
4. Run unit tests and browser checks at narrow and wide viewports.
5. Activate real checkout catalog only behind owner-authenticated, scoped backend and server-side verified prices. Never turn a preview into a customer-facing order flow by inference.

## Revenue Lab

The model is **hypothetical** and requires user-entered values; no numbers are derived from unconfirmed catalog prices.

```text
eligible_orders = orders_per_day * days
expected_incremental_addons = eligible_orders * (proposed_attach_rate - baseline_attach_rate) / 100
incremental_revenue = expected_incremental_addons * addon_price
incremental_variable_cost = expected_incremental_addons * addon_unit_variable_cost
incremental_contribution = incremental_revenue - incremental_variable_cost - campaign_cost
```

Rates are percentages (0–100), money stored as integer minor units (cents/kuruş/kopecks). Expected add-on units can be fractional because they are an **expectation**, not fulfilled orders. The UI has an explicitly labeled hypothetical example for usability, and empty real inputs by default.

Results are **not net profit**. The calculation assumes constant baseline order volume and ignores cannibalization, lost sales, changes in conversion, tax, staffing, rent, unmeasured variable labor, broader capacity constraints and other overhead. A negative contribution is shown if the hypothesis worsens or costs outweigh benefit.

A real claim requires actual POS baseline, owner-confirmed COGS/packaging/fees, consistent eligible order denominator, randomized holdout experiment where feasible, and reconciliation of demonstrated checkout to completed paid orders.

No data from the input is sent or persisted by the Revenue Lab.
