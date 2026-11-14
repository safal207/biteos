# Roby’s growth service — commercial pilot v0.1

Source: Roby’s main 59f127c69983eae57215868679d8fa46bab89931. Existing device-local likes/views (src/menu-feed-engagement.js), catalog visual feed, share pages, cart draft, Smart Choice, site analytics hooks, counter SQLite and cashier-confirmed payments. No verified centralized traffic history, named customer accounts with repeat-order linkage, production POS integration, geolocation, or owner-approved analytics deployment.

## Business hypotheses to validate with owner
- Which menu items need more demand, which attract interest but are not ordered?
- Which channels and hours produce measurable visits, purchases and contribution?
- Which guests return, what drives repeat purchase, what is the contribution after campaign costs?
- Which operational/website problems lose intent or orders? Which campaigns are profitable?

## Measurement
- Anonymous opt-in session: first observed entry, last observed activity (not exact exit), language, allowlisted source/campaign, local hour. No full referrer, query string, IP, fingerprint or precise location in event payload. Coarse region only after appropriate consent/legal review and separate approved data source.
- Product: qualified photo view, like/unlike, share intent/completed, add-to-cart; use unique sessions per product/action. Share completion is not proof a friend received a link. Only an actual destination landing counts as referral traffic.
- Heatmap: semantic area clicks, not screen recordings or text, with page/variant awareness as a future refinement.
- Actual paid orders from independently reconciled cafe records. Existing counter acknowledges external payments; it does not prove POS settlement. Basket draft value is not revenue; liked/shared items map to listed price only. No cross-session repeat-customer measure without opt-in stable account/loyalty identity and reconciled purchases.
- Baseline 14 days, then pilot 14 days as an initial proposal, adjust to volume and weekday mix. Descriptive comparisons only unless controlled assignment and sample rules are satisfied.

## Product implementation
scripts/robys-engagement.mjs provides an opt-in in-memory event contract, safe UTM link builder, bounded JSON export aggregation, deduplication, channel/product/hour/semantic click counts, observed session span. The generated UTM links use the direct existing menu feed because the existing OG share page intentionally discards inbound query parameters. A release-safe allowlisted propagation of UTM through OG redirect is still needed. No browser hook, deployment, background collector, production permissions, true dashboard wiring or network connection in this commit. Use authorized local JSON only; run node scripts/robys-engagement.mjs events.json catalog-ids.json. No real data is included. Database connector remains separately read-only.

## Commercial model — proposed, not market-validated
1. Fixed monthly support and measurement service, plus setup: agreed scope, uptime monitoring, bug triage/fix, report, menu edits and campaign recommendations.
2. Hybrid base plus outcome bonus: audited incremental contribution or confirmed attributed new/returning customers with mutually agreed baseline, costs, attribution window, maximum payout, exclusions, refunds and no double-counting. Views/likes/clicks/shares are diagnostic, not payment targets by default.
3. Scoped campaign/brand projects: fixed project price, materials, content calendar, transparent promotion terms, consent for testimonials/photos, independent feedback, campaign recap; never reward positive reviews or condition rewards on review sentiment.

Initial negotiation hypothesis in TRY: 5,000 setup + 7,500/month for core service; 12,000/month for agreed campaign management and deeper reporting; outcome bonus only after trustworthy baseline. Prices are illustrative, adjustable to labor, scope and owner's economics; no promises of business uplift.

## Owner deliverable
Weekly one-page business summary: channel quality, product funnel, hour patterns, order reconciliation, operating problems, recommended experiment, next decision. Monthly business review. No automatic campaigns or public changes without agreed scope.

## Community loop
Story → question → authentic visitor reply → feedback → approved campaign announcement and rules → participation → consented photos/results → referral and repeat-visit measurement → learn. Make participation voluntary. A reward must not be tied to a positive review. Keep personal information and contact channels separate from aggregate product analytics.

## Growth dashboard v0.1

BiteOS workspace #retail-robys-growth displays synthetic data on GitHub Pages and explicitly imported aggregate JSON in the local dev build. It reads the existing two export schemas independently, validates bounds/tenant/evidence flags, renders product ranking, sources, entry hours, semantic area clicks, and counter KPIs. Files remain in memory, with no upload or storage; clear resets both reports. No aggregate join, paid-conversion calculation, live tracking, unique customer claim or real revenue claim. Product images are existing reviewed assets. Exact-head tests required.

## Catalog sync v0.1

Pinned public catalog at 59f127c69983eae57215868679d8fa46bab89931; 63 positions in 8 categories and 16 flavor options across three products. Original feed IDs and source photo paths preserved, every source photo and Turkish share page verified in the pinned tree. Existing local thumbnails are reused; other products link to Robys rather than loading remote images. Growth analytics resolves known IDs into TR/RU/EN names, plus a searchable source catalog. Source prices are listed prices, not actual transactions, stock or historical amounts. The three-item synthetic economic preset is intentionally unchanged. Refresh is explicit with the pinned import script; no silent cross-repository price overwrite or live data claim. Run node scripts/robys-catalog-sync.mjs <reviewed checkout> and compare output with apps/kiosk/src/robysPublicCatalog.ts. Future revision changes require source review and a new pin.
