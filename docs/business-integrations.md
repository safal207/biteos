# BiteOS Business Discovery — connected demo registry

This first integration layer deliberately **links existing products without moving their source code, copying private assets, merging incompatible price catalogs, or claiming real order/analytics integrations**.

| Case | Origin | What is wired | What is not wired |
| --- | --- | --- | --- |
| Bite Burger | This repository | Kiosk, Go calculations, Rust recommendation logic, demo delivery | POS, real payments, revenue analytics |
| Roby's Coffee House | [robys-coffee-house-demo](https://github.com/safal207/robys-coffee-house-demo) | Existing curated Roby's demo catalog inside BiteOS, link to source storefront | Live menu sync, POS, permission to commercialize branded photos |
| MIORA Coffee | [miora-coffee](https://github.com/safal207/miora-coffee) | Read-only case registry and source link | Shared catalog, family-sales proof, actual order transfer |
| Sefa Beach | [sefa-beach](https://github.com/safal207/sefa-beach) | Read-only case registry and link to QR-menu concept with 123 items, 3 languages, waiter-list basket and local revenue template | Five missing prices; all menu prices require owner approval; no POS or measured sales |
| Riva Bella | [riva-bella-revenue](https://github.com/safal207/riva-bella-revenue) | Read-only case registry and link to public Revenue Lab with eight explicitly fictional demo products and illustrative economics | No shared official menu, synced prices, checkout, real profitability or publishing rights; separate 176-item concept is private |
| AI Café Network | [ai-cafe-network](https://github.com/safal207/ai-cafe-network) | Read-only pilot registry and source link | Venue enrollment and measured pilot outcomes |

Private projects such as Zenit Alanya and the 176-item Riva Bella Gazipaşa concept are intentionally **not exposed** on the public Business Discovery page. Their use needs a separate access-controlled adapter and approval of brand/media rights.

The public entry point is `/#business` (on GitHub Pages, `/biteos/#business`).
Users can select a case and enter a six-question discovery draft. The browser keeps it only in memory and exports a `biteos.discovery.v1` JSON file on demand. There is no database, upload, customer tracking, model inference, or verified source attached to these answers.

## Next connection contract

1. **Business truth:** owner verifies prices, inventory, costs, opening hours, media and allowed use.
2. **Needs evidence:** interview/sample method, source, date, customer segment, confidence and privacy handling.
3. **Opportunity model:** measured baseline + documented assumption + margin/cost data + time horizon; distinguish revenue from profit.
4. **Channel adapter:** read-only approved catalog snapshots first, then scoped order integration behind authentication.
5. **Measurement:** consented server-side aggregate events, POS reconciliation and randomized A/B tests; do not use device-local demo counters as sales results.
6. **Release gate:** run source-project QA and BiteOS QA, validate visual fidelity, fail closed on stale pricing or unavailable goods.

Demo source URLs are not API endpoints. No cross-repository data is fetched into the runtime. This layer is a **real navigation and discovery connection**, not a production integration.
