import {createRequire} from "node:module";
import {resolve} from "node:path";
import assert from "node:assert/strict";
const {chromium}=createRequire(resolve(process.env.BITEOS_BROWSER_TOOLS,"package.json"))("playwright");
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:844}});
 const errors=[];page.on("pageerror",e=>errors.push(e.message));
 const base="http://127.0.0.1:5173";
 const open=async()=>{await page.goto(base+"/#retail-decision-studio");await page.getByLabel("Language").selectOption("en");await page.getByRole("heading",{name:"Decision studio"}).waitFor()};
 const load=async(key,tenant="robys")=>{await page.getByLabel("Business ID").fill(tenant);await page.getByLabel("Owner key").fill(key);await page.getByRole("button",{name:"Open local data"}).click()};
 await open();
 assert.equal(await page.locator("[data-decision-row]").count(),0);
 await load("wrong-test-credential-00000000000000000");await page.getByRole("alert").getByText("Invalid key or insufficient access.").waitFor();
 await load(process.env.BITEOS_TENANT_TOKEN_ROBYS_CASHIER);await page.getByRole("alert").getByText("Invalid key or insufficient access.").waitFor();
 await load(process.env.BITEOS_TENANT_TOKEN_ROZAL);await page.getByRole("alert").getByText("Invalid key or insufficient access.").waitFor();
 await load(process.env.BITEOS_TENANT_TOKEN_ROBYS);await page.locator("[data-local-studio]").waitFor();await page.getByText("No registered decisions.").waitFor();
 assert.equal(await page.getByLabel("Owner key").inputValue(),"");
 assert.ok(await page.evaluate(()=>localStorage.length===0&&sessionStorage.length===0));
 await page.getByRole("button",{name:"Clear session"}).click();await page.locator("[data-local-studio]").waitFor({state:"detached"});
 await load(process.env.BITEOS_TENANT_TOKEN_ROZAL,"rozal");await page.locator("[data-local-studio]").getByRole("heading",{name:"rozal"}).waitFor();
 await page.reload();await page.getByLabel("Owner key").waitFor();assert.equal(await page.locator("[data-local-studio]").count(),0);
 assert.equal(await page.getByLabel("Owner key").inputValue(),"");
 assert.deepEqual(errors,[]);
 console.log("Local SQLite pilot: role denial, tenant isolation, read-only empty state, clear and reload verified");
}finally{await browser.close()}
