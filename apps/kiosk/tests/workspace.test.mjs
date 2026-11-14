import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {workspaceEntries,workspaceGroups,workspaceSearch} from "../src/workspace.ts";

test("workspace covers all registered retail and kiosk routes without duplicates",()=>{
 const main=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");
 const routes=[...main.matchAll(/route === "(#retail[^"]*|#kiosk)"/g)].map(m=>m[1]).sort();
 assert.deepEqual(workspaceEntries.map(e=>e.route).sort(),routes);
 assert.equal(new Set(routes).size,routes.length);
 assert.equal(workspaceEntries.length,17);
 for(const group of workspaceGroups)assert.ok(workspaceEntries.some(e=>e.group===group));
});
test("search and translations are present, local comparisons do not mutate registry",()=>{
 const before=JSON.stringify(workspaceEntries);
 for(const e of workspaceEntries)for(const lang of ["tr","ru","en"]){
  assert.ok(e.name[lang].trim());assert.ok(e.description[lang].trim());
  assert.ok(workspaceSearch(lang,e.route).some(x=>x.route===e.route));
 }
 assert.equal(workspaceSearch("ru","  ОБСЕРВАТОРИЯ ")[0].route,"#retail-observatory");
 assert.equal(workspaceSearch("en","not-a-real-module").length,0);
 assert.equal(workspaceSearch("tr","").length,17);
 assert.equal(JSON.stringify(workspaceEntries),before);
});
