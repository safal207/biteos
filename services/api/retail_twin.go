package main

import (
 "net/http"
 "time"
)

// Counterfactual SKU-level day simulation. No write, prediction, or order effect.
type twinInput struct {
 ProductID string `json:"productId"`
 Days int `json:"days"`
 BaselineDailyUnits int `json:"baselineDailyUnits"`
 CampaignDailyUnits int `json:"campaignDailyUnits"`
 DiscountBPS int64 `json:"discountBps"`
 FulfillmentPerUnit int64 `json:"fulfillmentPerUnit"`
 CampaignCost int64 `json:"campaignCost"`
 IncludeUnknown bool `json:"includeUnknown"`
}
type twinLot struct{
 Quantity int `json:"quantity"`
 Cost int64 `json:"cost"`
 UseBy string `json:"useBy,omitempty"`
}
type twinProduct struct{
 ID string `json:"id"`
 Name map[string]string `json:"name"`
 Price int64 `json:"price"`
 Lots []twinLot `json:"lots"`
}
type twinDay struct{
 Date string `json:"date"`
 Demand int `json:"demand"`
 Sold int `json:"sold"`
 Unmet int `json:"unmet"`
 Remaining int `json:"remaining"`
 HeldValue int64 `json:"heldValue"`
 Contribution int64 `json:"contribution"`
}
type twinScenario struct{
 Price int64 `json:"price"`
 Sold int `json:"sold"`
 Unmet int `json:"unmet"`
 Revenue int64 `json:"revenue"`
 COGS int64 `json:"cogs"`
 Fulfillment int64 `json:"fulfillment"`
 CampaignCost int64 `json:"campaignCost"`
 Contribution int64 `json:"contribution"`
 Remaining int `json:"remaining"`
 HeldValue int64 `json:"heldValue"`
 UnknownValue int64 `json:"unknownValue"`
 Daily []twinDay `json:"daily"`
}
type twinResult struct{
 Demo bool `json:"demo"`
 Currency string `json:"currency"`
 AsOf string `json:"asOf"`
 ProductID string `json:"productId"`
 Baseline twinScenario `json:"baseline"`
 Campaign twinScenario `json:"campaign"`
 IncrementalContribution int64 `json:"incrementalContribution"`
 AvoidedHeldValue int64 `json:"avoidedHeldValue"`
}
func validTwinInput(i twinInput)bool{
 return i.ProductID!=""&&i.Days>=1&&i.Days<=30&&i.BaselineDailyUnits>=0&&i.BaselineDailyUnits<=1000&&i.CampaignDailyUnits>=0&&i.CampaignDailyUnits<=1000&&i.DiscountBPS>=0&&i.DiscountBPS<=9000&&i.FulfillmentPerUnit>=0&&i.FulfillmentPerUnit<=100000000&&i.CampaignCost>=0&&i.CampaignCost<=10000000000
}
func simulateTwin(p twinProduct,i twinInput,asOf string,demand int,price,expense int64)twinScenario{
 lots:=append([]twinLot(nil),p.Lots...)
 start,_:=time.Parse("2006-01-02",asOf)
 r:=twinScenario{Price:price,CampaignCost:expense,Daily:[]twinDay{},Contribution:-expense}
 for day:=0;day<i.Days;day++{
  date:=start.AddDate(0,0,day).Format("2006-01-02")
  d:=twinDay{Date:date,Demand:demand}
  need:=demand
  var cost int64
  for j:=range lots{
   l:=&lots[j]
   if need==0{break}
   if l.Quantity==0{continue}
   // Preserve FIFO barrier: no silent substitution or disposal. Unknown
   // dates block by default; opt-in allows fictional legacy stock only.
   if l.UseBy==""&&!i.IncludeUnknown||l.UseBy!=""&&lifetimeStatus(l.UseBy,date)=="HOLD"{break}
   take:=need;if take>l.Quantity{take=l.Quantity}
   l.Quantity-=take;need-=take;cost+=int64(take)*l.Cost
  }
  d.Sold=demand-need;d.Unmet=need
  r.Sold+=d.Sold;r.Unmet+=d.Unmet
  revenue:=int64(d.Sold)*price;fee:=int64(d.Sold)*i.FulfillmentPerUnit
  r.Revenue+=revenue;r.COGS+=cost;r.Fulfillment+=fee
  d.Contribution=revenue-cost-fee
  if day==0{d.Contribution-=expense}
  r.Contribution+=revenue-cost-fee
  r.Remaining=0;r.HeldValue=0;r.UnknownValue=0
  for _,l:=range lots{
   value:=int64(l.Quantity)*l.Cost;r.Remaining+=l.Quantity
   switch lifetimeStatus(l.UseBy,date){case "HOLD":r.HeldValue+=value;case "UNKNOWN":r.UnknownValue+=value}
  }
  d.Remaining=r.Remaining;d.HeldValue=r.HeldValue
  r.Daily=append(r.Daily,d)
 }
 return r
}
func calculateTwin(p twinProduct,i twinInput,asOf string)twinResult{
 a:=simulateTwin(p,i,asOf,i.BaselineDailyUnits,p.Price,0)
 b:=simulateTwin(p,i,asOf,i.CampaignDailyUnits,p.Price*(10000-i.DiscountBPS)/10000,i.CampaignCost)
 return twinResult{true,"TRY",asOf,p.ID,a,b,b.Contribution-a.Contribution,a.HeldValue-b.HeldValue}
}
func(e *retailEngine) twin(w http.ResponseWriter,r *http.Request){
 if r.Method!="GET"&&r.Method!="POST"{w.Header().Set("Allow","GET, POST");fail(w,405,"method not allowed");return}
 var in twinInput
 if r.Method=="POST"{
  if !retailDecode(w,r,&in){return}
  if !validTwinInput(in){fail(w,422,"invalid twin scenario");return}
 }
 e.mu.Lock();defer e.mu.Unlock()
 if e.storageFailed{fail(w,503,"storage recovery required");return}
 f,err:=e.financeProjection();if err!=nil{fail(w,503,"finance reconciliation unavailable");return}
 asOf:=lifetimeToday(time.Now())
 if !validLifetimeDay(asOf){fail(w,503,"unsupported simulation date");return}
 products:=[]twinProduct{}
 for _,p:=range e.products{
  if p.Price<1||p.Price>100000000{fail(w,503,"invalid catalog price");return}
  row:=twinProduct{ID:p.ID,Name:p.Name,Price:p.Price,Lots:[]twinLot{}}
  for _,l:=range f.availableLots[p.ID]{if l.qty>0{row.Lots=append(row.Lots,twinLot{l.qty,l.cost,l.useBy})}}
  if r.Method=="POST"&&p.ID==in.ProductID{respond(w,200,calculateTwin(row,in,asOf));return}
  products=append(products,row)
 }
 if r.Method=="POST"{fail(w,404,"unknown product");return}
 respond(w,200,map[string]any{"demo":true,"currency":"TRY","asOf":asOf,"products":products})
}
