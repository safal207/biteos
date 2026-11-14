package main

import (
 "net/http"
 "sort"
)

// A fictional road graph in meters. It deliberately contains no addresses,
// GPS, live travel information, or claimed real-world geography.
type spatialEdge struct { From string `json:"from"`; To string `json:"to"`; Meters int `json:"meters"` }
func spatialGraph()[]spatialEdge{
 return []spatialEdge{{"depot","A",1000},{"A","B",800},{"B","C",1800},{"C","D",1200},{"depot","C",3000},{"B","D",2400}}
}
var spatialNodes=[]string{"depot","A","B","C","D"}
func spatialDistances()map[string]map[string]int{
 d:=map[string]map[string]int{}
 for _,a:=range spatialNodes{d[a]=map[string]int{};for _,b:=range spatialNodes{if a!=b{d[a][b]=1000000}}}
 for _,e:=range spatialGraph(){d[e.From][e.To]=e.Meters;d[e.To][e.From]=e.Meters}
 for _,k:=range spatialNodes{for _,a:=range spatialNodes{for _,b:=range spatialNodes{if v:=d[a][k]+d[k][b];v<d[a][b]{d[a][b]=v}}}}
 return d
}
type spatialStop struct{
 ID string `json:"id"`
 Node string `json:"node"`
 Units int `json:"units"`
 Earliest int `json:"earliest"`
 Latest int `json:"latest"`
 Service int `json:"service"`
 Fee int64 `json:"fee"`
}
type spatialInput struct{
 Stops []spatialStop `json:"stops"`
 Couriers int `json:"couriers"`
 Capacity int `json:"capacity"`
 ShiftMinutes int `json:"shiftMinutes"`
 SpeedKMH int `json:"speedKmh"`
 CostPerKM int64 `json:"costPerKm"`
 CostPerMinute int64 `json:"costPerMinute"`
 FixedPerRoute int64 `json:"fixedPerRoute"`
}
type spatialVisit struct{
 ID string `json:"id"`
 Node string `json:"node"`
 Arrival int `json:"arrival"`
 Completion int `json:"completion"`
}
type spatialRoute struct{
 Visits []spatialVisit `json:"visits"`
 Meters int `json:"meters"`
 Minutes int `json:"minutes"`
 Units int `json:"units"`
 Fee int64 `json:"fee"`
 Cost int64 `json:"cost"`
 Contribution int64 `json:"contribution"`
}
type spatialPlan struct{
 Feasible bool `json:"feasible"`
 Routes []spatialRoute `json:"routes"`
 Meters int `json:"meters"`
 CourierMinutes int `json:"courierMinutes"`
 Makespan int `json:"makespan"`
 Fee int64 `json:"fee"`
 Cost int64 `json:"cost"`
 Contribution int64 `json:"contribution"`
}
type spatialResult struct{
 Demo bool `json:"demo"`
 Currency string `json:"currency"`
 Model string `json:"model"`
 Individual spatialPlan `json:"individual"`
 Grouped spatialPlan `json:"grouped"`
 SavedCost *int64 `json:"savedCost"`
 SavedMeters *int `json:"savedMeters"`
}
func validSpatial(i spatialInput)bool{
 if len(i.Stops)<1||len(i.Stops)>6||i.Couriers<1||i.Couriers>3||i.Capacity<1||i.Capacity>100||i.ShiftMinutes<1||i.ShiftMinutes>480||i.SpeedKMH<5||i.SpeedKMH>60||i.CostPerKM<0||i.CostPerKM>1000000||i.CostPerMinute<0||i.CostPerMinute>1000000||i.FixedPerRoute<0||i.FixedPerRoute>100000000{return false}
 seen:=map[string]bool{}
 for _,s:=range i.Stops{
  if len(s.ID)<1||len(s.ID)>32||seen[s.ID]||s.Node!="A"&&s.Node!="B"&&s.Node!="C"&&s.Node!="D"||s.Units<1||s.Units>100||s.Earliest<0||s.Latest>s.Earliest+480||s.Latest>i.ShiftMinutes||s.Earliest>s.Latest||s.Service<1||s.Service>60||s.Fee<0||s.Fee>100000000{return false}
  for _,c:=range s.ID{if !(c>='a'&&c<='z'||c>='A'&&c<='Z'||c>='0'&&c<='9'||c=='-'){return false}}
  seen[s.ID]=true
 }
 return true
}
func spatialTravel(meters,speed int)int{return int(ceilGrowth(int64(meters)*60,int64(speed)*1000))}
func spatialTour(i spatialInput,d map[string]map[string]int,seq []int)(spatialRoute,bool){
 r:=spatialRoute{Visits:[]spatialVisit{}}
 node:="depot";clock:=0
 for _,idx:=range seq{
  s:=i.Stops[idx];r.Units+=s.Units
  if r.Units>i.Capacity{return r,false}
  meters:=d[node][s.Node];r.Meters+=meters;clock+=spatialTravel(meters,i.SpeedKMH)
  arrival:=clock
  if clock<s.Earliest{clock=s.Earliest}
  clock+=s.Service
  if clock>s.Latest{return r,false}
  r.Visits=append(r.Visits,spatialVisit{s.ID,s.Node,arrival,clock});r.Fee+=s.Fee;node=s.Node
 }
 meters:=d[node]["depot"];r.Meters+=meters;clock+=spatialTravel(meters,i.SpeedKMH)
 if clock>i.ShiftMinutes{return r,false}
 r.Minutes=clock
 r.Cost=ceilGrowth(int64(r.Meters)*i.CostPerKM,1000)+int64(r.Minutes)*i.CostPerMinute+i.FixedPerRoute
 r.Contribution=r.Fee-r.Cost
 return r,true
}
func betterSpatialRoute(a,b spatialRoute)bool{
 if a.Cost!=b.Cost{return a.Cost<b.Cost}
 if a.Meters!=b.Meters{return a.Meters<b.Meters}
 return a.Minutes<b.Minutes
}
func joinSpatial(routes []spatialRoute)spatialPlan{
 p:=spatialPlan{Feasible:true,Routes:append([]spatialRoute{},routes...)}
 for _,r:=range routes{
  p.Meters+=r.Meters;p.CourierMinutes+=r.Minutes;p.Fee+=r.Fee;p.Cost+=r.Cost
  if r.Minutes>p.Makespan{p.Makespan=r.Minutes}
 }
 p.Contribution=p.Fee-p.Cost
 return p
}
func betterSpatialPlan(a,b spatialPlan)bool{
 if !b.Feasible{return true}
 if a.Cost!=b.Cost{return a.Cost<b.Cost}
 if a.Meters!=b.Meters{return a.Meters<b.Meters}
 if len(a.Routes)!=len(b.Routes){return len(a.Routes)<len(b.Routes)}
 return a.CourierMinutes<b.CourierMinutes
}
func calculateSpatial(i spatialInput)spatialResult{
 // Canonical order makes equal-cost decisions independent of request order.
 i.Stops=append([]spatialStop(nil),i.Stops...);sort.Slice(i.Stops,func(a,b int)bool{return i.Stops[a].ID<i.Stops[b].ID})
 d:=spatialDistances();all:=(1<<len(i.Stops))-1
 best:=map[int]spatialRoute{}
 var enumerate func(int,[]int)
 enumerate=func(mask int,seq []int){
  if mask!=0{if r,ok:=spatialTour(i,d,seq);ok{if old,exists:=best[mask];!exists||betterSpatialRoute(r,old){best[mask]=r}}}
  for idx:=range i.Stops{bit:=1<<idx;if mask&bit==0{enumerate(mask|bit,append(seq,idx))}}
 }
 enumerate(0,nil)
 result:=spatialResult{Demo:true,Currency:"TRY",Model:"fictional-shortest-distance-graph-v1"}
 singles:=[]spatialRoute{}
 for idx:=range i.Stops{if r,ok:=best[1<<idx];ok{singles=append(singles,r)}}
 if len(singles)==len(i.Stops){result.Individual=joinSpatial(singles)}
 var partition func(int,[]spatialRoute)
 partition=func(mask int,routes []spatialRoute){
  if mask==0{p:=joinSpatial(routes);if betterSpatialPlan(p,result.Grouped){result.Grouped=p};return}
  if len(routes)>=i.Couriers{return}
  first:=mask&-mask
  for sub:=mask;sub>0;sub=(sub-1)&mask{
   if sub&first==0{continue}
   if r,ok:=best[sub];ok{partition(mask^sub,append(routes,r))}
  }
 }
 partition(all,nil)
 if result.Individual.Feasible&&result.Grouped.Feasible{
  cost:=result.Individual.Cost-result.Grouped.Cost;meters:=result.Individual.Meters-result.Grouped.Meters
  result.SavedCost=&cost;result.SavedMeters=&meters
 }
 return result
}
func(e *retailEngine) spatial(w http.ResponseWriter,r *http.Request){
 if r.Method=="GET"{respond(w,200,map[string]any{"demo":true,"nodes":spatialNodes,"edges":spatialGraph(),"currency":"TRY"});return}
 if !method(w,r,"POST"){return}
 var i spatialInput
 if !retailDecode(w,r,&i){return}
 if !validSpatial(i){fail(w,422,"invalid spatial scenario");return}
 respond(w,200,calculateSpatial(i))
}
