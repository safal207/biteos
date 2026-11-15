import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,rmSync,writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import {pathToFileURL} from "node:url";
import {decodeEngagement} from "../apps/kiosk/src/robysGrowth.ts";
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

test("actual pinned Robys producer -> durable BiteOS import -> Growth decoder",{skip:!process.env.ROBYS_CONTRACT_FILE},async()=>{
 // Trusted CI checkout only: verify the reviewed source before importing it.
 const path=resolve(process.env.ROBYS_CONTRACT_FILE);
 const proof=compareContract(path);
 assert.equal(proof.producerRevision,"ceba0f55fe270429fa3080020834312d30d76967");
 assert.equal(proof.producerBlob,"9e3ad10d1c697a83434e53fbc0e21b455264ac61");
 const producer=await import(pathToFileURL(path).href);
 const id="hot-coffee:caffe-latte",sessionId="b".repeat(32);
 const catalogIds=robysCatalog.products.map(p=>p.id);
 assert.ok(catalogIds.includes(id));
 let tick=Date.parse("2026-11-14T10:00:00Z");
 const config={sessionId,href:"https://example.test/menu-feed.html?utm_source=instagram&utm_medium=social&utm_campaign=story",
  language:"ru",catalogIds,clock:()=>new Date(tick+=1000).toISOString()};
 assert.equal(producer.createSession({...config,consent:false}),null);
 const session=producer.createSession({...config,consent:true});
 assert.equal(session.record("product_view",id),true);
 assert.equal(session.record("product_view",id),false);
 assert.equal(session.record("product_like",id),true);
 assert.equal(session.record("share_intent",id),true);
 assert.equal(session.record("share_completed",id),true);
 assert.equal(session.record("cart_add",id),true);
 assert.equal(session.record("cart_add","fake:product"),false);
 assert.equal(session.record("paid_order",id),false);
 const exported=JSON.parse(JSON.stringify(session.export()));
 assert.equal(exported.length,6);
 const dir=mkdtempSync(join(tmpdir(),"robys-cross-repo-")),file=join(dir,"private.sqlite");
 try{
  initCollector(file);
  assert.equal(ingestEvents(file,exported,now).inserted,6);
  const retry=ingestEvents(file,exported,now);
  assert.equal(retry.inserted,0);assert.equal(retry.replayed,6);
  assert.throws(()=>ingestEvents(file,exported.map(e=>e.sequence===2?{...e,email:"synthetic@example.invalid"}:e),now));
  const report=closedEngagementReport(file,"2026-11-14",day,now);
  const growth=decodeEngagement(report);
  assert.equal(growth.sessions,1);
  assert.equal(growth.channels[0].source,"instagram");
  assert.equal(growth.channels[0].handoffSessions,0);
  assert.equal(growth.products[0].viewSessions,1);
  assert.equal(growth.products[0].likeSessions,1);
  assert.equal(growth.products[0].shareCompletedSessions,1);
  assert.equal(growth.products[0].cartAddSessions,1);
  assert.equal(report.actualRevenueVerified,false);
  assert.equal(report.uniquePeopleVerified,false);
  assert.equal(report.causalEffectEstablished,false);
  assert.ok(!JSON.stringify(report).includes(sessionId));
  session.withdraw();assert.deepEqual(session.export(),[]);
  // Withdrawal clears this producer only, not an already imported snapshot.
  assert.equal(closedEngagementReport(file,"2026-11-14",day,now).sessions,1);
 }finally{rmSync(dir,{recursive:true,force:true})}
});
