# BiteOS Retail — independent Rozal concept

Open the `#retail` route on the local BiteOS frontend. In GitHub Pages mode it is a single-tab browser simulation; in local API mode it calls Go. The existing restaurant and kiosk routes are unchanged.

## Scope

- TRY minor units, illustrative multilingual product catalog, search and categories.
- Server-priced orders, stock reservation under a lock, idempotency key replay/conflict, cancellation restoring stock.
- Pickup or delivery with a sample fixed fee; explicit replacement preference (no actual substitutions).
- Fulfillment events: reserved → picking → packed → collected, or in_transit → delivered; cancellation before dispatch.
- Demo limit: 1000 orders per process. All retail state is in memory. Restart resets it. No real merchant, courier, payments, authentication, address or customer data. The status button simulates all roles. Do not expose the local API publicly.

## Verification

Existing CI runs Go tests, race detector, React build, and restaurant/kiosk tests. New retail Go tests cover stock reservation, duplicate requests, conflict, cancellation, invalid transitions, failed basket and concurrent purchase of last stock. Before merging, require full CI and browser smoke at 360px and desktop, three languages, pickup/delivery, cancellation, and no regression of #kiosk and default restaurant routes.

## Next phases

1. PostgreSQL migrations, tenant/store identity, transactionally locked inventory and idempotency receipts, authenticated customer/operator/courier roles.
2. Packaged and weighted SKU pricing, stock adjustment ledger, expiration tracking, substitutions with explicit consent, order snapshots, refunds.
3. Delivery zones/slots, dispatch and courier assignment, permitted real-time tracking, clear ETA, delivery economics.
4. Repeat purchases, favorites, consent-based loyalty, demand requests and merchant analytics for contribution margin, stockouts, spoilage and retention.
5. SEO storefront and licensed product photos; verified catalog and explicit owner permission before pilot.

Go owns transactions and prices. Keep Rust suggestions isolated and optional; no Rust changes required for retail. React/TypeScript/Vite remains the shared UI. No live brand affiliation is claimed.
