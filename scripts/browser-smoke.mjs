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
  assert.equal(await links.count(),15);
  const routes=await links.evaluateAll(nodes=>nodes.map(n=>n.getAttribute("href")));
  await page.locator(".workspace-search input").fill("ОБСЕРВАТОРИЯ");
  assert.equal(await links.count(),1);
  await page.locator(".workspace-search input").fill("zz-no-result");
  assert.equal(await links.count(),0);
  await page.locator(".workspace-search input").fill("");
  assert.equal(await links.count(),15);
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
  assert.deepEqual(failures,[]);
  console.log(engine+" "+viewport.width+"px: 15 routes, search, return navigation, observatory verified");
  await page.close();
 }
}finally{if(browser)await browser.close();await new Promise(ok=>server.close(ok))}
