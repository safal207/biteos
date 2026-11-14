package main

import (
 "net/http"
 "sort"
)

type growthInput struct {
 ProductID string `json:"productId"`
 DiscountBPS int64 `json:"discountBps"`
 MinMarginBPS int64 `json:"minMarginBps"`
 BaselineUnits int64 `json:"baselineUnits"`
 ExpectedUnits int64 `json:"expectedUnits"`
 CampaignCost int64 `json:"campaignCost"`
}
type growthPlan struct {
 Demo bool `json:"demo"`
 Currency string `json:"currency"`
 ProductID string `json:"productId"`
 Available int `json:"available"`
 BasePrice int64 `json:"basePrice"`
 Cost int64 `json:"cost"`
 SalePrice int64 `json:"salePrice"`
 MinPrice int64 `json:"minPrice"`
 MaxDiscountBPS int64 `json:"maxDiscountBps"`
 UnitProfit int64 `json:"unitProfit"`
 BaselineProfit int64 `json:"baselineProfit"`
 ExpectedProfit int64 `json:"expectedProfit"`
 IncrementalProfit int64 `json:"incrementalProfit"`
 BreakEvenUnits *int64 `json:"breakEvenUnits"`
 Decision string `json:"decision"`
}
func ceilGrowth(n,d int64)int64{return (n+d-1)/d}

func calculateGrowth(p retailProduct,cost int64,in growthInput)growthPlan{
 r:=growthPlan{Demo:true,Currency:"TRY",ProductID:p.ID,Available:p.Stock,BasePrice:p.Price,Cost:cost,Decision:"NO_STOCK"}
 if p.Stock<=0||cost<=0{return r}
 r.SalePrice=p.Price*(10000-in.DiscountBPS)/10000
 r.MinPrice=ceilGrowth(cost*10000,10000-in.MinMarginBPS)
 if r.MinPrice<=p.Price{r.MaxDiscountBPS=(p.Price-r.MinPrice)*10000/p.Price}
 r.UnitProfit=r.SalePrice-cost
 r.BaselineProfit=in.BaselineUnits*(p.Price-cost)
 r.ExpectedProfit=in.ExpectedUnits*r.UnitProfit-in.CampaignCost
 r.IncrementalProfit=r.ExpectedProfit-r.BaselineProfit
 if r.UnitProfit>0{
  target:=r.BaselineProfit+in.CampaignCost
  if target<0{target=0}
  n:=ceilGrowth(target,r.UnitProfit)
  r.BreakEvenUnits=&n
 }
 switch{
 case r.SalePrice<r.MinPrice||r.UnitProfit<=0:r.Decision="MARGIN_BLOCK"
 case in.BaselineUnits>int64(p.Stock)||in.ExpectedUnits>int64(p.Stock):r.Decision="STOCK_BLOCK"
 case r.BreakEvenUnits==nil||*r.BreakEvenUnits>int64(p.Stock):r.Decision="BREAK_EVEN_UNREACHABLE"
 case r.IncrementalProfit<0:r.Decision="REVIEW_VOLUME"
 default:r.Decision="SCENARIO_VIABLE"
 }
 return r
}

type growthPair struct{
 First string `json:"first"`
 Second string `json:"second"`
 Orders int `json:"orders"`
}
func(e *retailEngine) growth(w http.ResponseWriter,r *http.Request){
 if r.Method!="GET"&&r.Method!="POST"{w.Header().Set("Allow","GET, POST");fail(w,405,"method not allowed");return}
 var in growthInput
 if r.Method=="POST"{
  if !retailDecode(w,r,&in){return}
  if in.ProductID==""||in.DiscountBPS<0||in.DiscountBPS>9000||in.MinMarginBPS<0||in.MinMarginBPS>9000||in.BaselineUnits<0||in.BaselineUnits>100000||in.ExpectedUnits<1||in.ExpectedUnits>100000||in.CampaignCost<0||in.CampaignCost>10000000000{fail(w,422,"invalid promotion scenario");return}
 }
 e.mu.Lock()
 defer e.mu.Unlock()
 if e.storageFailed{fail(w,503,"storage recovery required");return}
 f,err:=e.financeProjection()
 if err!=nil{fail(w,503,"finance reconciliation unavailable");return}
 costs:=map[string]int64{}
 for _,p:=range f.Products{costs[p.ID]=p.MaxAvailableUnitCost}
 if r.Method=="POST"{
  for _,p:=range e.products{if p.ID==in.ProductID{
   if p.Price<1||p.Price>100000000||costs[p.ID]>100000000{fail(w,503,"invalid price or cost");return}
   respond(w,200,calculateGrowth(p,costs[p.ID],in));return
  }}
  fail(w,404,"unknown product");return
 }
 // Co-purchases from completed orders only. Descriptive counts, not causal lift.
 counts:=map[[2]string]int{}
 for _,o:=range e.orders{
  if !(o.Mode=="pickup"&&o.Status=="collected"||o.Mode=="delivery"&&o.Status=="delivered"){continue}
  ids:=[]string{}
  for _,l:=range o.Lines{ids=append(ids,l.ID)}
  sort.Strings(ids)
  for i:=0;i<len(ids);i++{for j:=i+1;j<len(ids);j++{counts[[2]string{ids[i],ids[j]}]++}}
 }
 pairs:=[]growthPair{}
 for p,n:=range counts{if n>=2{pairs=append(pairs,growthPair{p[0],p[1],n})}}
 sort.Slice(pairs,func(i,j int)bool{if pairs[i].Orders!=pairs[j].Orders{return pairs[i].Orders>pairs[j].Orders};if pairs[i].First!=pairs[j].First{return pairs[i].First<pairs[j].First};return pairs[i].Second<pairs[j].Second})
 type candidate struct{ID string `json:"id"`;Name map[string]string `json:"name"`;Price int64 `json:"price"`;Stock int `json:"stock"`;Cost int64 `json:"cost"`}
 products:=[]candidate{}
 for _,p:=range e.products{products=append(products,candidate{p.ID,p.Name,p.Price,p.Stock,costs[p.ID]})}
 respond(w,200,map[string]any{"demo":true,"currency":"TRY","products":products,"pairs":pairs,"fulfilled":f.Fulfilled,"minimumPairOrders":2})
}
