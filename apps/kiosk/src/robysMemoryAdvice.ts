// One-shot use of existing device memory. No writes, automatic sharing or identity.
import {readMemory} from "./robysMemory.ts";
import {productPreferences} from "./robysBrandAgent.ts";
import {soundsAdvice} from "./robysSoundsAdvice.ts";
import {robysCatalog} from "./robysPublicCatalog.ts";

const ids=robysCatalog.products.map(p=>p.id);
const invalid=()=>new Error("Invalid or stale memory selection");

// Caller supplies the existing local-memory reader. Read only after explicit
// opt-in and explicit selection. Do not send the journal to any service.
export function memorySoundsAdvice(raw:unknown,readLocal:()=>string|null,now:number){
 if(typeof raw!=="object"||raw===null||Array.isArray(raw))throw invalid();
 const r=raw as Record<string,unknown>;
 // Validate the complete request using the existing strict boundary first.
 const advice=soundsAdvice(raw);
 if(r.usePreferences!==true)return {...advice,memoryUsed:false};
 const favorites=r.favoriteIds as string[],avoided=r.avoidIds as string[];
 if(!favorites.length&&!avoided.length)return {...advice,memoryUsed:false};
 let memory:ReturnType<typeof readMemory>;
 try{memory=readMemory(readLocal(),now,ids)}catch{throw invalid()}
 if(!memory)throw invalid();
 const current=productPreferences(memory.events,ids);
 if(favorites.some(id=>!current.favorites.includes(id))||avoided.some(id=>!current.avoided.includes(id)))throw invalid();
 return {...advice,memoryUsed:true};
}
