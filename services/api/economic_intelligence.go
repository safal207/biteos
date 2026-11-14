package main

import (
 "encoding/json"
 "errors"
 "net/http"
)

// Explicit counterfactual inputs. Neither visits nor ingredient budgets are
// inferred from customer tracking or from the unrelated retail SKU ledger.
type economicWindow struct {
 ID string `json:"id"`
 Day int `json:"day"`
 Channel string `json:"channel"`
 Visits int64 `json:"visits"`
 BaselineConversionBPS int64 `json:"baselineConversionBps"`
 CampaignConversionBPS int64 `json:"campaignConversionBps"`
 Capacity int64 `json:"capacity"`
 OtherCostPerUnit int64 `json:"otherCostPerUnit"`
}
type economicInput struct {
 Selection universalQuoteInput `json:"selection"`
 Days int `json:"days"`
 DiscountBPS int64 `json:"discountBps"`
 MinMarginBPS int64 `json:"minMarginBps"`
 CampaignCost int64 `json:"campaignCost"`
 IngredientBudget map[string]int64 `json:"ingredientBudget"`
 Windows []economicWindow `json:"windows"`
}
type economicRow struct{
 ID string `json:"id"`
 Day int `json:"day"`
 Channel string `json:"channel"`
 Demand int64 `json:"demand"`
 Sold int64 `json:"sold"`
 Unmet int64 `json:"unmet"`
 UnitContribution int64 `json:"unitContribution"`
 Revenue int64 `json:"revenue"`
 IngredientCost int64 `json:"ingredientCost"`
 OtherCost int64 `json:"otherCost"`
 Contribution int64 `json:"contribution"`
 Limit string `json:"limit"`
}
type economicScenario struct{
 Price int64 `json:"price"`
 Demand int64 `json:"demand"`
 Sold int64 `json:"sold"`
 Unmet int64 `json:"unmet"`
 Revenue int64 `json:"revenue"`
 IngredientCost int64 `json:"ingredientCost"`
 OtherCost int64 `json:"otherCost"`
 CampaignCost int64 `json:"campaignCost"`
 Contribution int64 `json:"contribution"`
 Remaining map[string]int64 `json:"remaining"`
 Rows []economicRow `json:"rows"`
}
type economicReport struct{
 Version int `json:"version"`
 Demo bool `json:"demo"`
 TenantID string `json:"tenantId"`
 Currency string `json:"currency"`
 Recipe recipeSnapshot `json:"recipe"`
 Assumptions economicInput `json:"assumptions"`
 Baseline economicScenario `json:"baseline"`
 Campaign economicScenario `json:"campaign"`
 IncrementalContribution int64 `json:"incrementalContribution"`
 Decision string `json:"decision"`
 Digest string `json:"digest"`
 ExternalEffectsAuthorized bool `json:"externalEffectsAuthorized"`
}
func validEconomicInput(i economicInput,r recipeCostReport)bool{
 if i.Selection.Quantity!=1||i.Days<1||i.Days>7||i.DiscountBPS<0||i.DiscountBPS>9000||i.MinMarginBPS<0||i.MinMarginBPS>9000||i.CampaignCost<0||i.CampaignCost>10000000000||len(i.Windows)<1||len(i.Windows)>21||len(i.IngredientBudget)!=len(r.Lines)||r.DirectCost<1||r.DirectCost>100000000{return false}
 for _,l:=range r.Lines{v,ok:=i.IngredientBudget[l.IngredientID];if !ok||v<0||v>1000000000000{return false}}
 ids:=map[string]bool{};day:=0
 for _,w:=range i.Windows{
  if !validTenantID(w.ID)||ids[w.ID]||w.Day<1||w.Day>i.Days||w.Day<day||w.Visits<0||w.Visits>100000||w.BaselineConversionBPS<0||w.BaselineConversionBPS>10000||w.CampaignConversionBPS<0||w.CampaignConversionBPS>10000||w.Capacity<0||w.Capacity>10000||w.OtherCostPerUnit<0||w.OtherCostPerUnit>100000000{return false}
  switch w.Channel{case "counter","pickup","delivery":default:return false}
  day=w.Day;ids[w.ID]=true
 }
 return true
}
func simulateEconomics(i economicInput,r recipeCostReport,promo bool)economicScenario{
 s:=economicScenario{Price:r.Quote.UnitPrice,Remaining:map[string]int64{},Rows:[]economicRow{}}
 if promo{s.Price=s.Price*(10000-i.DiscountBPS)/10000;s.CampaignCost=i.CampaignCost}
 for k,v:=range i.IngredientBudget{s.Remaining[k]=v}
 for _,w:=range i.Windows{
  conv:=w.BaselineConversionBPS;if promo{conv=w.CampaignConversionBPS}
  row:=economicRow{ID:w.ID,Day:w.Day,Channel:w.Channel,Demand:w.Visits*conv/10000,UnitContribution:s.Price-r.DirectCost-w.OtherCostPerUnit,Limit:"demand"}
  row.Sold=row.Demand
  if row.Sold>w.Capacity{row.Sold=w.Capacity;row.Limit="capacity"}
  for _,l:=range r.Lines{
   max:=s.Remaining[l.IngredientID]/l.QuantityPerItem
   if max<row.Sold{row.Sold=max;row.Limit="ingredients"}
  }
  for _,l:=range r.Lines{s.Remaining[l.IngredientID]-=row.Sold*l.QuantityPerItem}
  row.Unmet=row.Demand-row.Sold;row.Revenue=row.Sold*s.Price
  row.IngredientCost=row.Sold*r.DirectCost;row.OtherCost=row.Sold*w.OtherCostPerUnit
  row.Contribution=row.Revenue-row.IngredientCost-row.OtherCost
  s.Demand+=row.Demand;s.Sold+=row.Sold;s.Unmet+=row.Unmet;s.Revenue+=row.Revenue;s.IngredientCost+=row.IngredientCost;s.OtherCost+=row.OtherCost;s.Contribution+=row.Contribution
  s.Rows=append(s.Rows,row)
 }
 s.Contribution-=s.CampaignCost
 return s
}
func economicDigest(r economicReport)string{r.Digest="";raw,_:=json.Marshal(r);return checkpointDigest(raw)}
func calculateEconomic(c universalCatalog,b recipeBook,i economicInput)(economicReport,error){
 s,err:=buildRecipeSnapshot(c,b,i.Selection)
 if err!=nil{return economicReport{},err}
 return economicFromSnapshot(s,i,c.TenantID)
}
func economicFromSnapshot(s recipeSnapshot,i economicInput,tenant string)(economicReport,error){
 r:=economicReport{Version:1,Demo:true,TenantID:tenant,Currency:"TRY"}
 if !validRecipeSnapshot(s,tenant)||!validEconomicInput(i,s.Report){return r,errors.New("invalid or unsupported economic scenario")}
 i.Selection=s.Selection
 r.Recipe=s;r.Assumptions=i
 r.Baseline=simulateEconomics(i,s.Report,false);r.Campaign=simulateEconomics(i,s.Report,true)
 r.IncrementalContribution=r.Campaign.Contribution-r.Baseline.Contribution
 marginBlock:=false
 for _,w:=range r.Campaign.Rows{
  if w.Demand>0&&(w.UnitContribution<=0||w.UnitContribution*10000<r.Campaign.Price*i.MinMarginBPS){marginBlock=true}
 }
 switch{
 case marginBlock:r.Decision="MARGIN_BLOCK"
 case r.Campaign.Sold==0:r.Decision="NO_FEASIBLE_SALES"
 case r.IncrementalContribution<=0:r.Decision="REVIEW_ECONOMICS"
 case r.Campaign.Unmet>0:r.Decision="REVIEW_CAPACITY"
 default:r.Decision="SCENARIO_REVIEW"
 }
 r.Digest=economicDigest(r)
 return r,nil
}
func serveEconomic(w http.ResponseWriter,r *http.Request,entry tenantEntry){
 var in economicInput
 if !retailDecode(w,r,&in){return}
 result,err:=calculateEconomic(entry.catalog,entry.recipes,in)
 if err!=nil{fail(w,422,err.Error());return}
 respond(w,200,result)
}
