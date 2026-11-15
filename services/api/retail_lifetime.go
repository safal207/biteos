package main

import (
 "net/http"
 "sort"
 "time"
)

func lifetimeToday(now time.Time)string{return now.In(time.FixedZone("TRT",3*60*60)).Format("2006-01-02")}
func validLifetimeDay(day string)bool{
 t,err:=time.Parse("2006-01-02",day)
 return err==nil&&t.Format("2006-01-02")==day&&day>="2000-01-01"&&day<="2099-12-31"
}
func lifetimeStatus(day,today string)string{
 if !validLifetimeDay(day)||!validLifetimeDay(today){return "UNKNOWN"}
 if day<=today{return "HOLD"}
 t,_:=time.Parse("2006-01-02",today)
 if day<=t.AddDate(0,0,2).Format("2006-01-02"){return "REVIEW_SOON"}
 return "DATED"
}
// Known use-by date is a conservative gate, not a food-safety guarantee.
// Undated opening and legacy lots remain usable in this fictional demo only.
func lifetimeCanReserve(lots []*financeLot,quantity int,today string)bool{
 for _,l:=range lots{
  if quantity<=0{break}
  if l.qty<=0{continue}
  if l.useBy!=""&&lifetimeStatus(l.useBy,today)=="HOLD"{return false}
  quantity-=l.qty
 }
 return quantity<=0
}

type lifetimeRow struct {
 LotID string `json:"lotId"`
 ProductID string `json:"productId"`
 Name map[string]string `json:"name"`
 Quantity int `json:"quantity"`
 UseBy string `json:"useBy,omitempty"`
 Status string `json:"status"`
 CostValue int64 `json:"costValue"`
 UnitCost int64 `json:"unitCost"`
 Price int64 `json:"price"`
 ReviewPrice int64 `json:"reviewPrice"`
 ReviewEligible bool `json:"reviewEligible"`
}
type lifetimeReport struct{
 Demo bool `json:"demo"`
 Currency string `json:"currency"`
 AsOf string `json:"asOf"`
 Rows []lifetimeRow `json:"rows"`
 UnknownValue int64 `json:"unknownValue"`
 HeldValue int64 `json:"heldValue"`
 ReviewValue int64 `json:"reviewValue"`
}
func(e *retailEngine) lifetimeProjection(f financeReport,today string)lifetimeReport{
 r:=lifetimeReport{Demo:true,Currency:"TRY",AsOf:today,Rows:[]lifetimeRow{}}
 for _,p:=range e.products{for _,l:=range f.availableLots[p.ID]{
  if l.qty<=0{continue}
  row:=lifetimeRow{LotID:l.id,ProductID:p.ID,Name:p.Name,Quantity:l.qty,UseBy:l.useBy,Status:lifetimeStatus(l.useBy,today),CostValue:int64(l.qty)*l.cost,UnitCost:l.cost,Price:p.Price}
  switch row.Status {
  case "UNKNOWN":r.UnknownValue+=row.CostValue
  case "HOLD":r.HeldValue+=row.CostValue
  case "REVIEW_SOON":
   r.ReviewValue+=row.CostValue
   candidate:=p.Price*80/100
   floor:=ceilGrowth(l.cost*10000,9000) // illustrative 10% gross-margin floor
   if candidate>=floor&&candidate<p.Price&&candidate>l.cost{row.ReviewPrice=candidate;row.ReviewEligible=true}
  }
  r.Rows=append(r.Rows,row)
 }}
 sort.SliceStable(r.Rows,func(i,j int)bool{
  rank:=map[string]int{"HOLD":0,"UNKNOWN":1,"REVIEW_SOON":2,"DATED":3}
  a,b:=r.Rows[i],r.Rows[j]
  if a.Status!=b.Status{return rank[a.Status]<rank[b.Status]}
  if a.UseBy!=b.UseBy{return a.UseBy<b.UseBy}
  return a.LotID<b.LotID
 })
 return r
}
func(e *retailEngine) lifetime(w http.ResponseWriter,r *http.Request){
 if !method(w,r,"GET"){return}
 e.mu.Lock();defer e.mu.Unlock()
 if e.storageFailed{fail(w,503,"storage recovery required");return}
 f,err:=e.financeProjection()
 if err!=nil{fail(w,503,"finance reconciliation unavailable");return}
 respond(w,200,e.lifetimeProjection(f,lifetimeToday(time.Now())))
}
