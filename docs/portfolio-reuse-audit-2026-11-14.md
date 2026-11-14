# BiteOS portfolio reuse audit — 2026-11-14

Scope: account-wide first-pass review of 158 unique repository search results (two GitHub search pages). Primary basis: accessible root README content, selected protocol specifications, actual current BiteOS source and CI. README claims are not freshly reproduced tests or a license audit. Thin/404 README entries are explicitly limited; no claim of full code/security review. No repository other than BiteOS is changed. Forks/third-party references are not claimed as owned implementations. This is a selection register, not an integration certification.

## Architecture decision: use one operational authority, narrow evidence contracts

Keep Go and tenant-bound SQLite for orders, stock and finances. Continue the existing pinned LiminalDB adapter for independently inspectable evidence (pre-1.0 research; no production certification). Do not add TTM, CML, LTP or another database as parallel order authorities. Compare exact source/specs and licenses before copying or depending on code; use adapters and reproducible negative fixtures. No new external package is added by this review.

| Boundary | Selected reference | Next acceptance condition |
|---|---|---|
| Authority | ProofPath / CaPU / Causal-Cell / Liminal Rail Metro | exact tenant/action/version, explicit allow/hold/block; fresh approval; no duplicate side effect |
| Causal lineage | CML | missing parent, wrong tenant, revoked approval must fail even if HTTP succeeded |
| Decision history | DRP / DMP | immutable decision and supersession; outcome/reversibility separately observed |
| Replay and capture | LTP / T-Trace | no orphan request, response, silent gap; unknown is not success; portable fixture |
| Durable history | LiminalDB / TTM design boundary | tenant stream binding, reopened outbox receipt, no false assertion of external effect |
| QA | ContractGraph-QA / LS / ProofTask | exact-head reproducibility; ZERO/ONE/UNKNOWN; browser and human evidence; no PASS on NOT_RUN |
| Merchant UX | Roby's / Riva Bella / Sefa / Miora / ChekLab | source catalog approved; price/option integrity; no invented menu or checkout; preserve asset rights |
| Growth | SearchProof / TMI / DIF / self-creation protocol | opt-in, holdout/baseline, measured outcomes not automatic causality |

