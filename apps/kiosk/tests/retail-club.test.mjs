import { test } from "node:test";
import assert from "node:assert/strict";
import {parseClubList,snapshotCart,goalList,reviewList,reviewedCart,rankJourney,journeyHint} from "../src/retailClub.ts";
const products=[
 {id:"eggs",name:{tr:"Yumurta",ru:"Яйца",en:"Eggs"},price:7200,stock:4},
 {id:"milk",name:{tr:"Süt",ru:"Молоко",en:"Milk"},price:4900,stock:3},
 {id:"bread",name:{tr:"Ekmek",ru:"Хлеб",en:"Bread"},price:6500,stock:3},
 {id:"banana",name:{tr:"Muz",ru:"Бананы",en:"Bananas"},price:3900,stock:2}
];
test("goal derives from actual catalog, exact minor-unit budget",()=>{
 const list=goalList("breakfast",products);
 assert.equal(reviewList(list,products,22500).subtotal,22500);
 assert.equal(reviewList(list,products,22500).canApply,true);
 assert.equal(reviewedCart(list,products,22499),null);
 assert.deepEqual(reviewedCart(list,products,22500),{eggs:1,bread:1,milk:1,banana:1});
});
test("saved price survives and stock or removed SKU blocks application",()=>{
 const list=parseClubList(JSON.stringify(snapshotCart({milk:2,bread:1},products)));
 const updated=products.map(p=>p.id==="milk"?{...p,price:5200,stock:1}:p);
 const r=reviewList(list,updated,null);
 assert.equal(r.lines[0].changed,true);assert.equal(r.canApply,false);
 assert.equal(reviewedCart(list,products.filter(p=>p.id!=="bread"),null),null);
 assert.deepEqual(reviewedCart(list.map(l=>({...l,quantity:1})),updated,null),{milk:1,bread:1});
});
test("damaged local data is rejected, not executed",()=>{
 for(const raw of ["{", "null", '{"id":"milk"}',JSON.stringify([{id:"milk",quantity:-1,previousPrice:4900}]),JSON.stringify([{id:"milk",quantity:1,previousPrice:4900},{id:"milk",quantity:1,previousPrice:4900}])])assert.deepEqual(parseClubList(raw),[]);
 assert.equal(reviewedCart([{id:"milk",quantity:NaN,previousPrice:4900}],products,null),null);
 assert.equal(reviewedCart([{id:"milk",quantity:1,previousPrice:4900}],products,NaN),null);
});

const fullCatalog=[...products,{id:"dumplings",name:{tr:"Pelmeni",ru:"Пельмени",en:"Pelmeni"},price:16500,stock:4},{id:"buckwheat",name:{tr:"Karabuğday",ru:"Гречка",en:"Buckwheat"},price:9500,stock:4}];
test("explicit morning/evening context changes order without submitting or altering products",()=>{
 const before=JSON.stringify(fullCatalog);
 const morning=rankJourney({time:"morning",place:"home",budget:null},fullCatalog);
 assert.equal(morning[0].goal.id,"breakfast");
 assert.equal(morning[0].timeMatch,true);
 assert.equal(rankJourney({time:"evening",place:"onway",budget:null},fullCatalog)[0].goal.id,"dinner");
 assert.equal(JSON.stringify(fullCatalog),before);
});
test("stock and budget gates override relevance while preserving unavailable goals",()=>{
 const a=rankJourney({time:"evening",place:"home",budget:22500},fullCatalog);
 assert.equal(a.length,4);
 assert.equal(a[0].view.canApply,true);
 assert.equal(a.find(x=>x.goal.id==="dinner").view.overBudget,true);
 const b=rankJourney({time:"evening",place:"home",budget:null},fullCatalog.filter(p=>p.id!=="dumplings"));
 assert.equal(b.find(x=>x.goal.id==="dinner").view.canApply,false);
 assert.equal(b.find(x=>x.goal.id==="dinner").list.some(x=>x.id==="dumplings"),true);
 assert.equal(b[0].view.canApply,true);
});
test("neutral context and manual location hints are deterministic",()=>{
 const ranked=rankJourney({time:"any",place:"any",budget:null},fullCatalog);
 assert.equal(ranked[0].goal.id,"breakfast");
 assert.equal(journeyHint("any"),"compare");
 assert.equal(journeyHint("home"),"compare");
 assert.equal(journeyHint("onway"),"pickup");
 assert.equal(journeyHint("store"),"in_store");
});
