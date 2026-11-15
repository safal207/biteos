import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,rmSync,writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createSession} from "./robys-engagement.mjs";
import {initCollector,ingestEvents} from "./robys-event-collector.mjs";
import {blankBusinessInput,closedEngagementReport,reviewFile,compareContract} from "./robys-pilot-handoff.mjs";
import {robysCatalog} from "../apps/kiosk/src/robysPublicCatalog.ts";
const day="2026-11-15",now=Date.parse("2026-11-15T10:00:00Z"),sku="hot-coffee:caffe-latte";
test("closed reporting guard prevents silent retention truncation, incomplete current period and future window",()=>{
 const dir=mkdtempSync(join(tmpdir(),"robys-handoff-")),file=join(dir,"events.sqlite");
 try{
  initCollector(file);
  const session=createSession({consent:true,sessionId:"a".repeat(32),href:"https://example.test/?utm_source=instagram&utm_medium=social&utm_campaign=story",catalogIds:[sku],clock:()=>new Date("2026-11-14T10:00:00Z").toISOString()});
  session.record("product_view",sku);session.record("cart_add",sku);ingestEvents(file,session.export(),now);
  const r=closedEngagementReport(file,"2026-11-14",day,now);assert.equal(r.sessions,1);assert.equal(r.products[0].cartAddSessions,1);assert.equal(r.actualRevenueVerified,false);assert.ok(!JSON.stringify(r).includes("a".repeat(32)));
  assert.throws(()=>closedEngagementReport(file,"2026-10-16",day,now));assert.throws(()=>closedEngagementReport(file,day,"2026-11-16",now));assert.throws(()=>closedEngagementReport(file,"2026-02-30",day,now));
  const input=join(dir,"input.json");writeFileSync(input,JSON.stringify(blankBusinessInput(day)));const review=reviewFile(input,day);assert.equal(review.state,"collect-evidence");assert.equal(review.tasks.length,5);assert.equal(review.externalEffectsAuthorized,false);assert.equal(review.financial,null);
  assert.throws(()=>reviewFile(input,"2026-11-16"));
  writeFileSync(input,"export const changed = true");assert.throws(()=>compareContract(input));
 }finally{rmSync(dir,{recursive:true,force:true})}
});
test("reviewed cross-repository producer parity",{skip:!process.env.ROBYS_CONTRACT_FILE},()=>{const r=compareContract(process.env.ROBYS_CONTRACT_FILE);assert.equal(r.contractTextMatches,true);assert.equal(r.liveCollectionAuthorized,false)});
