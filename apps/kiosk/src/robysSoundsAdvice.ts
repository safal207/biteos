// Explicit one-shot bridge. Music genre and visual layout never enter ranking.
import {clubAdvice} from "./robysClubAdvice.ts";
import type {Intent} from "./robysContext.ts";

export const soundMoments={
 morning:{adaptive:"fresh",intent:"any"},
 focus:{adaptive:"study",intent:"study"},
 calm:{adaptive:"cozy",intent:"quiet"},
 friends:{adaptive:"friends",intent:"friends"},
 evening:{adaptive:"cozy",intent:"quiet"}
} as const satisfies Record<string,{adaptive:string,intent:Intent}>;
export type SoundMoment=keyof typeof soundMoments;
const fields=["schema","catalogRevision","usePreferences","moment","favoriteIds","avoidIds","unavailableIds","day","hour","weather","budgetMinor"];
const invalid=()=>new Error("Invalid Sounds advice request");
export function soundsAdvice(raw:unknown){
 if(typeof raw!=="object"||raw===null||Array.isArray(raw)||Object.keys(raw).length!==fields.length||!fields.every(k=>Object.hasOwn(raw,k)))throw invalid();
 const r=raw as Record<string,unknown>;
 if(r.schema!=="robys.sounds-advice.v1"||typeof r.usePreferences!=="boolean")throw invalid();
 if(r.usePreferences?(typeof r.moment!=="string"||!Object.hasOwn(soundMoments,r.moment)):r.moment!==null)throw invalid();
 const moment=r.usePreferences?soundMoments[r.moment as SoundMoment]:null;
 const advice=clubAdvice({schema:"robys.club-advice.v1",catalogRevision:r.catalogRevision,
  usePreferences:r.usePreferences,favoriteIds:r.favoriteIds,avoidIds:r.avoidIds,
  unavailableIds:r.unavailableIds,day:r.day,hour:r.hour,weather:r.weather,
  budgetMinor:r.budgetMinor,intent:moment?.intent??"any"});
 return {...advice,contextSource:"explicit-sounds-moment" as const,
  musicDataRead:false,deviceAppsRead:false,purchasesRead:false};
}
