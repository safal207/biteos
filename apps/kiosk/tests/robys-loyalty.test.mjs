import {test} from "node:test";
import assert from "node:assert/strict";
import {demoLoyalty,projectLoyalty} from "../src/robysLoyalty.ts";
import {robysCatalog} from "../src/robysPublicCatalog.ts";
const ids=robysCatalog.products.map(p=>p.id),asOf="2026-11-15";
test("repeat order, distinct days and prior cohort retention are separate; no member IDs in output",()=>{
 const raw=demoLoyalty(),r=projectLoyalty(raw,ids,asOf);
 assert.equal(r.priorMembers,8);assert.equal(r.activeMembers,8);assert.equal(r.returningMembers,6);assert.equal(r.firstSeenInWindow,2);assert.equal(r.repeatMembers,6);assert.equal(r.retention,.75);
 const latte=r.products.find(p=>p.productId==="hot-coffee:caffe-latte");assert.equal(latte.buyers,8);assert.equal(latte.repeatBuyers,6);assert.equal(latte.threeDayBuyers,4);assert.equal(r.orders,23);assert.equal(r.actualRevenueVerified,false);assert.ok(!JSON.stringify(r).includes(raw.members[0].memberKey));
});
test("reject duplicate, unconsented, unmatched, private-field, amount and time errors",()=>{
 const raw=demoLoyalty(),check=x=>assert.throws(()=>projectLoyalty(x,ids,asOf));
 check({...raw,orders:[...raw.orders,raw.orders[0]]});
 check({...raw,members:raw.members.map((m,i)=>i?m:{...m,activeConsent:false})});
 check({...raw,orders:raw.orders.map((o,i)=>i?o:{...o,memberKey:"f".repeat(32)})});
 check({...raw,members:raw.members.map((m,i)=>i?m:{...m,phone:"123"})});
 check({...raw,orders:raw.orders.map((o,i)=>i?o:{...o,netMinor:1})});
 check({...raw,completeForConsentingMembers:false});assert.throws(()=>projectLoyalty(raw,ids,"2026-11-14"));
 check({...raw,orders:raw.orders.filter(o=>o.memberKey===raw.members[0].memberKey)});
 const small=structuredClone(raw);small.orders.push({orderKey:"f".repeat(32),memberKey:raw.members[9].memberKey,settledAt:"2026-11-12T09:00:00.000Z",netMinor:3000,lines:[{productId:"desserts:macaron",quantity:1,netMinor:3000}]});
 const r=projectLoyalty(small,ids,asOf);assert.equal(r.suppressedProducts,1);assert.ok(!r.products.some(p=>p.productId==="desserts:macaron"));
});
