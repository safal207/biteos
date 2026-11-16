import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {resolve} from "node:path";
import {pathToFileURL} from "node:url";
import {soundsAdvice,soundMoments} from "../src/robysSoundsAdvice.ts";
import {clubAdvice} from "../src/robysClubAdvice.ts";
import {robysCatalog} from "../src/robysPublicCatalog.ts";
import {moods} from "../src/robysAdaptive.ts";

const favorite="hot-coffee:flat-white";
const base={schema:"robys.sounds-advice.v1",catalogRevision:robysCatalog.sourceRevision,usePreferences:true,
 moment:"focus",favoriteIds:[favorite],avoidIds:[],unavailableIds:[],
 day:"2026-11-16",hour:15,weather:"rain",budgetMinor:null};
test("every explicit moment maps to the existing agent, not a parallel ranking",()=>{
 for(const [moment,map] of Object.entries(soundMoments)){
  assert.ok(moods.includes(map.adaptive));
  const {moment:_,...raw}={...base,moment};
  const expected=clubAdvice({...raw,schema:"robys.club-advice.v1",intent:map.intent});
  const result=soundsAdvice({...base,moment});
  const {contextSource,musicDataRead,deviceAppsRead,purchasesRead,...decision}=result;
  assert.deepEqual(decision,expected);
  assert.equal(contextSource,"explicit-sounds-moment");
  for(const flag of [musicDataRead,deviceAppsRead,purchasesRead,result.marketingAuthorized,result.retained,result.stockVerified,result.priceChanged,result.externalEffectsAuthorized])assert.equal(flag,false);
 }
 const one=soundsAdvice(base);assert.equal(one.offer.productId,favorite);
 assert.equal(one.offer.priceMinor,robysCatalog.products.find(p=>p.id===favorite).priceMinor);
});
test("opt-out, budget, safety and explicit exclusions keep advice optional",()=>{
 assert.equal(soundsAdvice({...base,usePreferences:false,moment:null,favoriteIds:[]}).action,"abstain");
 assert.equal(soundsAdvice({...base,favoriteIds:[]}).action,"abstain");
 for(const patch of [{budgetMinor:0},{weather:"storm"},{hour:8},{day:"2026-11-10"}])assert.equal(soundsAdvice({...base,...patch}).action,"abstain");
 assert.notEqual(soundsAdvice({...base,unavailableIds:[favorite]}).offer?.productId,favorite);
 assert.notEqual(soundsAdvice({...base,favoriteIds:[],avoidIds:[favorite]}).offer?.productId,favorite);
});
test("reject automatic or unsolicited data and stale catalog",()=>{
 for(const patch of [{moment:"unknown"},{moment:"__proto__"},{music:"rock"},{layout:"reels"},{track:"x"},{apps:[]},{paidOrders:[]},{email:"x"},{history:[]},{usePreferences:false},{catalogRevision:"old"}])assert.throws(()=>soundsAdvice({...base,...patch}));
});
test("reviewed Robys Sounds actual source has matching mood codes",{skip:!process.env.ROBYS_SOUNDS_MODEL},async()=>{
 const path=resolve(process.env.ROBYS_SOUNDS_MODEL);
 const bytes=readFileSync(path);
 const actual=createHash("sha1").update("blob "+bytes.length+"\0").update(bytes).digest("hex");
 assert.equal(actual,"7b07c4686f08f5120e59d8f6a568b75fc5428140");
 const source=await import(pathToFileURL(path).href);
 assert.deepEqual(Object.fromEntries(source.moods.map(m=>[m.id,m.adaptive])),
 Object.fromEntries(Object.entries(soundMoments).map(([id,m])=>[id,m.adaptive])));
 for(const m of source.moods){
  const selection={mood:m.id,music:"auto",layout:"classic"};
  const look=source.livingContext(selection,[]);
  assert.equal(look.adaptiveMood,soundMoments[m.id].adaptive);
  assert.equal(soundsAdvice({...base,moment:look.mood.id}).contextSource,"explicit-sounds-moment");
 }
});
