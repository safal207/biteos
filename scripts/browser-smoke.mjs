import {createRequire} from "node:module";
import {createServer} from "node:http";
import {readFile,stat} from "node:fs/promises";
import {resolve,extname,sep} from "node:path";
import assert from "node:assert/strict";
const require=createRequire(resolve(process.env.BITEOS_BROWSER_TOOLS,"package.json"));
const playwright=require("playwright");
const engine=process.env.BITEOS_BROWSER||"chromium";
assert.ok(["chromium","firefox","webkit"].includes(engine));
const root=resolve("apps/kiosk/dist-pages");
const mime={".html":"text/html",".js":"text/javascript",".css":"text/css",".json":"application/json",".svg":"image/svg+xml",".png":"image/png",".jpg":"image/jpeg",".webp":"image/webp",".woff2":"font/woff2",".woff":"font/woff"};
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,"http://127.0.0.1");
  if(!url.pathname.startsWith("/biteos/")){res.writeHead(404).end();return}
  const file=resolve(root,decodeURIComponent(url.pathname.slice(8))||"index.html");
  if(!file.startsWith(root+sep)||!(await stat(file)).isFile()){res.writeHead(404).end();return}
  res.writeHead(200,{"Content-Type":mime[extname(file)]||"application/octet-stream"}).end(await readFile(file));
 }catch{res.writeHead(404).end()}
});
await new Promise((ok,fail)=>{server.once("error",fail);server.listen(0,"127.0.0.1",ok)});
let browser;
try{
 browser=await playwright[engine].launch({headless:true});
 const base="http://127.0.0.1:"+server.address().port+"/biteos/";
 for(const viewport of [{width:390,height:844},{width:1280,height:800}]){
  const page=await browser.newPage({viewport});
  const failures=[];
  page.on("pageerror",error=>failures.push(error.message));
  page.on("request",req=>{if(new URL(req.url()).pathname.startsWith("/api/"))failures.push("Unexpected network API: "+req.url())});
  page.on("response",res=>{if(res.status()>=400&&res.url().startsWith(base))failures.push("Asset HTTP "+res.status()+": "+res.url())});
  await page.goto(base+"#workspace");
  await page.locator(".biteos-workspace h1").waitFor();
  await page.getByLabel("Language").selectOption("ru");
  const links=page.locator("[data-workspace-route]");
  assert.equal(await links.count(),21);
  const routes=await links.evaluateAll(nodes=>nodes.map(n=>n.getAttribute("href")));
  await page.locator(".workspace-search input").fill("ОБСЕРВАТОРИЯ");
  assert.equal(await links.count(),1);
  await page.locator(".workspace-search input").fill("zz-no-result");
  assert.equal(await links.count(),0);
  await page.locator(".workspace-search input").fill("");
  assert.equal(await links.count(),21);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),"workspace horizontal overflow");
  for(const route of routes){
   await page.goto(base+"#workspace");
   await page.locator("[data-workspace-route='"+route+"']").click();
   await page.waitForURL("**/"+route);
   // The workspace is itself main.retail; wait for the React route commit first.
   await page.locator(".biteos-workspace").waitFor({state:"detached"});
   if(route==="#kiosk")await page.locator(".kiosk-delivery-link").first().waitFor();
   else await page.locator("main.retail").first().waitFor();
   assert.equal(await page.locator(".biteos-workspace").count(),0);
   if(route.startsWith("#retail-")){
    await page.locator(".workspace-back").click();
    await page.locator(".biteos-workspace").waitFor();
   }
   assert.deepEqual(failures,[],route+" "+engine+" "+viewport.width);
  }
  await page.goto(base+"#retail-observatory");
  await page.getByLabel("Language").selectOption("en");
  await page.getByRole("heading",{name:"Forecast error"}).waitFor();
  assert.ok(await page.getByText("Causal effect not established.").isVisible());
  await page.goto(base+"#retail-decision-studio");
  await page.getByLabel("Language").selectOption("en");
  await page.getByRole("heading",{name:"Decision studio"}).waitFor();
  assert.ok(await page.getByText("9.09%",{exact:true}).isVisible());
  await page.getByRole("button",{name:"Awaiting observation"}).click();
  await page.getByText("pilot-next",{exact:true}).waitFor();
  assert.equal(await page.locator("[data-decision-row]").count(),1);
  await page.getByRole("button",{name:"All decisions"}).click();
  await page.locator("[data-decision-row]").last().waitFor();
  assert.equal(await page.locator("[data-decision-row]").count(),4);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),"decision studio horizontal overflow");
  await page.goto(base+"#retail-robys-growth");
  await page.getByLabel("Language").selectOption("en");
  await page.getByRole("heading",{name:"Roby’s growth dashboard"}).waitFor();
  assert.ok(await page.getByText("Illustrative data — not café statistics.",{exact:true}).isVisible());
  assert.equal(await page.locator("input[type=file]").count(),0);
  await page.getByLabel("Rank products by").selectOption("cartAddSessions");
  assert.equal(await page.locator("[data-growth-product]").first().getAttribute("data-growth-product"),"desserts:san-sebastian-cheesecake");
  assert.equal(await page.locator("[data-robys-catalog-id]").count(),63);
  await page.getByLabel("Search products").fill("Caffè Latte");
  assert.ok(await page.locator("[data-robys-catalog-id]").count()<63);
  await page.getByLabel("Search products").fill("unmatched-zzz");
  assert.equal(await page.locator("[data-robys-catalog-id]").count(),0);
  await page.getByLabel("Search products").fill("");
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),"growth dashboard overflow");
  await page.goto(base+"#retail-robys-campaign");
  await page.getByLabel("Language").selectOption("en");
  await page.getByRole("heading",{name:"Roby’s campaign studio"}).waitFor();
  const link=await page.getByLabel("Campaign link").inputValue();
  assert.ok(link.includes("utm_source=instagram")&&link.includes("utm_campaign=pilot"));
  await page.getByLabel("Channel").selectOption("table_qr");
  assert.ok((await page.getByLabel("Campaign link").inputValue()).includes("utm_source=table_qr"));
  assert.equal(await page.locator("input[type=file]").count(),0);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),"campaign studio overflow");
  await page.goto(base+"#retail-robys-loyalty");
  await page.getByLabel("Language").selectOption("en");
  await page.getByRole("heading",{name:"Roby’s loyalty intelligence"}).waitFor();
  assert.equal(await page.locator("input[type=file]").count(),0);
  assert.ok(await page.getByText("Illustrative data only.",{exact:true}).isVisible());
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),"loyalty dashboard overflow");
  await page.goto(base+"#retail-robys-community");
  await page.getByLabel("Language").selectOption("en");
  await page.getByRole("heading",{name:"Roby’s community studio"}).waitFor();
  assert.equal(await page.locator("[data-community-stage]").count(),9);
  assert.ok(await page.getByText("Draft only — nothing published.",{exact:true}).isVisible());
  await page.getByLabel("Reward limit").fill("100");
  assert.ok(await page.getByText("Reward budget exceeded.",{exact:true}).isVisible());
  await page.getByLabel("Reward limit").fill("10");
  assert.equal(await page.locator("[data-community-stage]").count(),9);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),"community studio overflow");
  await page.goto(base+"#retail-robys-context");
  await page.getByLabel("Language").selectOption("en");
  await page.getByRole("heading",{name:"Roby’s context assistant"}).waitFor();
  await page.getByLabel("Weather").selectOption("storm");
  assert.equal(await page.locator("[data-context-product]").count(),0);
  await page.getByLabel("Weather").selectOption("hot");
  assert.ok(await page.locator("[data-context-product]").count()>0);
  assert.ok(await page.getByText("Simulation only — no live weather or messages.",{exact:true}).isVisible());
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),"context studio overflow");
  assert.deepEqual(failures,[]);
  console.log(engine+" "+viewport.width+"px: 21 routes, search, return navigation, observatory verified");
  await page.close();
 }
}finally{if(browser)await browser.close();await new Promise(ok=>server.close(ok))}
