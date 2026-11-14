# BiteOS Retail — independent Rozal concept

Open the `#retail` route on the local BiteOS frontend. In GitHub Pages mode it is a single-tab browser simulation; in local API mode it calls Go. The existing restaurant and kiosk routes are unchanged.

## Scope

- TRY minor units, illustrative multilingual product catalog, search and categories.
- Server-priced orders, stock reservation under a lock, idempotency key replay/conflict, cancellation restoring stock.
- Pickup or delivery with a zone-dependent sample fee, minimum basket and capacity-controlled fictional time windows; explicit replacement preference (no actual substitutions).
- Fulfillment events: reserved → picking → packed → collected, or in_transit → delivered; cancellation before dispatch.
- Demo limit: 1000 orders per process. All retail state is in memory. Restart resets it. No real merchant, courier, payments, authentication, address or customer data. The status button simulates all roles. Do not expose the local API publicly.

## Delivery and inventory operations

- GET /api/retail/delivery lists sample zones, fees in TRY minor units, minimum order and remaining slots.
- POST /api/retail/orders requires zoneId and slotId in delivery mode; pickup must omit them or pass empty strings. Inventory and capacity commit under the same lock; cancellation releases both. Slots are static demo windows, not a real dated calendar.
- GET /api/retail/inventory returns current stock and the latest 100 movements.
- POST /api/retail/inventory accepts productId, quantity, unitCost (TRY minor units) and reference with an Idempotency-Key. It records receipts and increases available stock; repeated keys with changed payload return 409.
- The journal records available-stock changes (receive, reserve, release), not financial accounting or physical on-hand stock. Batch expiration, valuation, wastage, authenticated access, durable storage and a manager UI remain future work.
- Browser-only mode simulates slot capacity and stock locally; it does not expose procurement operations. Do not treat any demo window as an actual delivery promise.

## Trust Engine — first evidence boundary

- GET /api/retail/evidence exports at most 100 recent in-memory events: accepted order creation, state transitions and receiving. Duplicate/rejected requests do not append events. Event digests link to the previous digest and include the local aggregate version.
- The chain is a demo integrity check, not signed/authenticated evidence, not durable, and not a full transaction payload. Process restart resets the chain. Never infer payment, dispatch, external delivery or absence of an effect from a local reservation claim.
- `BITEOS-LIMINALDB-001`: Go test generates a synthetic unavailable external readback scenario from an actual internal demo order event. A distinct CI job checks out LiminalDB at commit `61b02fc81e0cb5cf1f1ed4658ecff58f683cb728` and runs a native Rust ledger compatibility/reopen test. The fixture requires REVALIDATE and must not assert an external committed effect. This is a bounded test of mapping and replay, not runtime integration or a payment guarantee.
- Next: SQLite transaction + durable outbox, stable persisted stream identity, independent readback authority, acknowledgement/retry protocol, authenticated runtime sidecar and crash injection. Do not add paid dependencies.

## Verification

Existing CI runs Go tests, race detector, React build, and restaurant/kiosk tests. New retail Go tests cover stock reservation, duplicate requests, conflict, cancellation, invalid transitions, failed basket, concurrent purchase of last stock, slot capacity/cancellation, invalid delivery parameters and idempotent procurement receipts. Before merging, require full CI and browser smoke at 360px and desktop, three languages, pickup/delivery, cancellation, and no regression of #kiosk and default restaurant routes.

## Next phases

1. SQLite durable transactions and outbox for a pinned LiminalDB evidence adapter; tenant/store identity, inventory and idempotency receipts, authenticated roles. PostgreSQL only when concurrency or deployment requirements justify migration. See [Zero License Cost](zero-license-cost.md).
2. Packaged and weighted SKU pricing, stock adjustment ledger, expiration tracking, substitutions with explicit consent, order snapshots, refunds.
3. Delivery zones/slots, dispatch and courier assignment, permitted real-time tracking, clear ETA, delivery economics.
4. Repeat purchases, favorites, consent-based loyalty, demand requests and merchant analytics for contribution margin, stockouts, spoilage and retention.
5. SEO storefront and licensed product photos; verified catalog and explicit owner permission before pilot.

Go owns transactions and prices. Keep Rust suggestions isolated and optional; no Rust changes required for retail. React/TypeScript/Vite remains the shared UI. No live brand affiliation is claimed.
