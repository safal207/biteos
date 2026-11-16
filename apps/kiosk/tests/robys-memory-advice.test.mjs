import {test} from "node:test";
import assert from "node:assert/strict";
import {freshMemory,addMemory} from "../src/robysMemory.ts";
import {memorySoundsAdvice} from "../src/robysMemoryAdvice.ts";
import {soundsAdvice} from "../src/robysSoundsAdvice.ts";
import {robysCatalog} from "../src/robysPublicCatalog.ts";
const now=Date.parse("2026-11-16T12:00:00Z"),day=86400000;
const ids=robysCatalog.products.map(p=>p.id);
const favorite="hot-coffee:flat-white",other="hot-coffee:cappuccino",avoid="desserts:brownie";
const base={schema:"robys.sounds-advice.v1",catalogRevision:robysCatalog.sourceRevision,usePreferences:true,moment:"focus",favoriteIds:[favorite],avoidIds:[],unavailableIds:[],day:"2026-11-16",hour:15,weather:"rain",budgetMinor:null};
function sample(){
 let m=freshMemory(now);
 for(const [topic,value,action] of [["product",favorite,"prefer"],["product",other,"prefer"],["product",avoid,"avoid"],["layout","gallery","prefer"]])m=addMemory(m,now,ids,topic,value,action);
 return m;
}
test("reuse current memory only for explicitly selected favorites and avoids",()=>{
 const memory=sample(),raw=JSON.stringify(memory);
 const r=memorySoundsAdvice(base,()=>raw,now);
 assert.deepEqual(r,{...soundsAdvice(base),memoryUsed:true});
 assert.equal(r.offer.productId,favorite);
 assert.equal(r.retained,false);assert.equal(r.marketingAuthorized,false);
 assert.equal(r.purchasesRead,false);assert.equal(r.deviceAppsRead,false);
 assert.deepEqual(memorySoundsAdvice({...base,avoidIds:[avoid]},()=>raw,now),{...soundsAdvice({...base,avoidIds:[avoid]}),memoryUsed:true});
 assert.ok(!JSON.stringify(r).includes("gallery"));
 assert.equal(JSON.stringify(memory),raw);
});
test("opt-out and empty selection never read device memory",()=>{
 const noRead=()=>{throw Error("must not read")};
 assert.equal(memorySoundsAdvice({...base,usePreferences:false,moment:null,favoriteIds:[]},noRead,now).memoryUsed,false);
 assert.equal(memorySoundsAdvice({...base,favoriteIds:[]},noRead,now).action,"abstain");
 assert.throws(()=>memorySoundsAdvice({...base,usePreferences:false},noRead,now));
});
test("latest explicit reversal, removed, expired and malformed memory fail closed",()=>{
 const m=sample(),reversed=addMemory(m,now+1,ids,"product",favorite,"avoid");
 assert.throws(()=>memorySoundsAdvice(base,()=>JSON.stringify(reversed),now+1),/stale/);
 for(const [raw,at] of [[null,now],["bad",now],[JSON.stringify(m),now+31*day],[JSON.stringify(m),now-1]])assert.throws(()=>memorySoundsAdvice(base,()=>raw,at),/stale/);
 assert.throws(()=>memorySoundsAdvice(base,()=>{throw Error("storage denied")},now),/stale/);
 assert.throws(()=>memorySoundsAdvice({...base,favoriteIds:[avoid]},()=>JSON.stringify(m),now),/stale/);
});
test("ordinary safety rules remain unchanged and unsolicited fields reject before reading",()=>{
 const get=()=>JSON.stringify(sample());
 for(const patch of [{weather:"storm"},{budgetMinor:0},{hour:8}])assert.equal(memorySoundsAdvice({...base,...patch},get,now).action,"abstain");
 let reads=0;const reader=()=>{reads++;return get()};
 for(const extra of [{history:[]},{track:"x"},{apps:[]},{purchases:[]},{email:"x"}])assert.throws(()=>memorySoundsAdvice({...base,...extra},reader,now));
 assert.equal(reads,0);
});
