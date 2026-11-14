import {test} from "node:test";
import assert from "node:assert/strict";
import {draftCampaign,evaluateCampaign} from "../src/robysCampaign.ts";
import {robysCatalog} from "../src/robysPublicCatalog.ts";
const ids=robysCatalog.products.map(p=>p.id),input={productId:"pairing-offers:iced-san-sebastian-pairing",channel:"instagram",language:"ru",startDay:"2026-11-14",duration:7,budgetMinor:30000,targetHandoffs:15};
test("source catalog, fixed contract UTM, equal adjacent windows, no execution",()=>{
 const p=draftCampaign(input,ids),u=new URL(p.link);
 assert.equal(u.searchParams.get("item"),input.productId);assert.equal(u.searchParams.get("utm_campaign"),"pilot");assert.equal(u.searchParams.get("utm_medium"),"social");assert.equal(p.baselineStart,"2026-11-07");assert.equal(p.endExclusive,"2026-11-21");assert.equal(p.externalEffectsAuthorized,false);
 for(const v of [{productId:"fake:product"},{channel:"unknown"},{duration:0},{startDay:"2026-02-30"},{budgetMinor:-1}])assert.throws(()=>draftCampaign({...input,...v},ids));
});
test("strict matching windows and only tagged channel, no payment or causal claim",()=>{
 const p=draftCampaign(input,ids);
 const report=(startDay,endExclusive,sessions,handoffSessions)=>({startDay,endExclusive,channels:[{source:"instagram",campaign:"pilot",sessions,handoffSessions},{source:"instagram",campaign:"story",sessions:100,handoffSessions:99}]});
 const b=report(p.baselineStart,p.baselineEndExclusive,60,9),o=report(p.startDay,p.endExclusive,90,18);
 const r=evaluateCampaign(p,b,o,p.endExclusive);assert.equal(r.deltaHandoffs,9);assert.equal(r.targetMet,true);assert.equal(r.actualRevenueVerified,false);assert.equal(r.causalEffectEstablished,false);assert.equal(r.plannedCostPerHandoffMinor,1667);
 assert.throws(()=>evaluateCampaign(p,b,o,p.startDay));assert.throws(()=>evaluateCampaign(p,b,{...o,startDay:p.baselineStart},p.endExclusive));
 const empty=evaluateCampaign(p,b,{...o,channels:[]},p.endExclusive);assert.equal(empty.observedRate,null);assert.equal(empty.plannedCostPerHandoffMinor,null);
});
