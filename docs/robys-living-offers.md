# Roby's Living Offers — owner-side financial review v0.1

Stacked on BiteOS #5. Offline rehearsal. Reuses current explicit memory
advice, pinned menu catalog, ingredient plan and financial review.
No new ranking engine, price activation, customer UI or paid dependency.

Flow: guest-selected current preference → eligible advice → same-day
operator-declared recipe and costs → portfolio margin and reserve checks
→ candidate for owner review, or hold. No fallback to a more expensive
product. No stock verification, real POS, tax verification or marketing
approval. The review function is for a private operator-side prototype;
never expose ingredient costs or campaign review to guest code or Pages.
Do not transport the local guest journal across a network.

Amounts use integer TRY minor units. Threshold, whole percentage discount,
campaign cost and spend cap are explicit scenario inputs, not real Roby's
policy. Missing/invalid inputs fail closed. Checks current Istanbul day,
catalog revision, candidate planned units, declared released lots and
reserves for the full plan plus one extra candidate portion. This is not
a reservation, physical inventory, safe food release or capacity guarantee.

The existing financial model evaluates the same discount across the
declared portfolio; margin gates remain conservative. Matching units
estimate candidate volume to match its baseline contribution while
bearing the entire declared campaign cost; not actual volume or profit.
No forecast, attribution or revenue increase claim. Scenario prices are
not live menu prices. No customer-specific pricing, auto discounts,
messages, rewards or external effects.

Three tests use synthetic inputs only. Exact-head CI and owner-reviewed
sources are pending. Robys #505 remains independently blocked on
menu-switch-feed timing (1217.7 ms and 999.6 ms vs 999 ms on head
3d1f251ebf362009273b0c0c437f4076171b48de). Do not lower the shared
performance gate or interpret this financial draft as release approval.
