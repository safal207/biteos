import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,rmSync,writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {DatabaseSync} from "node:sqlite";
import {createSession} from "./robys-engagement.mjs";
import {robysCatalog} from "../apps/kiosk/src/robysPublicCatalog.ts";
import {decodeEngagement} from "../apps/kiosk/src/robysGrowth.ts";
import {initCollector,ingestEvents,engagementReport,pruneCollector} from "./robys-event-collector.mjs";
const id="hot-coffee:caffe-latte",catalogIds=robysCatalog.products.map(p=>p.id),now=Date.parse("2026-11-15T10:00:00Z");
function fixture(letter,at,source="instagram"){
 let tick=Date.parse(at);
 return createSession({consent:true,sessionId:letter.repeat(32),href:"https://example.test/?utm_source="+source+"&utm_medium=social&utm_campaign=story",catalogIds,clock:()=>new Date(tick+=1000).toISOString()});
}
test("durable prefixes, replay, growth import, session cohort and rollback",()=>{
 const dir=mkdtempSync(join(tmpdir(),"robys-collector-")),file=join(dir,"private.sqlite");
 try{
  initCollector(file);assert.throws(()=>initCollector(file));
  const one=fixture("a","2026-11-14T20:59:50Z");
  one.record("product_view",id);const first=one.export();
  assert.equal(ingestEvents(file,first,now).inserted,2);
  assert.equal(ingestEvents(file,first,now).replayed,2);
  one.record("product_like",id);assert.equal(ingestEvents(file,one.export(),now).inserted,1);
  assert.equal(ingestEvents(file,first,now).inserted,0);
  const second=fixture("b","2026-11-14T21:00:00Z");second.record("product_view",id);second.record("cart_add",id);
  assert.equal(ingestEvents(file,second.export(),now).inserted,3);
  const r=engagementReport(file,"2026-11-14","2026-11-15",now);
  assert.equal(decodeEngagement(r).sessions,1);assert.equal(r.products[0].likeSessions,1);
  assert.equal(engagementReport(file,"2026-11-15","2026-11-16",now).products[0].cartAddSessions,1);
  assert.ok(!JSON.stringify(r).includes("a".repeat(32)));
  const conflict=one.export().map(e=>e.sequence===2?{...e,action:"product_like"}:e);
  const third=fixture("c","2026-11-14T20:00:00Z");
  assert.throws(()=>ingestEvents(file,[...third.export(),...conflict],now));
  assert.equal(engagementReport(file,"2026-11-14","2026-11-16",now).sessions,2);
  assert.throws(()=>ingestEvents(file,[{...first[0],phone:"123"}],now));
  assert.throws(()=>ingestEvents(file,first.slice(1),now));
  const old=fixture("d","2026-09-01T12:00:00Z");assert.throws(()=>ingestEvents(file,old.export(),now));
  const later=now+31*86400000;assert.equal(pruneCollector(file,later).deletedSessions,2);
  const db=new DatabaseSync(file,{readOnly:true});assert.equal(db.prepare("SELECT COUNT(*) AS n FROM events").get().n,0);db.close();
  assert.equal(engagementReport(file,"2026-11-14","2026-11-16",later).sessions,0);
  assert.throws(()=>ingestEvents(file,first,later));
  const unrelated=join(dir,"unrelated.sqlite");new DatabaseSync(unrelated).close();assert.throws(()=>ingestEvents(unrelated,first,now));
  const text=join(dir,"ordinary.txt");writeFileSync(text,"hello");assert.throws(()=>initCollector(text));
 }finally{rmSync(dir,{recursive:true,force:true})}
});
