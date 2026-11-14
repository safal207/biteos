import {test} from "node:test";
import assert from "node:assert/strict";
import {decodeEngagement,decodeCounter,rankProducts,demoEngagement,demoCounter} from "../src/robysGrowth.ts";
const e={...demoEngagement,schema:"biteos.robys-engagement-aggregate.v1",tenantId:"robys",timeZone:"UTC+03:00",evidenceStatus:"opt-in-client-events-unverified",actualRevenueVerified:false,uniquePeopleVerified:false,causalEffectEstablished:false};
const c={...demoCounter,schema:"biteos.robys-counter-aggregate.v1",tenantId:"robys",sourceRepository:"safal207/robys-coffee-house-demo",currency:"TRY",timeZone:"UTC+03:00",evidenceStatus:"local-counter-staff-acknowledgement-not-pos-reconciled",actualRevenueVerified:false,profitAvailable:false,causalEffectEstablished:false,externalEffectsAuthorized:false};
test("local growth import retains only approved aggregate fields",()=>{
 assert.deepEqual(decodeEngagement(e),demoEngagement);assert.deepEqual(decodeCounter(c),demoCounter);
 const original=JSON.stringify(e.products);
 assert.equal(rankProducts(e.products,"cartAddSessions")[0].productId,"desserts:san-sebastian-cheesecake");
 assert.equal(JSON.stringify(e.products),original);
 assert.equal("private" in decodeEngagement({...e,private:"not retained"}),false);
});
test("invalid or misleading reports fail closed",()=>{
 for(const x of [{...e,tenantId:"rozal"},{...e,actualRevenueVerified:true},{...e,sessions:1},{...e,hours:e.hours.slice(1)},{...e,products:[{...e.products[0],likeSessions:-1}]},{...e,areaClicks:{unknown:4}}])assert.throws(()=>decodeEngagement(x));
 for(const x of [{...c,profitAvailable:true},{...c,actualRevenueVerified:true},{...c,startDay:"2026-02-30"},{...c,paidToReadySample:999},{...c,averagePaidToReadyMs:null}])assert.throws(()=>decodeCounter(x));
});
