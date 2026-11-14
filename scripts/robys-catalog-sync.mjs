import {readFileSync,existsSync} from "node:fs";
import {resolve} from "node:path";
import {createHash} from "node:crypto";
function parseCatalog(source){
 const slug=s=>s.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
 const names=sz=>{const r=sz.match(/name:\s*\{\s*tr:\s*("(?:[^"\\]|\\.)*"),\s*en:\s*("(?:[^"\\]|\\.)*"),\s*ru:\s*("(?:[^"\\]|\\.)*")\s*\}/);if(!r)throw Error("Missing names");return {name:{tr:JSON.parse(r[1]),en:JSON.parse(r[2]),ru:JSON.parse(r[3])},end:r.index+r[0].length,start:r.index}};
 const sections=source.split("export const menuCategories = [");
 if(sections.length!==2)throw Error("Unknown catalog layout");
 const chunks=sections[1].split(/\n\s{2}\{\n\s{4}id:\s*"/).slice(1);
 const categories=[],products=[],ids=new Set();
 for(const chunk of chunks){
  const categoryId=chunk.match(/^([a-z0-9-]+)"/)?.[1];if(!categoryId)throw Error("Invalid category");
  const category=names(chunk);categories.push({id:categoryId,name:category.name});
  let cursor=category.end;
  for(const match of chunk.matchAll(/\bprice:\s*(\d+)\b/g)){
   const block=chunk.slice(cursor,match.index),item=names(block),explicit=block.slice(0,item.start).match(/\bid:\s*"([a-z0-9-]+)"/);
   const id=categoryId+":"+(explicit?.[1]??slug(item.name.en)),price=Number(match[1]);
   if(ids.has(id)||!Number.isSafeInteger(price)||price<=0)throw Error("Invalid catalog product");ids.add(id);
   const image=block.match(/\bimage:\s*"([^"]+)"/)?.[1]??"src/products/menu-v1/"+categoryId+"--"+slug(item.name.en)+".webp";
   if(!/^src\/products\/(?:menu-v1|sets-v1)\/[a-z0-9-]+\.webp$/.test(image))throw Error("Invalid image path");
   const variantsText=block.match(/\bvariants:\s*\[([\s\S]*?)\]/)?.[1]??"";
   const variants=[];
   for(const v of variantsText.matchAll(/\{\s*id:\s*"([a-z0-9-]+)",\s*(name:\s*\{[^}]+\})\s*\}/g))variants.push({id:v[1],name:names(v[2]).name});
   if(variantsText&&!variants.length)throw Error("Invalid variants");
   products.push({id,categoryId,name:item.name,priceMinor:price*100,currency:"TRY",sourceImage:image,variants});
   cursor=match.index+match[0].length;
  }
 }
 if(!categories.length||!products.length)throw Error("Empty catalog");
 return {categories,products};
}
// Deliberate pinned-source import. A new revision requires explicit review.
const revision="59f127c69983eae57215868679d8fa46bab89931",blob="3ce00ff364828cd8bbe205f500fa754f2c29a454";
const root=process.argv[2];if(!root)throw Error("Usage: node scripts/robys-catalog-sync.mjs <reviewed Robys checkout>");
const bytes=readFileSync(resolve(root,"menu-catalog.js"));
if(createHash("sha1").update("blob "+bytes.length+"\\0".replace("\\0","\0")).update(bytes).digest("hex")!==blob)throw Error("Wrong catalog source blob");
const parsed=parseCatalog(bytes.toString("utf8"));
for(const p of parsed.products){if(!existsSync(resolve(root,p.sourceImage))||!existsSync(resolve(root,"share/tr/"+p.id.replace(":","--")+".html")))throw Error("Missing source artifact: "+p.id)}
console.log("// Generated from immutable Robys catalog; regenerate with scripts/robys-catalog-sync.mjs.\\nexport const robysCatalog = ".replace("\\n","\n")+JSON.stringify({schema:"biteos.robys-public-catalog.v1",sourceRepository:"safal207/robys-coffee-house-demo",sourceRevision:revision,sourceBlob:blob,priceStatus:"published-catalog-not-live-verified",...parsed},null,2)+";");
