package main

import (
 "encoding/json"
 "errors"
 "math"
 "net/http"
 "sort"
 "time"
)

// Canonical, versioned quote snapshot. It binds the selection and calculation,
// not external observations or permission to execute.
type recipeSnapshot struct {
 Version int `json:"version"`
 Selection universalQuoteInput `json:"selection"`
 Report recipeCostReport `json:"report"`
 Digest string `json:"digest"`
}
func canonicalRecipeSelection(i universalQuoteInput)universalQuoteInput{
 out:=i;out.Selections=map[string][]string{}
 for group,picks:=range i.Selections{
  values:=append([]string{},picks...);sort.Strings(values);out.Selections[group]=values
 }
 return out
}
func recipeSnapshotDigest(s recipeSnapshot)string{
 s.Digest="";raw,_:=json.Marshal(s);return checkpointDigest(raw)
}
func buildRecipeSnapshot(c universalCatalog,b recipeBook,i universalQuoteInput)(recipeSnapshot,error){
 // Validate the original selection before dropping empty groups.
 r,err:=calculateRecipe(c,b,i);if err!=nil{return recipeSnapshot{},err}
 s:=recipeSnapshot{Version:1,Selection:canonicalRecipeSelection(i),Report:r}
 s.Digest=recipeSnapshotDigest(s)
 return s,nil
}
type recipeReviewInput struct {
 Selection universalQuoteInput `json:"selection"`
 Snapshot string `json:"snapshot"`
 Outcome string `json:"outcome"`
}
type recipeReviewRecord struct{
 Version int `json:"version"`
 ID string `json:"id"`
 TenantID string `json:"tenantId"`
 Snapshot recipeSnapshot `json:"snapshot"`
 Outcome string `json:"outcome"`
 RecordedAt time.Time `json:"recordedAt"`
 ExternalEffectsAuthorized bool `json:"externalEffectsAuthorized"`
 Digest string `json:"digest"`
}
func recipeReviewDigest(r recipeReviewRecord)string{
 r.Digest="";raw,_:=json.Marshal(r);return checkpointDigest(raw)
}
func recipeReviewID(tenant,snapshot string)string{return checkpointDigest([]byte("biteos-recipe-review-v1:"+tenant+":"+snapshot))}
func validRecipeSnapshot(s recipeSnapshot,tenant string)bool{
 r,q,i:=s.Report,s.Report.Quote,s.Selection
 if s.Version!=1||!reviewHex(s.Digest)||s.Digest!=recipeSnapshotDigest(s)||!reviewHex(r.SourceDigest)||!r.Demo||!q.Demo||r.ExternalEffectsAuthorized||q.ExternalEffectsAuthorized||q.TenantID!=tenant||q.Currency!="TRY"||q.AllergenStatus!="unknown"||!validTenantID(i.ItemID)||i.ItemID!=q.ItemID||i.VariantID!=q.VariantID||i.VariantID!=""&&!validTenantID(i.VariantID)||i.Quantity<1||i.Quantity>20||q.Quantity!=i.Quantity||q.UnitPrice<1||q.UnitPrice>9700000000||q.Total!=q.UnitPrice*int64(i.Quantity)||len(r.Lines)<1||len(r.Lines)>200||len(r.Lines)!=len(q.Ingredients)||len(i.Selections)>8{return false}
 if i.Selections==nil{return false}
 for group,picks:=range i.Selections{
  if !validTenantID(group)||picks==nil||len(picks)>12{return false}
  for j,id:=range picks{if !validTenantID(id)||j>0&&picks[j-1]>=id{return false}}
 }
 ingredients:=map[string]bool{}
 for _,id:=range q.Ingredients{if !validTenantID(id)||ingredients[id]{return false};ingredients[id]=true}
 var direct int64
 for j,l:=range r.Lines{
  if !ingredients[l.IngredientID]||j>0&&r.Lines[j-1].IngredientID>=l.IngredientID||l.Unit!="g"&&l.Unit!="ml"&&l.Unit!="piece"||l.QuantityPerItem<1||l.QuantityPerItem>97000000||l.PackQuantity<1||l.PackQuantity>1000000||l.PackCost<1||l.PackCost>100000000{return false}
  if l.CostPerItem!=ceilGrowth(l.QuantityPerItem*l.PackCost,l.PackQuantity){return false}
  if l.CostPerItem<0||l.CostPerItem>(math.MaxInt64-direct)/int64(i.Quantity){return false}
  direct+=l.CostPerItem*int64(i.Quantity)
 }
 return r.DirectCost==direct&&r.GrossContribution==q.Total-direct
}
func validateRecipeReviews(records map[string]recipeReviewRecord,tenant string)error{
 bad:=errors.New("invalid recipe review history")
 if len(records)>256||len(records)>0&&!validTenantID(tenant){return bad}
 for id,r:=range records{
  if r.Version!=1||r.TenantID!=tenant||r.ID!=id||id!=recipeReviewID(tenant,r.Snapshot.Digest)||!validOutcome(r.Outcome)||r.RecordedAt.IsZero()||r.ExternalEffectsAuthorized||!validRecipeSnapshot(r.Snapshot,tenant)||r.Digest!=recipeReviewDigest(r){return bad}
 }
 return nil
}
func serveRecipeReview(w http.ResponseWriter,r *http.Request,entry tenantEntry){
 e:=entry.engine
 var in recipeReviewInput
 if r.Method=="POST"{
  if !retailDecode(w,r,&in){return}
  if !reviewHex(in.Snapshot)||!validOutcome(in.Outcome){fail(w,422,"invalid recipe review");return}
 }
 e.mu.Lock();defer e.mu.Unlock()
 if e.storageFailed||e.sqliteSave==nil||e.tenantID!=entry.catalog.TenantID{fail(w,503,"tenant storage unavailable");return}
 if r.Method=="GET"{
  records:=[]recipeReviewRecord{}
  for _,v:=range e.recipeReviews{records=append(records,v)}
  sort.Slice(records,func(i,j int)bool{if !records[i].RecordedAt.Equal(records[j].RecordedAt){return records[i].RecordedAt.After(records[j].RecordedAt)};return records[i].ID<records[j].ID})
  respond(w,200,map[string]any{"demo":true,"tenantId":e.tenantID,"records":records,"externalEffectsAuthorized":false});return
 }
 current,err:=buildRecipeSnapshot(entry.catalog,entry.recipes,in.Selection)
 id:=recipeReviewID(e.tenantID,in.Snapshot)
 if old,ok:=e.recipeReviews[id];ok{
  // A replay must retain the exact selection and outcome, not just a known digest.
  a,_:=json.Marshal(canonicalRecipeSelection(in.Selection));b,_:=json.Marshal(old.Snapshot.Selection)
  if string(a)!=string(b)||old.Outcome!=in.Outcome{fail(w,409,"review immutable");return}
  respond(w,200,map[string]any{"record":old,"current":err==nil&&current.Digest==in.Snapshot,"externalEffectsAuthorized":false});return
 }
 if err!=nil||current.Digest!=in.Snapshot{fail(w,409,"recipe snapshot changed or unavailable");return}
 if len(e.recipeReviews)>=256{fail(w,503,"recipe review capacity reached");return}
 before,err:=e.beforeMutation();if err!=nil{fail(w,503,"checkpoint unavailable");return}
 record:=recipeReviewRecord{Version:1,ID:id,TenantID:e.tenantID,Snapshot:current,Outcome:in.Outcome,RecordedAt:time.Now().UTC()}
 record.Digest=recipeReviewDigest(record)
 if e.recipeReviews==nil{e.recipeReviews=map[string]recipeReviewRecord{}}
 e.recipeReviews[id]=record
 if err=e.commitMutation(before);err!=nil{fail(w,503,"checkpoint unavailable");return}
 respond(w,201,map[string]any{"record":record,"current":true,"externalEffectsAuthorized":false})
}

func serveRecipeSnapshot(w http.ResponseWriter,r *http.Request,entry tenantEntry){
 var in universalQuoteInput
 if !retailDecode(w,r,&in){return}
 snapshot,err:=buildRecipeSnapshot(entry.catalog,entry.recipes,in)
 if err!=nil{fail(w,422,err.Error());return}
 respond(w,200,snapshot)
}
