import { test } from "node:test";
import assert from "node:assert/strict";
import {parseClubList,snapshotCart,goalList,reviewList,reviewedCart} from "../src/retailClub.ts";
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
