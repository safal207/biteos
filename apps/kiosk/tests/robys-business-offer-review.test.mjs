import {test} from "node:test";
import {decisionTrace} from "../src/robysDecisionTrace.ts";
import assert from "node:assert/strict";
import {businessOfferReview} from "../src/robysBusinessOfferReview.ts";
import {demoBusiness} from "../src/robysBusinessBrain.ts";
import {reviewOfferCandidate} from "../src/robysLivingOffers.ts";
import {robysCatalog} from "../src/robysPublicCatalog.ts";
const now=Date.parse("2026-11-14T12:00:00Z"),day="2026-11-14",revision=robysCatalog.sourceRevision,id="hot-coffee:flat-white";
const fixture=()=>({schema:"robys.business-offer-input.v1",productId:id,business:demoBusiness(revision),minMarginPct:20,maxCampaignMinor:10000});
test("review uses existing brain and same-bundle offer calculation without a guest journal",()=>{
 const raw=fixture(),r=businessOfferReview(raw,now),b=raw.business;
 const expected=reviewOfferCandidate(id,day,now,b.plan,b.costs,{minMarginPct:20,maxCampaignMinor:10000,discountPct:b.discountPct,campaignMinor:b.campaignMinor});
 assert.equal(r.state,"review-only");assert.deepEqual(r.candidate,expected.candidate);
 assert.equal(r.candidate.productId,id);assert.equal(r.candidate.catalogPriceMinor,robysCatalog.products.find(x=>x.id===id).priceMinor);
 for(const k of ["sourceIndependentlyVerified","rolloutAuthorized","priceChangeAuthorized","externalEffectsAuthorized","marketingAuthorized","guestMemoryRead","actualRevenueVerified","netProfitAvailable","causalEffectEstablished"])assert.equal(r[k],false,k);
});
test("existing business hold and missing data precede candidate review",()=>{
 const raw=fixture(),hold=businessOfferReview({...raw,business:demoBusiness(revision,"compound")},now);
 assert.equal(hold.state,"hold");assert.equal(hold.candidate,null);assert.equal(hold.tasks[0].code,"experiment-guardrail");
 const missing=businessOfferReview({...raw,business:demoBusiness(revision,"missing")},now);
 assert.equal(missing.state,"collect-evidence");assert.equal(missing.candidate,null);
 const invalid=businessOfferReview({...raw,business:{...raw.business,costs:{...raw.business.costs,products:[]}}},now);
 assert.equal(invalid.state,"collect-evidence");assert.equal(invalid.coverage.financial,"invalid");
});
test("campaign cap and missing product plan prevent review candidate; no data injection",()=>{
 const raw=fixture(),over=businessOfferReview({...raw,maxCampaignMinor:0,business:{...raw.business,campaignMinor:100}},now);
 assert.equal(over.state,"hold");assert.equal(over.reason,"campaign-budget-exceeded");
 const noPlan=businessOfferReview({...raw,productId:"hot-coffee:espresso"},now);
 assert.equal(noPlan.state,"hold");assert.equal(noPlan.reason,"missing-candidate-recipe-or-plan");
 for(const patch of [{guestId:"x"},{memory:[]},{productId:"fake:sku"},{minMarginPct:19},{business:{...raw.business,phone:"x"}},{business:{...raw.business,day:"2026-11-13"}}])assert.throws(()=>businessOfferReview({...raw,...patch},now));
});

test("decision trace is deterministic, scoped, and reuses owner review",()=>{
 const raw=fixture(), review=businessOfferReview(raw,now),trace=decisionTrace(raw,now);
 assert.deepEqual(trace,decisionTrace(structuredClone(raw),now));
 assert.equal(trace.tenantId,"robys");
 assert.equal(trace.catalogRevision,revision);
 assert.equal(trace.decisionTimeUtc,new Date(now).toISOString());
 assert.equal(trace.scenarioDay,day);
 assert.equal(trace.state,review.state);
 assert.deepEqual(trace.tasks,review.tasks);
 assert.deepEqual(trace.candidate,review.candidate);
 assert.equal(trace.graph.nodes.find(n=>n.id==="offer-gate").status,"review-only");
 assert.deepEqual(trace.graph.edges.at(-1),{from:"offer-gate",to:"disposition",relation:"disposition"});
 for(const k of ["sourceIndependentlyVerified","rolloutAuthorized","priceChangeAuthorized","externalEffectsAuthorized","marketingAuthorized","guestMemoryRead","actualRevenueVerified","netProfitAvailable","causalEffectEstablished","persisted"])assert.equal(trace[k],false,k);
 assert.equal(trace.claim,"declared-inputs-computation-only");
 for(const k of ["business","history","memory","guestId","plan","costs"])assert.equal(Object.hasOwn(trace,k),false,k);
});
test("trace records business gate short circuit, including missing evidence",()=>{
 for(const [scenario,state] of [["compound","hold"],["missing","collect-evidence"]]){
  const trace=decisionTrace({...fixture(),business:demoBusiness(revision,scenario)},now);
  assert.equal(trace.state,state);
  assert.equal(trace.reason,"business-gate");
  assert.equal(trace.candidate,null);
  assert.equal(trace.graph.nodes.some(n=>n.id==="offer-gate"),false);
  assert.deepEqual(trace.graph.edges.at(-1),{from:"business-brain",to:"disposition",relation:"disposition"});
  assert.equal(trace.graph.nodes.find(n=>n.id==="business-brain").status,state);
 }
});
test("trace distinguishes later offer gate hold from business hold",()=>{
 const raw=fixture(), trace=decisionTrace({...raw,maxCampaignMinor:0,business:{...raw.business,campaignMinor:100}},now);
 assert.equal(trace.state,"hold");
 assert.equal(trace.reason,"campaign-budget-exceeded");
 assert.equal(trace.graph.nodes.find(n=>n.id==="business-brain").status,"review-only");
 assert.equal(trace.graph.nodes.find(n=>n.id==="offer-gate").status,"hold");
 assert.equal(trace.candidate,null);
});
test("trace rejects stale day and supplied decisions or guest fields",()=>{
 for(const patch of [{state:"review-only"},{guestId:"x"},{memory:[]},{graph:{}},{rolloutAuthorized:true}]){
  assert.throws(()=>decisionTrace({...fixture(),...patch},now));
 }
 assert.throws(()=>decisionTrace(fixture(),Date.parse("2026-11-14T21:00:00Z")));
 assert.throws(()=>decisionTrace(fixture(),NaN));
});
