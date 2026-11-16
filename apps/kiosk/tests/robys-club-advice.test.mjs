import {test} from "node:test";
import assert from "node:assert/strict";
import {clubAdvice} from "../src/robysClubAdvice.ts";
import {robysCatalog} from "../src/robysPublicCatalog.ts";

const favorite="hot-coffee:caffe-latte";
const product=robysCatalog.products.find(p=>p.id===favorite);
const base={schema:"robys.club-advice.v1",catalogRevision:robysCatalog.sourceRevision,usePreferences:true,
 favoriteIds:[favorite],avoidIds:[],unavailableIds:[],day:"2026-11-16",hour:15,weather:"rain",intent:"any",budgetMinor:null};
test("explicit favorite uses the existing brand ranker and canonical catalog price",()=>{
 const r=clubAdvice(base);
 assert.equal(r.action,"suggest");assert.equal(r.offer.productId,favorite);
 assert.equal(r.offer.priceMinor,product.priceMinor);assert.ok(r.offer.reasons.includes("favorite"));
 assert.equal(r.offer.memoryBasis,null);
 for(const key of ["retained","identityLinked","marketingAuthorized","stockVerified","pushAuthorized","externalEffectsAuthorized","causalEffectEstablished","priceChanged"])assert.equal(r[key],false,key);
 assert.deepEqual(clubAdvice(base),r);
});
test("no explicit selection means no personal suggestion; disabled request cannot carry preferences",()=>{
 assert.equal(clubAdvice({...base,usePreferences:false,favoriteIds:[]}).action,"abstain");
 assert.equal(clubAdvice({...base,favoriteIds:[]}).action,"abstain");
 assert.throws(()=>clubAdvice({...base,usePreferences:false}));
});
test("avoid, stock scenario, budget, memorial and severe weather preserve existing safety guards",()=>{
 assert.notEqual(clubAdvice({...base,favoriteIds:[],avoidIds:[favorite]}).offer?.productId,favorite);
 assert.notEqual(clubAdvice({...base,unavailableIds:[favorite]}).offer?.productId,favorite);
 for(const patch of [{budgetMinor:0},{weather:"storm"},{hour:8},{day:"2026-11-10"}])assert.equal(clubAdvice({...base,...patch}).action,"abstain");
});
test("reject stale catalogs, arbitrary fields, invalid IDs and conflicting preferences",()=>{
 for(const patch of [{catalogRevision:"old"},{email:"test@example.invalid"},{sessionId:"fake"},{history:[]},{priceMinor:1},{favoriteIds:["fake:sku"]},{favoriteIds:[favorite,favorite]},{avoidIds:[favorite]},{weather:"unknown-fake"},{budgetMinor:-1}])assert.throws(()=>clubAdvice({...base,...patch}));
});
