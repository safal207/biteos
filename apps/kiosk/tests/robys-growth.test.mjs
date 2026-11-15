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

import {robysCatalog} from "../src/robysPublicCatalog.ts";
test("pinned public catalog, original feed identities, prices and flavor options",()=>{
 assert.equal(robysCatalog.products.length,63);assert.equal(robysCatalog.categories.length,8);
 const entries=new Map(robysCatalog.products.map(p=>[p.id,p]));assert.equal(entries.size,63);
 assert.equal(entries.get("hot-coffee:caffe-latte").priceMinor,18000);
 assert.equal(entries.get("pairing-offers:iced-san-sebastian-pairing").priceMinor,37000);
 assert.equal(entries.get("cold-coffee:flavoured-iced-caffe-latte").variants.length,5);
 assert.equal(entries.get("cold-coffee:caffe-latte-frappe").variants.length,7);
 assert.equal(entries.get("cold-coffee:milkshake").variants.length,4);
 for(const p of entries.values()){assert.ok(Object.values(p.name).every(Boolean));assert.ok(p.sourceImage.startsWith("src/products/"));assert.equal(p.currency,"TRY");assert.ok(Number.isSafeInteger(p.priceMinor)&&p.priceMinor>0)}
 for(const p of demoEngagement.products)assert.ok(entries.has(p.productId));
});
