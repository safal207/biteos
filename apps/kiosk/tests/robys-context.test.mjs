import {test} from "node:test";
import assert from "node:assert/strict";
import {projectContext,calendarContext} from "../src/robysContext.ts";
import {robysCatalog} from "../src/robysPublicCatalog.ts";
const c=robysCatalog.products,base={day:"2026-11-16",hour:15,weather:"rain",intent:"any",budgetMinor:40000,favoriteIds:[],unavailableIds:[]};
test("official school dates, weekends and known fixed occasions",()=>{
 assert.equal(calendarContext("2026-11-16").schoolBreak,true);
 assert.equal(calendarContext("2026-11-21").schoolBreak,false);
 assert.equal(calendarContext("2026-11-21").weekend,true);
 assert.equal(calendarContext("2027-04-23").event,"children-day");
 assert.equal(calendarContext("2027-10-01").schoolCalendarKnown,false);
});
test("context changes rank; gates prevent promotion outside hours or storm",()=>{
 const rain=projectContext(base,c),heat=projectContext({...base,weather:"hot"},c);
 assert.ok(rain.items[0].reasons.includes("warm"));assert.ok(heat.items[0].reasons.includes("hot"));
 assert.equal(projectContext({...base,weather:"storm"},c).items.length,0);
 assert.equal(projectContext({...base,hour:8},c).items.length,0);
 assert.equal(rain.pushAuthorized,false);assert.equal(rain.stockVerified,false);
 const limited=projectContext({...base,budgetMinor:8500,intent:"study",unavailableIds:["brew-hot:black-tea"]},c);
 assert.ok(limited.items.every(x=>x.priceMinor<=8500&&x.productId!=="brew-hot:black-tea"));
 const fav=projectContext({...base,favoriteIds:["hot-coffee:caffe-latte"]},c);assert.equal(fav.items[0].productId,"hot-coffee:caffe-latte");
 assert.throws(()=>projectContext({...base,hour:24},c));
});
