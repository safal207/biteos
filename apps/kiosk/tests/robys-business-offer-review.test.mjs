import {test} from "node:test";
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
