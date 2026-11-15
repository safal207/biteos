// Explicit public appearance choices only. No account, personal profile or activity log.
export const palettes={
 auto:{names:["Temaya göre","По теме","Match theme"],colors:null},
 espresso:{names:["Espresso","Эспрессо","Espresso"],colors:["#422c23","#fff2de","#c89969","#f8eadc"]},
 forest:{names:["Orman","Лес","Forest"],colors:["#244438","#f1f9e9","#88ae91","#e9f0e5"]},
 rose:{names:["Gül","Роза","Rose"],colors:["#71394e","#fff2f8","#d28bad","#fae9ef"]},
 coast:{names:["Akdeniz","Средиземноморье","Mediterranean"],colors:["#1c5152","#eafffb","#79b9b5","#e2f3f0"]},
 amber:{names:["Kehribar","Янтарь","Amber"],colors:["#66431c","#fff1ce","#c99654","#fcf0d6"]}
} as const;
export type Palette=keyof typeof palettes;
export type Density="airy"|"compact";
export type Style={palette:Palette;density:Density;discoveries:boolean};
export const styleKey="biteos.robys.appearance.v1";
export const defaultStyle=():Style=>({palette:"auto",density:"airy",discoveries:true});
export function decodeStyle(raw:unknown):Style|null{
 if(!raw||typeof raw!=="object"||Array.isArray(raw))return null;
 const x=raw as Record<string,unknown>;
 if(Object.keys(x).length!==3||typeof x.palette!=="string"||!Object.hasOwn(palettes,x.palette)||!["airy","compact"].includes(String(x.density))||typeof x.density!=="string"||typeof x.discoveries!=="boolean")return null;
 return {palette:x.palette as Palette,density:x.density as Density,discoveries:x.discoveries};
}
export function loadStyle(raw:string|null):Style|null{try{return raw===null?null:decodeStyle(JSON.parse(raw))}catch{return null}}
// Explicit share link overrides saved appearance for this visit only.
export function styleFromLink(href:string):Style|null{
 const p=new URL(href).searchParams;
 if(!p.has("robysPalette")&&!p.has("robysDensity")&&!p.has("robysDiscover"))return null;
 if(["robysPalette","robysDensity","robysDiscover"].some(k=>p.getAll(k).length!==1))return null;
 const d=p.get("robysDiscover");if(d!=="on"&&d!=="off")return null;
 return decodeStyle({palette:p.get("robysPalette"),density:p.get("robysDensity"),discoveries:d==="on"});
}
export function shareStyle(href:string,style:Style){
 const x=decodeStyle(style),u=new URL(href);if(!x||!["http:","https:"].includes(u.protocol)||u.username||u.password)throw Error("Invalid style link");
 const mood=u.searchParams.get("robysMood"),layout=u.searchParams.get("robysLayout");u.search="";
 if(mood&&["standard","cozy","study","friends","family","fresh"].includes(mood))u.searchParams.set("robysMood",mood);
 if(layout&&["classic","reels","gallery","channels"].includes(layout))u.searchParams.set("robysLayout",layout);
 u.searchParams.set("robysPalette",x.palette);u.searchParams.set("robysDensity",x.density);u.searchParams.set("robysDiscover",x.discoveries?"on":"off");u.hash="#retail-robys-experience";
 return u.href;
}
