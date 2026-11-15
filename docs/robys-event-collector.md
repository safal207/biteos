# Robys Event Collector v0.1 — operator-mediated local pilot

Robys draft PR #501 exports exact real-feed client event snapshots after a per-tab opt-in. BiteOS imports those snapshots into a dedicated SQLite file; there is no HTTP listener, background collection, public deployment, customer identity or POS linkage.

Run from a trusted private BiteOS checkout with Node 24; keep the SQLite file and exports outside repositories and shared folders:

```sh
node scripts/robys-event-collector.mjs init /private/robys-events.sqlite
node scripts/robys-event-collector.mjs import /private/robys-events.sqlite /private/robys-pilot-events.json
node scripts/robys-event-collector.mjs report /private/robys-events.sqlite 2026-11-14 2026-11-15 > /private/robys-growth.json
node scripts/robys-event-collector.mjs prune /private/robys-events.sqlite
```

Upload only the aggregate growth JSON to the local Growth Dashboard preview (no network upload). Report dates are Istanbul UTC+03:00, end exclusive, 1–31 days; the cohort is based on session start (opt-in time in current pilot), with only observations before close and report time counted. Client event timestamps and payloads are not independent evidence. The aggregate includes reporting window, retention and pinned catalog provenance, but the existing dashboard does not display all those fields yet. Counts are sessions, not people. Share completion does not prove receipt. No purchases, revenue or causal impact inferred.

Exact full-prefix replays are idempotent; a longer compatible prefix adds only new sequences; conflicting retries fail atomically. The validator rejects unknown products, extra fields, gaps, old/future events, and oversized input. Maximum 10000 input events and 100000 retained events. Raw client events contain pseudonymous per-tab session identifiers and must not be published. Reports omit IDs. 30-day retention is a proposed pilot default; report/import enforce the horizon, but physical logical removal requires running prune regularly. Secure deletion cannot guarantee erasure from backups, filesystem snapshots or previously exported files. Keep directory private; local OS access is the authorization boundary. Stop/erase in the browser cannot retract a file already exported/imported; production consent and deletion workflow must be designed before activation. No new dependencies or paid services. Tests use synthetic sessions and real catalog IDs; deployed Robys data not used.

## Strict closed-window pilot handoff
Use `node scripts/robys-pilot-handoff.mjs report /private/robys-events.sqlite START END` for review reports; unlike the lower-level historical collector reader, this rejects open/future periods and any window that would be silently truncated by the 30-day horizon. Does not establish completeness, actual guest arrivals, event coverage, or consent history. Archive approved aggregate reports before expiry; don't accumulate raw exports. See production readiness runbook.
