# Living Memory → Roby's Sounds advice

Stacked on BiteOS #4. Reuses robysMemory, productPreferences and
soundsAdvice; no new storage key, journal, ranker or paid dependency.

For a future explicit "Use my remembered preferences" action, pass the
same strict one-shot Sounds request with the selected favorite and
avoid product IDs, plus a trusted local storage reader and current clock.
The local journal is read only when the request opts in and selects at
least one product preference. The selected IDs must still match the
latest validated preference for that product. Missing, expired,
malformed, reversed or inaccessible memory rejects instead of guessing.
Nothing is written, transmitted or automatically selected. Opt-out and
empty selections do not read the journal.

The existing memory limits remain 32 records and 30 days. This adapter
does not transfer layout choices, timestamps, sequence numbers, media
metadata, browsing history or purchase data. Current appearance and
memory remain separate. No verified availability, marketing permission,
account linkage, payment history, cross-device identity or live rollout.
The output is advisory only; the ordinary menu remains available.

Four test cases are added to the kiosk suite. Full CI and browser
wiring are pending. A future UI must make selection, withdrawal and
stale-state recovery explicit and read the existing key only on action.
