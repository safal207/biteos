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

The outbox retains all events; there is no online worker or persisted delivery watermark. The optional offline import command below verifies a native WAL storage receipt. It cannot confirm external payments or dispatch. On reopen, order/inventory/slot constraints and the entire outbox are reconciled with the state. Read-only evidence endpoint reports storage=sqlite-wal but does not claim external durability. Tests exercise reopen, idempotency, an injected trigger that aborts an outbox insert, stale writer, missing evidence and process kill after acknowledgement. No new production or host-power-loss guarantees are established.

Run `CGO_ENABLED=1 go test -race -tags sqlite ./...` locally or see Check BiteOS CI. The optional build uses the locally packaged SQLite library (see distribution security updates / license notice); Windows/other packaging and relational table normalization are future work. No user data or public deployment.

## BITEOS-LIMINALDB-002 — offline native WAL bridge

Build the importer from the pinned LiminalDB checkout (commit 61b02fc81e0cb5cf1f1ed4658ecff58f683cb728). Place integrations/liminaldb/biteos_import.rs in the checkout's liminal-db/crates/liminal-store/examples/ and run cargo build --locked -p liminal-store --example biteos_import. Then stop the BiteOS server and use the SQLite-enabled Go binary:

```sh
RETAIL_BACKEND=sqlite \
RETAIL_STORE=/absolute/path/retail.db \
RETAIL_EVIDENCE_STREAM=store-demo-1 \
LIMINALDB_IMPORTER=/absolute/path/target/debug/examples/biteos_import \
LIMINALDB_EVIDENCE_ROOT=/absolute/path/liminal-evidence \
./biteos-api evidence-sync
```

Use a stable, operator-assigned stream name unique to the source database, a trusted pinned executable and a dedicated destination. Do not run multiple live source writers or share the native ledger directory with other profiles. The command imports the full validated source prefix from the existing SQLite store, through stdin, with no external network service. The importer validates event identity, sequence, canonical digest and hash links, opens LiminalDB's native Store (writer lock and synchronized append), checks the entire stored prefix, appends only the missing suffix, and returns the count/head digest and inserted/replayed counts. The Go command checks these values before reporting success. A conflicting or truncated source prefix fails closed. Partial append followed by retry is supported by prefix reconciliation; process-kill evidence for the bridge itself is not yet established.

No event deletion or delivery watermark; every invocation rereads the full bounded history. Receipt verification trusts the operator-selected executable; this is not a signed receipt, not a cross-database atomic commit, not a distributed exactly-once guarantee and not a proof of payment or delivery. The importer uses a dedicated native WAL profile for internal claims, not TrustworthyTransitionLedger authorization records. The separate BITEOS-LIMINALDB-001 fixture demonstrates the conservative continuity mapping. No automatic external-effect authority, no live API integration, no new paid dependency.

CI builds the native executable, tests corrupted/conflicting/truncated batches and actual SQLite-to-WAL replay twice, comparing the receipt. Claims about successful execution require the exact-head CI result.

## BiteOS Finance v0.1 — read-only demo

- GET /api/retail/finance returns a deterministic full-history projection of the local demo engine, with integer TRY minor-unit arithmetic.
- Opening stock uses fixed illustrative unit costs. Subsequent purchase lots use recorded receiving costs. FIFO allocation occurs at reservation; cancellation restores the original lots; later purchases at different costs do not rewrite prior allocations.
- Only delivered/collected orders contribute product revenue and COGS. Gross profit = revenue - COGS; estimated contribution = gross profit + delivery fees - sample courier cost (center 45 TRY, outer 80 TRY). Open and cancelled orders are reported separately.
- Available and reserved inventory value are distinct; margins use product revenue as denominator. Inconsistent order totals, allocations or inventory fail the finance projection closed.
- `#retail-finance` is a separate tr/ru/en manager demonstration. GitHub Pages shows a fixed illustrative subset, not live store figures or the customer's in-tab basket. The local Go UI reads the finance endpoint. This route is not authentication: the local demo must not be exposed publicly.
- No tax calculation, actual payments, refund recognition, shrinkage, overhead, accounting/financial reporting, actual courier invoices, campaign attribution or period filters. Do not label contribution as net profit. No DuckDB or new dependencies are required for this bounded report.
- Tests cover exclusion of open/cancelled orders, repeated completion, FIFO allocation after price changes and cancellation, delivery contribution and inconsistent totals. Exact-head CI and browser verification remain required.

## BiteOS Growth v0.1 — promotion scenario planning

- GET /api/retail/growth returns products, current available stock, maximum available lot unit cost reconstructed from Finance FIFO, and unordered item pairs observed together in at least two fulfilled orders. Counts are descriptive; they do not measure causal lift, conversion or repeat-customer retention. No customer identities are stored.
- POST /api/retail/growth accepts productId, discountBps, minMarginBps, baselineUnits, expectedUnits and campaignCost (TRY minor units). It computes rounded-down sale price, minimum price rounded up to preserve a requested gross margin, maximum discount at that floor, normal and proposed profit, incremental contribution after campaign expense, required units and a decision classification. No order, inventory, campaign, price or evidence state is changed.
- Cost uses the highest currently available lot cost, a conservative scenario assumption for both baseline and promotion. Opening costs remain illustrative. Expected volume is user input, not a prediction. Stock is a point-in-time bound, not a reservation. No approval/execution authority is implied by SCENARIO_VIABLE; actual promotions need fresh checkout-time validation, authorization, attribution and financial review.
- `#retail-growth` is a TR/RU/EN planner linked from Finance. In Pages mode it uses a fixed local sample; in local mode it calls Go. Neither route is authenticated. Never expose the demo API publicly.
- Tests cover margin/stock blocks, unreachable break-even, volume review, high-cost purchase lots, invalid parameters and fulfilled co-purchases. No extra software license or hosted service.

