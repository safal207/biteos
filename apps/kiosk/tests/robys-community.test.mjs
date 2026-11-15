import {test} from "node:test";
import assert from "node:assert/strict";
import {communityPlan} from "../src/robysCommunity.ts";
import {robysCatalog} from "../src/robysPublicCatalog.ts";
const catalog=robysCatalog.products,input={firstId:"hot-coffee:caramel-latte",secondId:"hot-coffee:hazelnut-latte",startDay:"2026-11-22",duration:7,rewardLimit:10,unitCostMinor:6000,budgetMinor:100000};
test("nine ordered localized draft phases, catalog candidates and bounded reward cost",()=>{
 for(const lang of ["tr","ru","en"]){
  const p=communityPlan(input,catalog,lang);
  assert.equal(p.stages.length,9);
  assert.deepEqual(p.stages.map(s=>s.day),["2026-11-15","2026-11-16","2026-11-17","2026-11-19","2026-11-21","2026-11-22","2026-11-29","2026-11-30","2026-12-06"]);
  assert.equal(p.rewardCostMinor,60000);assert.equal(p.withinBudget,true);assert.equal(p.requiresOwnerApproval,true);assert.equal(p.externalEffectsAuthorized,false);assert.equal(p.reviewRequiredForReward,false);
  assert.ok(p.stages[1].draft.includes(catalog.find(x=>x.id===input.firstId).name[lang]));
  assert.ok(p.stages.every(s=>s.title&&s.draft&&s.measure));
 }
 const p=communityPlan({...input,rewardLimit:100},catalog,"en");assert.equal(p.withinBudget,false);assert.match(p.stages[4].draft,/no purchase or review required/);
});
test("invalid product, date or numeric inputs fail closed",()=>{
 for(const x of [{firstId:"fake:product"},{secondId:input.firstId},{startDay:"2026-02-30"},{duration:2},{rewardLimit:0},{budgetMinor:-1},{unitCostMinor:NaN}])assert.throws(()=>communityPlan({...input,...x},catalog,"en"));
});
