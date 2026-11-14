package main

import (
 "crypto/sha256"
 "encoding/hex"
 "errors"
 "net/http"
 "time"
)

// Interest signals are not orders, unique customers or verified demand.
// Fixed illustrative candidates avoid collecting free-text personal data.
type demandCandidate struct {
 ID string `json:"id"`
 Name map[string]string `json:"name"`
 Unit string `json:"unit"`
 Requests int `json:"requests"`
 Units int `json:"units"`
}
func demandCandidates() []demandCandidate {
 return []demandCandidate{
  {ID:"kefir",Name:map[string]string{"tr":"Kefir","ru":"Кефир","en":"Kefir"},Unit:"1 L"},
  {ID:"tvorog",Name:map[string]string{"tr":"Lor / tvorog","ru":"Творог","en":"Tvorog"},Unit:"250 g"},
  {ID:"sour-cream",Name:map[string]string{"tr":"Ekşi krema","ru":"Сметана","en":"Sour cream"},Unit:"200 g"},
  {ID:"rye-bread",Name:map[string]string{"tr":"Çavdar ekmeği","ru":"Ржаной хлеб","en":"Rye bread"},Unit:"1 pc"},
 }
}
func knownDemand(id string)bool{
 for _,c:=range demandCandidates(){if c.ID==id{return true}}
 return false
}
type demandRequest struct {
 CandidateID string `json:"candidateId"`
 Quantity int `json:"quantity"`
}
type demandSignal struct{
 CandidateID string `json:"candidateId"`
 Quantity int `json:"quantity"`
 At time.Time `json:"at"`
}
func validateDemand(signals map[string]demandSignal)error{
 if len(signals)>1000{return errors.New("demand capacity")}
 for key,s:=range signals{
  b,err:=hex.DecodeString(key)
  if err!=nil||len(b)!=32||!knownDemand(s.CandidateID)||s.Quantity<1||s.Quantity>10||s.At.IsZero(){return errors.New("invalid demand signal")}
 }
 return nil
}
func(e *retailEngine) demand(w http.ResponseWriter,r *http.Request){
 if r.Method!="GET"&&r.Method!="POST"{w.Header().Set("Allow","GET, POST");fail(w,405,"method not allowed");return}
 var in demandRequest
 var key string
 if r.Method=="POST"{
  if !retailDecode(w,r,&in){return}
  key=r.Header.Get("Idempotency-Key")
  if len(key)<8||len(key)>128||!knownDemand(in.CandidateID)||in.Quantity<1||in.Quantity>10{fail(w,422,"invalid demand signal");return}
  digest:=sha256.Sum256([]byte(key));key=hex.EncodeToString(digest[:])
 }
 e.mu.Lock();defer e.mu.Unlock()
 if e.storageFailed{fail(w,503,"storage recovery required");return}
 if r.Method=="GET"{
  rows:=demandCandidates()
  for i:=range rows{for _,s:=range e.demandSignals{if s.CandidateID==rows[i].ID{rows[i].Requests++;rows[i].Units+=s.Quantity}}}
  respond(w,200,map[string]any{"demo":true,"candidates":rows,"scope":"all-recorded-signals","uniqueCustomersKnown":false});return
 }
 if old,ok:=e.demandSignals[key];ok{
  if old.CandidateID!=in.CandidateID||old.Quantity!=in.Quantity{fail(w,409,"demand key conflict");return}
  respond(w,200,old);return
 }
 if len(e.demandSignals)>=1000{fail(w,503,"demo capacity reached");return}
 before,err:=e.beforeMutation();if err!=nil{fail(w,503,"checkpoint unavailable");return}
 if e.demandSignals==nil{e.demandSignals=map[string]demandSignal{}}
 signal:=demandSignal{in.CandidateID,in.Quantity,time.Now().UTC()}
 e.demandSignals[key]=signal
 if err=e.commitMutation(before);err!=nil{fail(w,503,"checkpoint unavailable");return}
 respond(w,201,signal)
}

type demandPlanInput struct {
 CandidateID string `json:"candidateId"`
 BatchUnits int64 `json:"batchUnits"`
 UnitCost int64 `json:"unitCost"`
 SalePrice int64 `json:"salePrice"`
 ExpectedSold int64 `json:"expectedSold"`
 FixedCost int64 `json:"fixedCost"`
 MinMarginBPS int64 `json:"minMarginBps"`
}
type demandPlan struct{
 Demo bool `json:"demo"`
 Currency string `json:"currency"`
 CandidateID string `json:"candidateId"`
 Signals int `json:"signals"`
 RequestedUnits int `json:"requestedUnits"`
 Investment int64 `json:"investment"`
 Revenue int64 `json:"revenue"`
 Contribution int64 `json:"contribution"`
 UnsoldUnits int64 `json:"unsoldUnits"`
 UnsoldCost int64 `json:"unsoldCost"`
 BreakEvenUnits int64 `json:"breakEvenUnits"`
 UnitGrossMarginBPS int64 `json:"unitGrossMarginBps"`
 Decision string `json:"decision"`
}
func validDemandPlan(i demandPlanInput)bool{
 return knownDemand(i.CandidateID)&&i.BatchUnits>=1&&i.BatchUnits<=10000&&i.UnitCost>=1&&i.UnitCost<=100000000&&i.SalePrice>=1&&i.SalePrice<=100000000&&i.ExpectedSold>=0&&i.ExpectedSold<=i.BatchUnits&&i.FixedCost>=0&&i.FixedCost<=10000000000&&i.MinMarginBPS>=0&&i.MinMarginBPS<=9000
}
// Conservative scenario: unsold goods receive zero recovery value.
// All input demand and cost assumptions are explicit; no automatic purchasing.
func calculateDemand(i demandPlanInput,signals,units int)demandPlan{
 investment:=i.BatchUnits*i.UnitCost+i.FixedCost
 revenue:=i.ExpectedSold*i.SalePrice
 p:=demandPlan{Demo:true,Currency:"TRY",CandidateID:i.CandidateID,Signals:signals,RequestedUnits:units,Investment:investment,Revenue:revenue,Contribution:revenue-investment,UnsoldUnits:i.BatchUnits-i.ExpectedSold,UnsoldCost:(i.BatchUnits-i.ExpectedSold)*i.UnitCost,BreakEvenUnits:ceilGrowth(investment,i.SalePrice),UnitGrossMarginBPS:(i.SalePrice-i.UnitCost)*10000/i.SalePrice}
 switch{
 case i.SalePrice<=i.UnitCost||(i.SalePrice-i.UnitCost)*10000<i.MinMarginBPS*i.SalePrice:p.Decision="MARGIN_BLOCK"
 case p.BreakEvenUnits>i.BatchUnits:p.Decision="BATCH_UNVIABLE"
 case p.Contribution<0:p.Decision="REVIEW_SELL_THROUGH"
 case signals==0:p.Decision="NO_SIGNAL"
 default:p.Decision="PILOT_REVIEW"
 }
 return p
}
func(e *retailEngine) demandPlanning(w http.ResponseWriter,r *http.Request){
 if !method(w,r,"POST"){return}
 var in demandPlanInput
 if !retailDecode(w,r,&in){return}
 if !validDemandPlan(in){fail(w,422,"invalid procurement scenario");return}
 e.mu.Lock();defer e.mu.Unlock()
 if e.storageFailed{fail(w,503,"storage recovery required");return}
 n,units:=0,0
 for _,s:=range e.demandSignals{if s.CandidateID==in.CandidateID{n++;units+=s.Quantity}}
 respond(w,200,calculateDemand(in,n,units))
}
