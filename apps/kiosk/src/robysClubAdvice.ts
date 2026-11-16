// One-shot, local advisory boundary. No account, telemetry, storage or network.
import { projectContext, type Context } from "./robysContext.ts";
import { brandDecision } from "./robysBrandAgent.ts";
import { robysCatalog } from "./robysPublicCatalog.ts";

const keys=["schema","catalogRevision","usePreferences","favoriteIds","avoidIds","unavailableIds","day","hour","weather","intent","budgetMinor"];
const exact=(raw:unknown):raw is Record<string,unknown>=>typeof raw==="object"&&raw!==null&&!Array.isArray(raw)&&Object.keys(raw).length===keys.length&&keys.every(k=>Object.hasOwn(raw,k));
const catalog=robysCatalog.products;
const ids=new Set<string>(catalog.map(p=>p.id));
const invalid=()=>new Error("Invalid one-shot club advice");
function selections(raw:unknown):string[]{
 if(!Array.isArray(raw)||raw.length>32||!raw.every(v=>typeof v==="string"&&ids.has(v))||new Set(raw).size!==raw.length)throw invalid();
 return [...raw];
}
export function clubAdvice(raw:unknown){
 if(!exact(raw)||raw.schema!=="robys.club-advice.v1"||raw.catalogRevision!==robysCatalog.sourceRevision||typeof raw.usePreferences!=="boolean")throw invalid();
 const favorites=selections(raw.favoriteIds),avoided=selections(raw.avoidIds),unavailable=selections(raw.unavailableIds);
 if(favorites.some(id=>avoided.includes(id)))throw invalid();
 if(typeof raw.day!=="string"||typeof raw.hour!=="number"||typeof raw.weather!=="string"||typeof raw.intent!=="string"||raw.budgetMinor!==null&&(typeof raw.budgetMinor!=="number"||!Number.isSafeInteger(raw.budgetMinor)||raw.budgetMinor<0||raw.budgetMinor>100000000))throw invalid();
 if(!raw.usePreferences&&(favorites.length||avoided.length))throw invalid();
 const active=raw.usePreferences&&favorites.length+avoided.length>0;
 const input:Context={day:raw.day,hour:raw.hour,weather:raw.weather as Context["weather"],intent:raw.intent as Context["intent"],budgetMinor:raw.budgetMinor,favoriteIds:favorites,unavailableIds:[...new Set([...unavailable,...avoided])]};
 const context=projectContext(input,catalog);
 const decision=brandDecision({blocked:context.blocked,budgetMinor:input.budgetMinor,
  ranked:active?context.items:[],catalog,avoided,unavailable,basis:{}});
 return {...decision,source:"explicit-one-shot-selection" as const,catalogRevision:robysCatalog.sourceRevision,
  retained:false,identityLinked:false,marketingAuthorized:false};
}
