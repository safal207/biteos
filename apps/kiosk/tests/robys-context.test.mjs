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

test("global and Turkish occasions coexist without treating optional themes as official holidays",()=>{
 const halloween=calendarContext("2027-10-31");assert.equal(halloween.occasions[0].kind,"optional");
 const neutral=projectContext({...base,day:"2027-10-31",weather:"mild",hour:15},c);assert.ok(neutral.items.every(p=>!p.reasons.includes("occasion")));
 const themed=projectContext({...base,day:"2027-10-31",weather:"mild",hour:15,optionalThemes:true},c);assert.ok(themed.items.some(p=>p.reasons.includes("occasion")));
 assert.equal(calendarContext("2027-05-09").event,"mothers-day");assert.equal(calendarContext("2027-06-20").event,"fathers-day");
 assert.deepEqual(calendarContext("2027-05-19").occasions.map(o=>o.id),["youth-day","sacrifice-feast"]);
 assert.equal(calendarContext("2027-03-09").schoolBreak,true);assert.equal(calendarContext("2027-03-09").event,"ramadan-feast");
 assert.ok(calendarContext("2026-12-20").upcoming.some(o=>o.day==="2027-01-01"&&o.id==="new-year"));
 assert.equal(projectContext({...base,day:"2027-11-10"},c).items.length,0);
 assert.equal(projectContext({...base,day:"2027-10-31",optionalThemes:true,weather:"storm"},c).items.length,0);
});
