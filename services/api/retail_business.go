package main

import (
 "crypto/sha256"
 "crypto/subtle"
 "net/http"
 "os"
 "sort"
 "time"
)

var businessRoles=[]string{"owner","admin","seller","warehouse","courier"}
func businessRoleEnv(role string)string{
 switch role{case "owner":return "BITEOS_OWNER_TOKEN";case "admin":return "BITEOS_ADMIN_TOKEN";case "seller":return "BITEOS_SELLER_TOKEN";case "warehouse":return "BITEOS_WAREHOUSE_TOKEN";case "courier":return "BITEOS_COURIER_TOKEN"}
 return ""
}
// Separate opt-in credentials for the new read-only endpoint only.
// Legacy routes remain local demo routes, not protected by this policy.
func businessRoleToken(role string)(string,bool){
 env:=businessRoleEnv(role);if env==""{return "",false}
 token:=os.Getenv(env)
 if len(token)<32||token==os.Getenv("BITEOS_REVIEW_TOKEN"){return "",false}
 for _,other:=range businessRoles{if other!=role&&token==os.Getenv(businessRoleEnv(other)){return "",false}}
 return token,true
}
func businessAuthorized(r *http.Request,token string)bool{
 want:=sha256.Sum256([]byte("Bearer "+token));got:=sha256.Sum256([]byte(r.Header.Get("Authorization")))
 return subtle.ConstantTimeCompare(want[:],got[:])==1
}
type businessQueueRow struct{
 ID string `json:"id"`
 Status string `json:"status"`
 Mode string `json:"mode"`
 Zone string `json:"zone,omitempty"`
 Slot string `json:"slot,omitempty"`
 Units int `json:"units"`
 Held bool `json:"held"`
 Items []retailItem `json:"items,omitempty"`
}
type businessMetric struct{
 Key string `json:"key"`
 Value int64 `json:"value"`
 Unit string `json:"unit"`
}
type businessReport struct{
 Demo bool `json:"demo"`
 Role string `json:"role"`
 AsOf string `json:"asOf"`
 Mode string `json:"mode"`
 ExternalEffectsAuthorized bool `json:"externalEffectsAuthorized"`
 Metrics []businessMetric `json:"metrics"`
 Queue []businessQueueRow `json:"queue"`
 Decisions []brainDecision `json:"decisions,omitempty"`
}
func businessVisible(role string,o retailOrder)bool{
 switch role{
 case "owner","admin":return o.Status!="cancelled"&&o.Status!="collected"&&o.Status!="delivered"
 case "seller":return o.Mode=="pickup"&&o.Status=="packed"
 case "warehouse":return o.Status=="reserved"||o.Status=="picking"
 case "courier":return o.Mode=="delivery"&&(o.Status=="packed"||o.Status=="in_transit")
 }
 return false
}
// Called under engine mutex. Views are deliberately narrower than raw order data.
func(e *retailEngine) businessProjection(role string,f financeReport,today string)businessReport{
 r:=businessReport{Demo:true,Role:role,AsOf:today,Mode:"read-only",Metrics:[]businessMetric{},Queue:[]businessQueueRow{}}
 for _,o:=range e.orders{
  if !businessVisible(role,o){continue}
  row:=businessQueueRow{ID:o.ID,Status:o.Status,Mode:o.Mode,Held:f.orderUseBy[o.ID]!=""&&lifetimeStatus(f.orderUseBy[o.ID],today)=="HOLD"}
  if role=="courier"||role=="admin"||role=="owner"{row.Zone=o.ZoneID;row.Slot=o.SlotID}
  for _,l:=range o.Lines{
   row.Units+=l.Quantity
   if role=="warehouse"||role=="seller"{row.Items=append(row.Items,retailItem{ID:l.ID,Quantity:l.Quantity})}
  }
  r.Queue=append(r.Queue,row)
 }
 sort.Slice(r.Queue,func(i,j int)bool{a,b:=r.Queue[i],r.Queue[j];if a.Held!=b.Held{return a.Held};return a.ID<b.ID})
 r.Metrics=append(r.Metrics,businessMetric{"queue",int64(len(r.Queue)),"count"})
 var held int64
 for _,o:=range r.Queue{if o.Held{held++}}
 r.Metrics=append(r.Metrics,businessMetric{"held",held,"count"})
 if role=="owner"{
  r.Metrics=append(r.Metrics,businessMetric{"fulfilled",int64(f.Fulfilled),"count"},businessMetric{"revenue",f.Revenue,"TRY-minor"},businessMetric{"contribution",f.Contribution,"TRY-minor"})
  r.Decisions=e.brainProjection(f,today).Decisions
 }else if role=="admin"{
  r.Metrics=append(r.Metrics,businessMetric{"fulfilled",int64(f.Fulfilled),"count"},businessMetric{"cancelled",int64(f.Cancelled),"count"})
  for _,d:=range e.brainProjection(f,today).Decisions{if d.Priority<=1{filtered:=d;filtered.Facts=[]brainFact{};for _,fact:=range d.Facts{if fact.Unit!="TRY-minor"{filtered.Facts=append(filtered.Facts,fact)}};r.Decisions=append(r.Decisions,filtered)}}
 }
 return r
}
func(e *retailEngine) business(w http.ResponseWriter,r *http.Request){
 if !method(w,r,"GET"){return}
 w.Header().Set("Cache-Control","no-store")
 role:=r.URL.Query().Get("role")
 if businessRoleEnv(role)==""{fail(w,400,"unknown workspace");return}
 token,enabled:=businessRoleToken(role)
 if !enabled{fail(w,503,"workspace disabled");return}
 if !businessAuthorized(r,token){fail(w,401,"workspace credential required");return}
 e.mu.Lock();defer e.mu.Unlock()
 if e.storageFailed{fail(w,503,"storage recovery required");return}
 f,err:=e.financeProjection();if err!=nil{fail(w,503,"finance reconciliation unavailable");return}
 respond(w,200,e.businessProjection(role,f,lifetimeToday(time.Now())))
}
