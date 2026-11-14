package main

import (
 "bytes"
 _ "embed"
 "encoding/json"
 "errors"
 "io"
 "net/http"
 "os"
 "path/filepath"
 "sort"
)

//go:embed recipe-cost-presets.json
var recipePresetJSON []byte

type ingredientCost struct {
 IngredientID string `json:"ingredientId"`
 Unit string `json:"unit"`
 PackQuantity int64 `json:"packQuantity"`
 PackCost int64 `json:"packCost"`
}
type recipeComponent struct{IngredientID string `json:"ingredientId"`; Quantity int64 `json:"quantity"`}
type recipePortion struct{VariantID string `json:"variantId"`;Components []recipeComponent `json:"components"`}
type recipeOption struct{GroupID string `json:"groupId"`;OptionID string `json:"optionId"`;Components []recipeComponent `json:"components"`}
type recipeCard struct{ItemID string `json:"itemId"`;Portions []recipePortion `json:"portions"`;Options []recipeOption `json:"options"`}
type recipeBook struct {
 Version int `json:"version"`
 TenantID string `json:"tenantId"`
 Currency string `json:"currency"`
 Costs []ingredientCost `json:"costs"`
 Recipes []recipeCard `json:"recipes"`
}
func validateRecipeBook(b recipeBook,c universalCatalog)error{
 bad:=errors.New("invalid recipe configuration")
 if b.Version!=1||b.TenantID!=c.TenantID||b.Currency!=c.Currency||b.Costs==nil||b.Recipes==nil||len(b.Costs)>200||len(b.Recipes)>100{return bad}
 known:=map[string]bool{};for _,v:=range c.Ingredients{known[v.ID]=true}
 costs:=map[string]bool{}
 for _,v:=range b.Costs{
  if !known[v.IngredientID]||costs[v.IngredientID]||v.PackQuantity<1||v.PackQuantity>1000000||v.PackCost<1||v.PackCost>100000000||v.Unit!="g"&&v.Unit!="ml"&&v.Unit!="piece"{return bad}
  costs[v.IngredientID]=true
 }
 exact:=func(parts []recipeComponent,refs []string)bool{
  if len(parts)!=len(refs)||len(parts)==0{return false}
  want:=map[string]bool{};for _,id:=range refs{want[id]=true}
  seen:=map[string]bool{}
  for _,p:=range parts{if !want[p.IngredientID]||!costs[p.IngredientID]||seen[p.IngredientID]||p.Quantity<1||p.Quantity>1000000{return false};seen[p.IngredientID]=true}
  return true
 }
 seen:=map[string]bool{}
 for _,r:=range b.Recipes{
  var item *universalItem
  for i:=range c.Items{if c.Items[i].ID==r.ItemID{item=&c.Items[i];break}}
  if item==nil||seen[r.ItemID]||item.Kind=="service"{return bad}
  seen[r.ItemID]=true
  variants:=map[string]bool{}
  if len(item.Variants)==0{variants[""]=true}else{for _,v:=range item.Variants{variants[v.ID]=true}}
  if len(r.Portions)!=len(variants){return bad}
  for _,v:=range r.Portions{if !variants[v.VariantID]||!exact(v.Components,item.Ingredients){return bad};delete(variants,v.VariantID)}
  opts:=map[string][]string{}
  for _,g:=range item.Groups{for _,o:=range g.Options{opts[g.ID+"/"+o.ID]=o.Ingredients}}
  if len(r.Options)!=len(opts){return bad}
  for _,o:=range r.Options{
   key:=o.GroupID+"/"+o.OptionID;refs,ok:=opts[key]
   if !ok||!exact(o.Components,refs){return bad};delete(opts,key)
  }
 }
 return nil
}
func loadRecipeBook(root string,c universalCatalog)(recipeBook,error){
 b:=recipeBook{Version:1,TenantID:c.TenantID,Currency:c.Currency,Costs:[]ingredientCost{},Recipes:[]recipeCard{}}
 path:=filepath.Join(root,c.TenantID+".recipes.json")
 info,err:=os.Lstat(path)
 if errors.Is(err,os.ErrNotExist){
  var presets []recipeBook
  if err=json.Unmarshal(recipePresetJSON,&presets);err!=nil{return b,err}
  for _,v:=range presets{if v.TenantID==c.TenantID{b=v;break}}
  // A customized catalog may not match the illustrative preset: explicitly
  // disable that preset rather than invent quantities or fail legacy startup.
  if validateRecipeBook(b,c)!=nil{return recipeBook{Version:1,TenantID:c.TenantID,Currency:c.Currency,Costs:[]ingredientCost{},Recipes:[]recipeCard{}},nil}
  return b,nil
 }
 if err!=nil{return b,err}
 if !info.Mode().IsRegular()||info.Size()>262144{return b,errors.New("invalid recipe file")}
 f,err:=os.Open(path);if err!=nil{return b,err};defer f.Close()
 raw,err:=io.ReadAll(io.LimitReader(f,262145));if err!=nil{return b,err}
 if len(raw)>262144{return b,errors.New("recipe file too large")}
 d:=json.NewDecoder(bytes.NewReader(raw));d.DisallowUnknownFields()
 if d.Decode(&b)!=nil||d.Decode(&struct{}{})!=io.EOF{return b,errors.New("invalid recipe JSON")}
 return b,validateRecipeBook(b,c)
}
type recipeCostLine struct{
 IngredientID string `json:"ingredientId"`
 Unit string `json:"unit"`
 QuantityPerItem int64 `json:"quantityPerItem"`
 PackQuantity int64 `json:"packQuantity"`
 PackCost int64 `json:"packCost"`
 CostPerItem int64 `json:"costPerItem"`
}
type recipeCostReport struct{
 Demo bool `json:"demo"`
 Quote universalQuote `json:"quote"`
 SourceDigest string `json:"sourceDigest"`
 Lines []recipeCostLine `json:"lines"`
 DirectCost int64 `json:"directCost"`
 GrossContribution int64 `json:"grossContribution"`
 ExternalEffectsAuthorized bool `json:"externalEffectsAuthorized"`
}
func calculateRecipe(c universalCatalog,b recipeBook,i universalQuoteInput)(recipeCostReport,error){
 r:=recipeCostReport{Demo:true,Lines:[]recipeCostLine{}}
 q,err:=quoteUniversal(c,i);if err!=nil{return r,err};r.Quote=q
 var card *recipeCard
 for j:=range b.Recipes{if b.Recipes[j].ItemID==i.ItemID{card=&b.Recipes[j];break}}
 if card==nil{return r,errors.New("recipe unavailable; no cost estimate")}
 quantities:=map[string]int64{}
 add:=func(parts []recipeComponent){for _,p:=range parts{quantities[p.IngredientID]+=p.Quantity}}
 for _,p:=range card.Portions{if p.VariantID==i.VariantID{add(p.Components)}}
 for _,o:=range card.Options{for _,id:=range i.Selections[o.GroupID]{if id==o.OptionID{add(o.Components)}}}
 if len(quantities)==0{return r,errors.New("recipe unavailable")}
 costs:=map[string]ingredientCost{};for _,v:=range b.Costs{costs[v.IngredientID]=v}
 for id,qty:=range quantities{
  v,ok:=costs[id];if !ok{return r,errors.New("ingredient cost unavailable")}
  // Conservative ceiling per ingredient per serving, in minor TRY units.
  per:=ceilGrowth(qty*v.PackCost,v.PackQuantity)
  r.Lines=append(r.Lines,recipeCostLine{id,v.Unit,qty,v.PackQuantity,v.PackCost,per})
  r.DirectCost+=per*int64(i.Quantity)
 }
 sort.Slice(r.Lines,func(i,j int)bool{return r.Lines[i].IngredientID<r.Lines[j].IngredientID})
 r.GrossContribution=q.Total-r.DirectCost
 raw,err:=json.Marshal(struct{Domain string;Catalog universalCatalog;Book recipeBook}{"biteos-recipe-cost-v1",c,b});if err!=nil{return r,err}
 r.SourceDigest=checkpointDigest(raw)
 return r,nil
}
func serveRecipe(w http.ResponseWriter,r *http.Request,c universalCatalog,b recipeBook){
 if r.Method=="GET"{respond(w,200,b);return}
 var in universalQuoteInput
 if !retailDecode(w,r,&in){return}
 v,err:=calculateRecipe(c,b,in);if err!=nil{fail(w,422,err.Error());return}
 respond(w,200,v)
}