## ROZAL LIFE / BiteOS Club v0.1

- Four deterministic shopping goals (family breakfast, school essentials, dinner, weekly essentials) reference only existing demo SKUs. The suggestions are shopping templates, not nutritional guidance or guarantees of sufficient food for a household.
- Anonymous browser-local saved cart and last fulfilled order list, with SKU IDs, quantities and previous unit prices only. No account, personal identifiers, remote sync, analytics tracking or rewards. Separate storage keys for static and local modes. Users can delete both lists. Do not use a shared browser for sensitive purchase history.
- Reorder draft shows the catalog currently loaded in the UI, highlights changed prices, blocks unavailable/insufficient quantities and optional product-budget overruns, lets the user edit or explicitly remove each line, and replaces the existing cart only through an explicit action. Shipping is excluded from the draft budget. No order is created from preview. The Go checkout remains authoritative for stock and price; a price-lock/quote confirmation for changes after preview is still needed.
- The last order is saved only after collected/delivered is returned by the local server or simulated in static mode, not on reservation/cancellation. Active orders are not recoverable through this browser list feature. If localStorage is denied, writes warn and lists may exist only for the current session.
- TR/RU/EN responsive UI uses existing React, TypeScript, and CSS. No extra dependency. Frontend-only templates and anonymous lists are deliberate for this stage; shared Go rules and SQLite member/loyalty ledgers need auth, consent, refund/expiry rules and server-side idempotency first.
- Node tests cover budget boundary, missing stock, changed prices and corrupt local data. Require exact-head CI and browser smoke before release. For the underlying prioritization see [world benchmark](club-world-benchmark-2026.md).

## BiteOS Demand v0.1 — request-to-procurement loop

Customer chooses a fixed illustrative candidate (kefir, tvorog, sour cream, rye bread) and desired quantity 1–10, then explicitly submits an interest signal. No assertion about actual Rozal assortment, no free text, name, phone, location, payment, preorder, reservation or arrival promise. GET /api/retail/demand returns cumulative request and quantity counts; neither unique customers nor conversion rates are known. POST accepts an idempotency key; only its hash is persisted. Reuse with the same body returns existing signal; changed content conflicts. Capacity 1000 signals; abuse prevention, retention/deletion policy and auth are prerequisites to real collection.

The optional demandSignals field is part of existing checksummed checkpoint/SQLite state, writes under the same engine lock and transaction; old state without it remains valid. Interest is not a commerce effect and is intentionally excluded from the LiminalDB order/receipt evidence profile. No demand-derived inventory mutation or automatic buying.

Owner POST /api/retail/demand/plan takes candidate ID, batch size, unit purchase cost, sale price, expected sold quantity, extra fixed batch cost and gross margin floor; all money uses TRY minor units. Investment = batch * unit cost + fixed cost; contribution = sold * sale price - investment (zero recovery value on unsold stock); break-even = ceil(investment/sale price). Margin floor checked by integer cross multiplication. Decisions are review labels, not procurement authorization; positive interest does not predict sell-through. Unsold cost is already included in investment, not subtracted twice. Excludes taxes, overhead, actual supplier terms and returns.

TR/RU/EN separate demo screens: #retail-demand and #retail-demand-business (linked from Finance). Static mode is screen-local, resets on navigation and does not send or share requests; local mode reads actual demo signals. In-page retry retains the same request key and payload; reload may lose that key. Shopper link appears only when cart is empty and no active order. Neither route is authenticated. Do not publicly expose the local API.

Causal hypothesis: unmet need -> explicit nonbinding request -> aggregated candidate counts -> owner evaluates supplier quote and downside -> small authorized purchase -> observed sell-through -> future assortment review. Real decision loop still needs authenticated procurement, expiry and supplier tracking, traceable sell-through, time windows and lawful opt-in alerts. No new external dependencies.

Tests cover validation, replay/conflict, checkpoint and SQLite reopen, signal isolation and scenario boundaries. Require exact-head CI and browser regression.

## Verification

Existing CI runs Go tests, race detector, React build, and restaurant/kiosk tests. New retail Go tests cover stock reservation, duplicate requests, conflict, cancellation, invalid transitions, failed basket, concurrent purchase of last stock, slot capacity/cancellation, invalid delivery parameters and idempotent procurement receipts. Before merging, require full CI and browser smoke at 360px and desktop, three languages, pickup/delivery, cancellation, and no regression of #kiosk and default restaurant routes.

## Next phases

1. SQLite durable transactions and outbox for a pinned LiminalDB evidence adapter; tenant/store identity, inventory and idempotency receipts, authenticated roles. PostgreSQL only when concurrency or deployment requirements justify migration. See [Zero License Cost](zero-license-cost.md).
2. Packaged and weighted SKU pricing, stock adjustment ledger, expiration tracking, substitutions with explicit consent, order snapshots, refunds.
3. Delivery zones/slots, dispatch and courier assignment, permitted real-time tracking, clear ETA, delivery economics.
4. Repeat purchases, favorites, consent-based loyalty, demand requests and merchant analytics for contribution margin, stockouts, spoilage and retention.
5. SEO storefront and licensed product photos; verified catalog and explicit owner permission before pilot.

Go owns transactions and prices. Keep Rust suggestions isolated and optional; no Rust changes required for retail. React/TypeScript/Vite remains the shared UI. No live brand affiliation is claimed.
