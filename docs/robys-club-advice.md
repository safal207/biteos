# Roby's Club advice boundary v0.1

Draft stacked on BiteOS #2. Complements Robys #502 and uses the existing
context ranker, Living Brand Agent and pinned catalog instead of another
personalization engine. No public UI or production integration yet.

The one-shot input schema `robys.club-advice.v1` requires the pinned catalog
revision, explicit usePreferences boolean, bounded selected favorite/avoid
IDs, unavailable scenario IDs, local scenario day/hour, manual weather,
explicit visit intent and optional budget in TRY minor units. Any unknown
field, stale revision, invalid product or conflicting preferences rejects.
The UI must let guests explicitly select which favorites to use for a single
request. Never silently transfer browsing history, all stored likes, taste
marks, email, session IDs or paid receipts. There is no storage or transport
in the adapter. No input is marketing consent.

The existing engine filters unavailable and avoided items, respects budget,
blocked scenarios, and catalog price; zero eligible signal abstains.
No explicit preferences means abstain from this personal advice, with normal
menu and Smart Choice unchanged. A contextual suggestion can differ from a
selected favorite. Stock and opening hours are not independently verified.
No cross-device identity, real rewards, live stock, price changes, messages
or claims of revenue/conversion impact.

Verification: four tests registered in kiosk test suite. Before real use:
wire only to explicit guest action in a local rehearsal, verify actual
Robys #502 source IDs, language, catalog revision mismatch and browser UX,
and decide owner-approved privacy boundaries. This is a source adapter, not
a deployed cross-repository UI bridge.
