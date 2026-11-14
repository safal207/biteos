# BiteOS Zero License Cost — architecture decision

Status: accepted engineering direction, not a completed legal audit.

## Rules

- No mandatory paid software subscriptions, proprietary APIs, hosted freemium quotas or per-order software royalties in the base installation.
- Prefer self-hostable, commercially usable MIT, BSD, Apache-2.0, PostgreSQL License or public-domain components. Retain notices; review trademarks, datasets, fonts, images and bundled code separately.
- GPL, AGPL, LGPL, MPL, source-available, custom, unknown and composite SPDX expressions require explicit review of obligations for the intended use/distribution. Free of charge does not mean unrestricted.
- New dependencies require recording exact version, upstream license, transitive dependencies, replacement path, deployment cost and known usage restrictions. No automatic approval from manifest claims.
- Use local demo data, not real merchant or customer data; obtain rights before commercial use of third-party brand assets. See NOTICE.md.
- Do not use GitHub Pages for live commerce. Real infrastructure, payment commissions, messaging, domains, backups and courier work may cost money. No promise of zero total operating cost.

## Approved directions (candidates, not installed or license-audited)

| Function | Default | Escalation only if necessary |
| --- | --- | --- |
| Business transactions | Go database/sql and SQLite | PostgreSQL |
| SQLite binding | optional narrow CGO binding to system libsqlite3 (public domain; distro packaging review required) | pure-Go driver after compatibility/dependency review |
| Evidence/continuity | LiminalDB (Apache-2.0), pinned sidecar | independent validation |
| Search | SQLite FTS5 / SQL | PostgreSQL FTS |
| Analytics | SQL views | DuckDB |
| Product associations | SQL relations | Apache AGE |
| Cache | in-process | Valkey |
| Map UI | MapLibre GL JS | none by default |
| Routing | self-hosted OSRM + OSM dataset | optional optimizer |
| Recommendations | existing Rust rules | no paid LLM required |
| Observability | Go logs | OpenTelemetry / Prometheus |
| Deployment | local Linux, Podman or Docker Engine | operator-provided host |

Official references: https://github.com/modernc-org/sqlite ; https://github.com/safal207/LiminalDB ; https://www.sqlite.org/copyright.html ; https://operations.osmfoundation.org/policies/tiles/ ; https://www.openstreetmap.org/copyright ; https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits

OSM attribution and ODbL obligations apply; public tile/geocoding/routing endpoints are not an unlimited free commercial service. Self-hosting introduces infrastructure costs.

## Evidence integration contract

SQLite remains authoritative for order, inventory and capacity transactions. In the same database transaction append an outbox event with stable event_id, action_id, aggregate version and payload digest. A retrying worker sends minimal, non-PII evidence into a pinned LiminalDB adapter. Mark outbox delivery only after independently defined durable acknowledgement; keep uncertainty explicit. No claim of atomic two-database commit or exactly-once external effect. LiminalDB outage must not erase committed orders; payment/dispatch with uncertain readback must not be retried blindly.

Implementation gate: crash/restart, duplicate delivery, unavailable readback, tampered evidence and replay equivalence. No direct payment authority delegated to a pre-1.0 sidecar.

## Dependency reporting

Run `node scripts/dependency-review.mjs` after frozen pnpm installation and with Cargo/Go available. It reports installed pnpm package manifests, Cargo resolved package metadata, and Go module identities (licenses require additional review). This is an inventory and triage aid, not a full SBOM, vulnerability scan, SPDX solver or approval gate. Review missing metadata, nested/bundled code, platform-specific dependencies, assets and container images before release.