Key inspected source artifacts (GitHub content blob hashes, not commit IDs):
- [LTP ecosystem spider map](https://github.com/safal207/L-THREAD-Liminal-Thread-Secure-Protocol-LTP-/blob/main/docs/ECOSYSTEM_SPIDER_MAP.md) — `4c35ce55fb7ed014e41b2e0ca96922ca985521f9`.
- [CML START_HERE](https://github.com/safal207/Causal-Memory-Layer/blob/main/docs/START_HERE.md) — `6a9f1078aa4d304f2d2f73381cf4c8b9617a81d8`.
- [DMP decision record spec](https://github.com/safal207/DMP-decision-memory-protocol/blob/main/spec/decision-record.md) — `31a37b6550084ee192692ee8abdc406cd14da559`.
- [T-Trace v0.1 spec](https://github.com/safal207/T-Trace/blob/main/spec/t-trace.md) — `d32a4584f594bc5a909d97bef485885bbc2f3091`.
- [CaPU readiness](https://github.com/safal207/CaPU/blob/main/PROJECT_STATUS.json) — `0c6a9af50fef448e44eca0a7188a4c79819184c1` (historical, not rerun).
- [ProofPath ecosystem graph](https://github.com/safal207/ProofPath/blob/main/docs/ECOSYSTEM_GRAPH.md) — `5b0f833009b98f560484187923e65aa8e0823cdb`.
- [LiminalDB README](https://github.com/safal207/LiminalDB/blob/main/README.md) — `6317cd453c04b468a9739fcc593992b41d1dc3cc`.
- [ContractGraph-QA README](https://github.com/safal207/ContractGraph-QA/blob/main/README.md) — `56ac5dce00a90607feae6b0ac0331cee23b327b3`.
- [Roby's README](https://github.com/safal207/robys-coffee-house-demo/blob/main/README.md) — `06ce0397a08fb1160a55899fd49ded005e2586a8`.
- [Riva Bella Revenue README](https://github.com/safal207/riva-bella-revenue/blob/main/README.md) — `810dd7ac5d591d07656fd5871708011e20d0b250`.

## Delivery sequence

1. Recipe & Cost Engine: deterministic explicit component quantities, unit costs, source digest and validation; no invented costs and no stock mutation. This is a BiteOS-native graph inspired by trace/projection and decision boundaries; no claim of CML/DRP conformance.
2. Confirm exact-head CI; real browser regression across restaurant, market and labs; close checkout and staff auth gaps before new write paths.
3. Tenant-scoped evidence exporter and minimum action envelope based on existing ProofPath/Liminal Rail/CaPU contracts. One narrow authorized operation, independent outcome readback, unknown stops retry.
4. Owner-approved merchant catalog import and recipe/cost verification; no wholesale replacement of existing projects.
5. Controlled pilot with manual approval, confirmed prices, measured sell-through and support workflow; no automatic execution/payments before negative-case verification.

## Per-repository decisions

### Integrate via narrow contracts (P0)

- [biteos](https://github.com/safal207/biteos) — Go commerce authority; keep existing SQLite transactions and compatibility, close gaps instead of duplicating runtimes.
- [LiminalDB](https://github.com/safal207/LiminalDB) — Existing pinned evidence bridge; extend only with tenant-bound streams and independently verified receipts, never order authority.
- [Causal-Memory-Layer](https://github.com/safal207/Causal-Memory-Layer) — Validate permission/intent/responsibility ancestry, not just successful HTTP; retain distinct CML adapter and test vectors.
- [CaPU](https://github.com/safal207/CaPU) — Admission versus observed effect; unknown outcome is not permission to retry. Use main reference first; recovery PRs 103/104 are separate drafts.
- [ProofPath](https://github.com/safal207/ProofPath) — Exact-action pre-execution gateway: scope, budget, nonce, approval and hold/block; use a small conformance adapter.
- [T-Trace](https://github.com/safal207/T-Trace) — Portable sense/transition/commit JSONL; export exact domain events and validate, not a second operational store.
- [L-THREAD-Liminal-Thread-Secure-Protocol-LTP-](https://github.com/safal207/L-THREAD-Liminal-Thread-Secure-Protocol-LTP-) — Replay, continuity and no orphan request/response; integrate by profile, not full SDK stack.
- [DRP](https://github.com/safal207/DRP) — Immutable linked records and supersession; design versioned decision graph.
- [DMP-decision-memory-protocol](https://github.com/safal207/DMP-decision-memory-protocol) — Context/rationale/reversibility/outcome separated; complement DRP governance records, do not duplicate.
- [ttm-db](https://github.com/safal207/ttm-db) — Trace versus projection boundary; reuse model, not a second database runtime.
- [ContractGraph-QA](https://github.com/safal207/ContractGraph-QA) — Payment/recovery negative fixtures: ZERO / ONE / UNKNOWN before retry, eventual payment adapter only.
- [LS](https://github.com/safal207/LS) — Exact-head PR risk scorecard; maintain evidence/NOT_RUN distinction.
- [Liminal-Rail-Metro](https://github.com/safal207/Liminal-Rail-Metro) — Existing Go action routing with bounded receipts and duplicate/tamper tests; first implementation candidate for trusted action adapter.
- [Causal-Cell](https://github.com/safal207/Causal-Cell) — Small provider-neutral pre-execution/observation unit; compare envelope with ProofPath before selecting one.
- [robys-coffee-house-demo](https://github.com/safal207/robys-coffee-house-demo) — Structured multilingual menu, choice-to-counter browser tests, pairings and decision traces; extract normalized contracts after consent.
- [riva-bella-revenue](https://github.com/safal207/riva-bella-revenue) — Transparent cart, compatibility cross-sell, revenue model; keep draft migration gate for original 176 items.
- [sefa-beach](https://github.com/safal207/sefa-beach) — 123-item menu, CSV sales/cost templates; validate merchant prices and use data-import pattern.
- [miora-coffee](https://github.com/safal207/miora-coffee) — 93-item source menu, unpriced items blocked, local order-list UX; preserve source and asset rights.
- [cheklab](https://github.com/safal207/cheklab) — Server-side product/order and optional add-on pilot; use funnel and server-state tests, not copy private service or payment claims.

### Reference next (P1)

- [ATMAN-LATTICE](https://github.com/safal207/ATMAN-LATTICE) — Historical validation is not current authority; revalidation and forward remediation, research only.
- [DI](https://github.com/safal207/DI) — Doability boundaries and ambiguous financial recovery; before promising procurement or delivery.
- [pythiaLabs](https://github.com/safal207/pythiaLabs) — Pre-execution gate role from LTP/ProofPath ecosystem maps; compare to ProofPath rather than add duplicate runtime.
- [guardian-layer](https://github.com/safal207/guardian-layer) — Explainable reversible care-cases from policy; model risk-review workflow.
- [ProofTask](https://github.com/safal207/ProofTask) — Human verification and proof submission; merchant acceptance and physical lot checks.
- [safal207-AgentProof-AI](https://github.com/safal207/safal207-AgentProof-AI) — Fresh authorization, action drift, false success and duplicate execution fixtures.
- [reality-layer-atomic-claim-fix](https://github.com/safal207/reality-layer-atomic-claim-fix) — Committed reserve-if-absent instead of check-then-act; payment/dispatch race regression reference.
- [temporal-market-intelligence](https://github.com/safal207/temporal-market-intelligence) — Falsifiable expectation before observation; adapt methodology to promotion impact, not market price inference.
- [SearchProof-SEO-Evidence](https://github.com/safal207/SearchProof-SEO-Evidence) — URL → evidence → change → metric → verification; SEO/experiment reporting with no causal overclaim.
- [DIF](https://github.com/safal207/DIF) — Human-correctable intent before action; useful for shopping-assistant and owner requests.
- [transition-intelligence-protocol](https://github.com/safal207/transition-intelligence-protocol) — State/tension/cause/transition/review loop; owner decision lifecycle.
- [Scale-Descent-Protocol-SDP](https://github.com/safal207/Scale-Descent-Protocol-SDP) — Decompose goals into causal micro-transitions before execution, methodology only.
- [Access-Orientation-Protocol](https://github.com/safal207/Access-Orientation-Protocol) — Calibrate and validate external action, not internal completion; design reference.
- [self-creation-protocol](https://github.com/safal207/self-creation-protocol) — Silence/refusal/non-action is not consent; opt-in marketing and order boundaries.
- [Living-Relational-Identity-LRI](https://github.com/safal207/Living-Relational-Identity-LRI) — Revisability and human authority; avoid optimizing identity into a static score.
- [Liminal-Presence-Interface-LPI](https://github.com/safal207/Liminal-Presence-Interface-LPI) — Structured intent, consent, trust and continuity; future assistant interaction envelope.
- [rinse](https://github.com/safal207/rinse) — Derived insights never overwrite traces; analytics/projection separation.
- [Causal-Verification-Processor](https://github.com/safal207/Causal-Verification-Processor) — Offline feedback controller with review modes; experiment calibration.
- [finanalytics-core](https://github.com/safal207/finanalytics-core) — Stress and recovery methodology; do not import trading metrics as retail KPIs.
- [smart-market-data-gateway](https://github.com/safal207/smart-market-data-gateway) — Bounded buffers, dedupe, subscriptions and rate limits for future operational WebSockets.
- [nexus-sales](https://github.com/safal207/nexus-sales) — Database and migration reference for CRM; no coupling until tenant identity established.
- [nexus-ecosystem](https://github.com/safal207/nexus-ecosystem) — Shared auth/database and CRM structure; reference only.
- [KuponGo](https://github.com/safal207/KuponGo) — Coupon discovery concept; explicit opt-in, anti-fraud and margin boundaries before gamification.
- [ai-cafe-network](https://github.com/safal207/ai-cafe-network) — Café pilot and AI-friendly community positioning; separate from checkout.
- [halk-bufe-selinus](https://github.com/safal207/halk-bufe-selinus) — Mobile multilingual menu, cart and QR summary; reuse UX and quality gate ideas.
- [fediverse-portability-test-kit](https://github.com/safal207/fediverse-portability-test-kit) — Export/import/restore/privacy checks; tenant backup and portability acceptance.
- [LiminalQAengineer](https://github.com/safal207/LiminalQAengineer) — Risk triage beyond red/green; exact evidence for release decisions.
- [ibex-agent-verification](https://github.com/safal207/ibex-agent-verification) — Manifest and checksum evidence, PASS/WARN/BLOCK boundaries; QA artifacts only.
- [valta-pilot-lab](https://github.com/safal207/valta-pilot-lab) — Value of loss reduction and recovery tests; business validation, not payment authority.
- [qa-fintech-api-python-course](https://github.com/safal207/qa-fintech-api-python-course) — Payment/balance/commission/idempotency exercises for regression.
- [safal207-android-reliability-lab](https://github.com/safal207/safal207-android-reliability-lab) — Network-loss/retry/reopen cases for mobile checkout.
- [game-systems-reliability-lab](https://github.com/safal207/game-systems-reliability-lab) — Server authority, economy integrity, retry and concurrency test patterns.
- [safal207-corrigibility-action-benchmark](https://github.com/safal207/safal207-corrigibility-action-benchmark) — Correction after work begins; stop stale plans and require fresh authority.
- [coupon-anomaly-autoencoder](https://github.com/safal207/coupon-anomaly-autoencoder) — Synthetic anomaly queue, not fraud verdict; defer ML until real authorized data.
- [resonance-arbitrage-graph](https://github.com/safal207/resonance-arbitrage-graph) — Fee/liquidity/freshness admission concepts; not trading implementation.
- [liminal-flights](https://github.com/safal207/liminal-flights) — Time-constrained graph/Pareto design for delivery; fictional model, licensing unresolved.
- [alex-financial-os](https://github.com/safal207/alex-financial-os) — Normalized ledger and transfer reconciliation reference; scaffold, no real bank access.
- [voice-to-evidence](https://github.com/safal207/voice-to-evidence) — Draft incident evidence from operator description; human confirmation required.
- [Codex-Adoption-Lab](https://github.com/safal207/Codex-Adoption-Lab) — Bounded task, inspectable artifact, human decision; merchant pilot workflow.
- [GardenLiminal](https://github.com/safal207/GardenLiminal) — Process isolation and event lifecycle; infrastructure reference, no replacement of container tooling.
- [DAO_lim](https://github.com/safal207/DAO_lim) — Metric-based routing; review only if actual scaling need.
- [LRE-Core](https://github.com/safal207/LRE-Core) — Experimental runtime event/action registry; no full runtime integration.
- [LiminalOSAI](https://github.com/safal207/LiminalOSAI) — Bounded actions and recovery receipts; compare protocol semantics, no C11 runtime dependency.
- [Liminal](https://github.com/safal207/Liminal) — Continuity model and developer ecosystem map.
- [Lifetra](https://github.com/safal207/Lifetra) — Causality/trajectory/orientation domain concepts for temporal graph; no new Rust framework.
- [web4-liminal](https://github.com/safal207/web4-liminal) — Care-stack architecture RFC; conceptual reference.
- [cybernetics-of-care](https://github.com/safal207/cybernetics-of-care) — Non-coercive identity/memory/agency principles; product design reference.
- [noosphere-city](https://github.com/safal207/noosphere-city) — Proposed local pilot; not approved merchant/municipality relationship.
- [test-it-python](https://github.com/safal207/test-it-python) — QA training and AI PATH pilot education; staff onboarding concept.
- [manual-qa-interview-lab](https://github.com/safal207/manual-qa-interview-lab) — Short case exercises and feedback; operator training pattern.
- [typescript-7-rc-qa-benchmark](https://github.com/safal207/typescript-7-rc-qa-benchmark) — Compiler version compatibility test approach; not an upgrade authorization.
- [typescript-go-qa-findings](https://github.com/safal207/typescript-go-qa-findings) — Reproducible TS regressions for toolchain evaluation.
- [rustclip-studio](https://github.com/safal207/rustclip-studio) — Content workflow and causal records; future marketing tools, not checkout dependency.
- [telegram-for-codex](https://github.com/safal207/telegram-for-codex) — Local inbox with explicit send approval; consent boundary reference only.
- [students](https://github.com/safal207/students) — Micro-lessons with checkable steps; staff training later.
- [zenit-alanya-site](https://github.com/safal207/zenit-alanya-site) — Trilingual design and explicit form handoff; UX reference, not sports data integration.
- [zenit-alanya-academy](https://github.com/safal207/zenit-alanya-academy) — Local media and reduced-motion fallback; asset provenance pattern.
- [football-card-components](https://github.com/safal207/football-card-components) — Reusable visual components; no sports assets copied.
- [quiet-hours-sanctuary](https://github.com/safal207/quiet-hours-sanctuary) — Progressive loading and optional WebGL; storefront performance reference.
- [layer-lab-explainer](https://github.com/safal207/layer-lab-explainer) — Isolated layers and visual export; inspiration for ingredient visualization.
- [room-control-studio](https://github.com/safal207/room-control-studio) — Configurable scenario UI; design reference only.
- [agent-arena](https://github.com/safal207/agent-arena) — Distinguish actual browser screenshots from promotional art; QA communication.
- [test_qorer_f](https://github.com/safal207/test_qorer_f) — API testing patterns; never transfer financial credentials or proprietary data.
- [RESONANCE](https://github.com/safal207/RESONANCE) — Evidence-first technical publication; public documentation channel, no runtime dependency.
- [argentum-core](https://github.com/safal207/argentum-core) — Post-execution signed trail reference; external ownership/license review before any reuse.
- [trace-spec](https://github.com/safal207/trace-spec) — Third-party hardware-attested governance spec; developer preview, avoid false silicon attestation.
- [SOMA-Self-Organizing-Modular-Architecture](https://github.com/safal207/SOMA-Self-Organizing-Modular-Architecture) — Modular signal interfaces and simulator; not production architecture requirement.
- [BardoCompute](https://github.com/safal207/BardoCompute) — Research transition-state model; no production performance claim.
- [COSMIC-ORGANICS](https://github.com/safal207/COSMIC-ORGANICS) — Sparse transition execution and separate proof; research only.
- [Kairos-Gate-for-X-Cell](https://github.com/safal207/Kairos-Gate-for-X-Cell) — Phase-conditioned research; conceptual timing only, no biological inference in commerce.
- [L-EDGE-Liminal-Edge-OS](https://github.com/safal207/L-EDGE-Liminal-Edge-OS) — Pre-MVP edge design; defer infrastructure until capacity evidence.
- [Proto-liminal](https://github.com/safal207/Proto-liminal) — Signal extraction and feedback prototype; avoid agent runtime duplication.
- [CareerOS](https://github.com/safal207/CareerOS) — Evidence-based workflow analogy, separate product.
- [NextRole](https://github.com/safal207/NextRole) — Human-controlled agent suggestions analogy, separate product.
- [orbity-obshcheniya](https://github.com/safal207/orbity-obshcheniya) — Local progress and optional practice; avoid importing private relationship data.
- [english-zero-to-fluent](https://github.com/safal207/english-zero-to-fluent) — Learning journey, potential onboarding analogy only.
- [english-zero-to-fluent-pages](https://github.com/safal207/english-zero-to-fluent-pages) — Static mobile practice with no paid API; separate product.
- [English-Liminal-](https://github.com/safal207/English-Liminal-) — Context-based micropractice, not commerce runtime.
- [lotus-private-relocation](https://github.com/safal207/lotus-private-relocation) — Consent-based partner introductions; separate domain.
- [noosphere-server](https://github.com/safal207/noosphere-server) — Thin server README; no implementation selection.
- [riva-bella-gazipasa-concept](https://github.com/safal207/riva-bella-gazipasa-concept) — Title-only README; use revenue lab instead until source audited.
- [mweb3waves](https://github.com/safal207/mweb3waves) — Only QAlabsLiminal title; no demonstrated reusable contract.

### Defer / separate domain / external reference (P2)

- [Liminal-2.0.-For-people](https://github.com/safal207/Liminal-2.0.-For-people) — Human morning/evening insights; separate app.
- [liminal-you](https://github.com/safal207/liminal-you) — Social/emotion/device-memory model; do not import personal profiling.
- [liminal-shelter](https://github.com/safal207/liminal-shelter) — Care research, not commerce dependency.
- [Neurolab](https://github.com/safal207/Neurolab) — Emotion-recognition research; no inferred emotional targeting.
- [agi-consciousness-safety](https://github.com/safal207/agi-consciousness-safety) — Consciousness research claims not needed for retail.
- [osoznanie-ai](https://github.com/safal207/osoznanie-ai) — Agent evolving identity and reflection; experimental.
- [Universe-E](https://github.com/safal207/Universe-E) — Energy protocol concept; no commercial need.
- [liminal-voice-core](https://github.com/safal207/liminal-voice-core) — Conversational research; no voice profiling for shoppers.
- [land_plf](https://github.com/safal207/land_plf) — Liminal landing/site; separate mission.
- [liminal-thread-book](https://github.com/safal207/liminal-thread-book) — Book signup workflow; separate.
- [Awakening](https://github.com/safal207/Awakening) — Voxel game; no direct integration.
- [Garder-2d](https://github.com/safal207/Garder-2d) — Game demo; no need for game runtime.
- [trashnet](https://github.com/safal207/trashnet) — External image classification research; not inventory evidence.
- [TrustLayer-Backend](https://github.com/safal207/TrustLayer-Backend) — Placeholder business directory/trust scores; not verified identity or proof.
- [StreamPay-Contracts](https://github.com/safal207/StreamPay-Contracts) — Continuous on-chain payment streaming; no current payment need.
- [Commitlabs-Contracts](https://github.com/safal207/Commitlabs-Contracts) — Commitment/custody smart contracts; out of pilot scope.
- [Stellar-Game-Studio](https://github.com/safal207/Stellar-Game-Studio) — External Web3 game starter; not necessary.
- [stellar-kraal-contract](https://github.com/safal207/stellar-kraal-contract) — Smart contract demo; no custody/crypto integration.
- [safal207](https://github.com/safal207/safal207) — Profile and portfolio index; not dependency.
- [safonov-interior-portfolio](https://github.com/safal207/safonov-interior-portfolio) — Separate design portfolio.
- [creative-portfolio](https://github.com/safal207/creative-portfolio) — Separate architectural visualization portfolio.
- [Architectural-AI-Lab](https://github.com/safal207/Architectural-AI-Lab) — Blender and 3D tours; separate design work.
- [vesper-automotive-concept](https://github.com/safal207/vesper-automotive-concept) — Automotive concept; separate presentation.
- [roblox-portfolio](https://github.com/safal207/roblox-portfolio) — Playable game portfolio; separate.
- [rusalka-cinema-skills](https://github.com/safal207/rusalka-cinema-skills) — Music video workflow; separate creative project.
- [CodeController](https://github.com/safal207/CodeController) — Gamepad coding controls; no commerce application.
- [robot_shutdown_resistance](https://github.com/safal207/robot_shutdown_resistance) — External safety experiment; reference only, not embedded.
- [AI-self-replication](https://github.com/safal207/AI-self-replication) — External security experiment; do not execute or integrate.
- [ctfish](https://github.com/safal207/ctfish) — External game-agent experiment; not retail.
- [GavanPublic](https://github.com/safal207/GavanPublic) — External Palisade OSS collection; no direct reuse.
- [intercode](https://github.com/safal207/intercode) — External security benchmark; no runtime.
- [llm-honeypot](https://github.com/safal207/llm-honeypot) — External security research; no execution in commerce.
- [hackingdemo](https://github.com/safal207/hackingdemo) — External offensive benchmark; no integration.
- [foxvox](https://github.com/safal207/foxvox) — Content manipulation research; unsuitable for customer decision system.
- [compass-experiments](https://github.com/safal207/compass-experiments) — External agent experiment framework; no need.
- [crawlee](https://github.com/safal207/crawlee) — External crawler; only authorized data import if required later.
- [codex](https://github.com/safal207/codex) — Upstream coding agent reference; not a product dependency.
- [software-agent-sdk](https://github.com/safal207/software-agent-sdk) — External agent SDK; avoid orchestration dependency until needed.
- [deepagents](https://github.com/safal207/deepagents) — External agent framework; no need for current deterministic core.
- [langgraph](https://github.com/safal207/langgraph) — External orchestration framework; defer.
- [crewAI-upstream](https://github.com/safal207/crewAI-upstream) — External multi-agent framework; defer.
- [crewAI](https://github.com/safal207/crewAI) — Title-only README; no new dependency.
- [pass-interview](https://github.com/safal207/pass-interview) — Interview agent demo; separate.
- [BusySync](https://github.com/safal207/BusySync) — Calendar privacy utility; separate.
- [linkedin-api-mcp](https://github.com/safal207/linkedin-api-mcp) — Third-party service integration; irrelevant to safe storefront.
- [IPO-Quality-Score](https://github.com/safal207/IPO-Quality-Score) — Title-only README; no established reuse.

### Unavailable README (no technical decision)

- [CAUSAL-DNA](https://github.com/safal207/CAUSAL-DNA) — README not accessible via connector; reopen source before evaluating.
- [proofbit](https://github.com/safal207/proofbit) — README not accessible; no reuse selected.
- [QALim](https://github.com/safal207/QALim) — README not accessible; no reuse selected.
- [TachTachAI](https://github.com/safal207/TachTachAI) — README not accessible; no reuse selected.
- [pocitel-coffee-gazipasa](https://github.com/safal207/pocitel-coffee-gazipasa) — README not accessible; source/menu not evaluated.
- [Vajra-Space-Evidence-Lab](https://github.com/safal207/Vajra-Space-Evidence-Lab) — README not accessible; no reuse selected.
- [terra_ai](https://github.com/safal207/terra_ai) — README not accessible; no reuse selected.
- [trashcoin](https://github.com/safal207/trashcoin) — README not accessible; no reuse selected.
- [cross-lingual-value-drift](https://github.com/safal207/cross-lingual-value-drift) — README not accessible; no reuse selected.
- [morphomatter](https://github.com/safal207/morphomatter) — README not accessible; no reuse selected.

### Metadata only / not individually assessed

- [oss-scanner](https://github.com/safal207/oss-scanner) — no supported selection yet; inspect source first.
