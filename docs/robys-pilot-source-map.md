# Roby’s → BiteOS: source map and first read-only connector

Inspected repository: safal207/robys-coffee-house-demo, main commit 59f127c69983eae57215868679d8fa46bab89931. This is code inspection, not a connection to a deployed cafe database.

| Source | Available signal | Current boundary |
| --- | --- | --- |
| analytics.js | section views, maps/Instagram clicks, language, gallery | browser buffer/dataLayer; centralized collection not demonstrated |
| docs/smart-choice/analytics-contract.md | starts, recommendations, selection, bump, handoff, basket, time to choice | browser session sink by default; no payment/realized revenue |
| src/menu-feed-engagement.js | likes, seen, view counts | personal local browser history, not global popularity |
| counter/store.mjs | order creation, paid_at, total_minor, status, audit ready/issued | SQLite schema v1; payment is staff acknowledgment, not reconciled POS |
| counter-config.json | static checkout enabled flag | false at inspected commit; hosted service not verified |
| docs/causal-refactoring/menu-to-visit-pilot.md | commitment → arrival → sale → contribution evidence rules | owner approval and independent evidence required |

## Local aggregate connector

On a trusted workstation, use an owner-approved, SQLite-consistent private backup (not a plain copy of an active WAL database). Node 24, built-in SQLite only:

~~~sh
node scripts/robys-counter-report.mjs /private/robys-counter-snapshot.sqlite 2026-11-14 2026-11-15
~~~

The output is versioned aggregate JSON. Period is [start, end), Istanbul UTC+03:00, at most 31 days. Orders created and payments acknowledged are separate event cohorts; unpaid at close refers only to orders created in the period. Issuance is counted by audit event. Average paid-to-ready uses first ready events before the close for payments acknowledged in the period; sample count is explicit; incomplete orders are excluded. Do not infer service-time performance of all orders from this censored sample. No raw IDs, staff names, credentials, guest keys, order composition or browser identifiers in output. No network, no mutation, no authentication bypass. Source revision is schema compatibility provenance, not verification of the supplied database's provenance. The output does not assert actual revenue, margin, attribution or causal effects. It is not yet consumed by Decision Studio; no real cafe data used.

Next: agree on owner-held source and retention; integrate a verified aggregate import; add consent-aware funnel aggregation; reconcile payment acknowledgments to approved POS reports; bring owner-approved recipe costs and stock. Keep GitHub Pages demo isolated.
