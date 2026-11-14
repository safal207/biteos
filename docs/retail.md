# BiteOS Retail — independent Rozal concept

Open the `#retail` route on the local BiteOS frontend. In GitHub Pages mode it is a single-tab browser simulation; in local API mode it calls Go. The existing restaurant and kiosk routes are unchanged.

## Scope

- TRY minor units, illustrative multilingual product catalog, search and categories.
- Server-priced orders, stock reservation under a lock, idempotency key replay/conflict, cancellation restoring stock.
- Pickup or delivery with a zone-dependent sample fee, minimum basket and capacity-controlled fictional time windows; explicit replacement preference (no actual substitutions).
- Fulfillment events: reserved → picking → packed → collected, or in_transit → delivered; cancellation before dispatch.
- Demo limit: 1000 orders per process. The browser demo and test engines remain in memory. The local Go server uses a checksummed JSON checkpoint by default (`RETAIL_STORE`, or `retail-state.json` beside `ORDER_STORE`). No real merchant, courier, payments, authentication, address or customer data. The status button simulates all roles. Do not expose the local API publicly.

## Delivery and inventory operations

- GET /api/retail/delivery lists sample zones, fees in TRY minor units, minimum order and remaining slots.
- POST /api/retail/orders requires zoneId and slotId in delivery mode; pickup must omit them or pass empty strings. Inventory and capacity commit under the same lock; cancellation releases both. Slots are static demo windows, not a real dated calendar.
- GET /api/retail/inventory returns current stock and the latest 100 movements.
- POST /api/retail/inventory accepts productId, quantity, unitCost (TRY minor units) and reference with an Idempotency-Key. It records receipts and increases available stock; repeated keys with changed payload return 409.
- The journal records available-stock changes (receive, reserve, release), not financial accounting or physical on-hand stock. Batch expiration, valuation, wastage, authenticated access, durable storage and a manager UI remain future work.
- Browser-only mode simulates slot capacity and stock locally; it does not expose procurement operations. Do not treat any demo window as an actual delivery promise.

## Trust Engine — first evidence boundary

- GET /api/retail/evidence exports at most 100 recent events: accepted order creation, state transitions and receiving. Duplicate/rejected requests do not append events. Event digests link to the previous digest and include the local aggregate version.
- The chain is a demo integrity check, not signed/authenticated evidence, not a full transaction payload, and not a LiminalDB acknowledgement. The checkpoint stores the chain across ordinary restarts; memory-only mode resets it. Never infer payment, dispatch, external delivery or absence of an effect from a local reservation claim.
- `BITEOS-LIMINALDB-001`: Go test generates a synthetic unavailable external readback scenario from an actual internal demo order event. A distinct CI job checks out LiminalDB at commit `61b02fc81e0cb5cf1f1ed4658ecff58f683cb728` and runs a native Rust ledger compatibility/reopen test. The fixture requires REVALIDATE and must not assert an external committed effect. This is a bounded test of mapping and replay, not runtime integration or a payment guarantee.
- Next: SQLite transaction + durable outbox, stable persisted stream identity, independent readback authority, acknowledgement/retry protocol, authenticated runtime sidecar and crash injection. Do not add paid dependencies.

## Local checkpoint — intermediate persistence

A single process serializes all accepted retail state (stock, slots, orders, idempotency indexes, receipts, movements and evidence) under the engine lock. Before returning success it writes a temporary file, syncs and closes it, then renames it over the checkpoint. A failed pre-commit write restores the previous in-memory state and returns 503. Reopening validates the checksum, stock reconciliation, slot allocation and evidence relationships; an invalid file causes startup failure rather than reseeding stock silently.

This is a dependency-free prototype, not SQLite, WAL, a signed ledger or a substitute for a transactional production database. The rename boundary assumes a local filesystem with atomic replacement (Linux CI); no multi-process writers, host-power-loss durability, directory fsync, hostile filesystem or anti-rollback guarantee. Back up the checkpoint; do not delete it to recover from an unexplained error. No real customer data or public deployment.

Tests include reopen + idempotency, failed order/receipt/cancellation writes, corrupted and rehashed inconsistent stock, and a child process killed after acknowledgement followed by a new engine reading the checkpoint. Exact-head CI must pass before these tests are claimed as evidence.

## Optional SQLite backend (WAL + evidence outbox)

Linux prerequisites: Go, C compiler, pkg-config, libsqlite3-dev. SQLite is public-domain software; no paid service and no external Go module is required. Default builds and Docker remain JSON-checkpoint based. To use a NEW explicitly selected demo database:

```sh
cd services/api
CGO_ENABLED=1 RETAIL_BACKEND=sqlite RETAIL_STORE=data/retail.db go run -tags sqlite .
```

Do not switch an existing store silently: there is no JSON migration yet. Use separate paths and backups. An existing empty, corrupt or inconsistent SQLite database fails startup. SQLite WAL mode and synchronous FULL are required/configured. SQLite stores the complete checksummed state as one blob; each newly accepted evidence event is inserted into a separate append-only-by-application outbox table in the same transaction. The update compares the previous digest to reject stale writers; a failed transaction rolls back and latches the engine unavailable until reopened. The operating model remains one process per store; stale readers in other processes are not prevented.

The outbox currently retains all events as pending; there is no worker, delivery acknowledgement, external payment confirmation or runtime LiminalDB adapter. On reopen, order/inventory/slot constraints and the entire outbox are reconciled with the state. Read-only evidence endpoint reports storage=sqlite-wal but does not claim external durability. Tests exercise reopen, idempotency, an injected trigger that aborts an outbox insert, stale writer, missing evidence and process kill after acknowledgement. No new production or host-power-loss guarantees are established.

Run `CGO_ENABLED=1 go test -race -tags sqlite ./...` locally or see Check BiteOS CI. The optional build uses the locally packaged SQLite library (see distribution security updates / license notice); Windows/other packaging and relational table normalization are future work. No user data or public deployment.

## Verification

Existing CI runs Go tests, race detector, React build, and restaurant/kiosk tests. New retail Go tests cover stock reservation, duplicate requests, conflict, cancellation, invalid transitions, failed basket, concurrent purchase of last stock, slot capacity/cancellation, invalid delivery parameters and idempotent procurement receipts. Before merging, require full CI and browser smoke at 360px and desktop, three languages, pickup/delivery, cancellation, and no regression of #kiosk and default restaurant routes.

## Next phases

1. SQLite durable transactions and outbox for a pinned LiminalDB evidence adapter; tenant/store identity, inventory and idempotency receipts, authenticated roles. PostgreSQL only when concurrency or deployment requirements justify migration. See [Zero License Cost](zero-license-cost.md).
2. Packaged and weighted SKU pricing, stock adjustment ledger, expiration tracking, substitutions with explicit consent, order snapshots, refunds.
3. Delivery zones/slots, dispatch and courier assignment, permitted real-time tracking, clear ETA, delivery economics.
4. Repeat purchases, favorites, consent-based loyalty, demand requests and merchant analytics for contribution margin, stockouts, spoilage and retention.
5. SEO storefront and licensed product photos; verified catalog and explicit owner permission before pilot.

Go owns transactions and prices. Keep Rust suggestions isolated and optional; no Rust changes required for retail. React/TypeScript/Vite remains the shared UI. No live brand affiliation is claimed.
