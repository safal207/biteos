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
)

//go:embed universal-catalog-presets.json
var universalPresetsJSON []byte

type universalIngredient struct{ID string `json:"id"`;Name map[string]string `json:"name"`}
type universalVariant struct{ID string `json:"id"`;Name map[string]string `json:"name"`;Price int64 `json:"price"`}
type universalOption struct{ID string `json:"id"`;Name map[string]string `json:"name"`;Delta int64 `json:"delta"`;Ingredients []string `json:"ingredients"`}
type universalGroup struct{ID string `json:"id"`;Name map[string]string `json:"name"`;Min int `json:"min"`;Max int `json:"max"`;Options []universalOption `json:"options"`}
type universalItem struct{
 ID string `json:"id"`
 Kind string `json:"kind"`
 Name map[string]string `json:"name"`
 Price int64 `json:"price"`
 Unit string `json:"unit"`
 Available bool `json:"available"`
 Ingredients []string `json:"ingredients"`
 AllergenStatus string `json:"allergenStatus"`
 DurationMinutes int `json:"durationMinutes,omitempty"`
 Variants []universalVariant `json:"variants"`
 Groups []universalGroup `json:"groups"`
}
type universalCatalog struct{
 Version int `json:"version"`
 TenantID string `json:"tenantId"`
 Currency string `json:"currency"`
 Ingredients []universalIngredient `json:"ingredients"`
 Items []universalItem `json:"items"`
}
func universalName(n map[string]string)bool{
 if len(n)!=3{return false}
 for _,l:=range []string{"tr","ru","en"}{if !brandText(n[l],120){return false}}
 return true
}
func universalRefs(refs []string,known map[string]bool)bool{
 if len(refs)>30{return false}
 seen:=map[string]bool{}
 for _,id:=range refs{if !known[id]||seen[id]{return false};seen[id]=true}
 return true
}
func validateUniversal(c universalCatalog,id string)error{
 invalid:=errors.New("invalid universal catalog")
 if c.Version!=1||!validTenantID(id)||c.TenantID!=id||c.Currency!="TRY"||len(c.Items)>100||len(c.Ingredients)>200||c.Items==nil||c.Ingredients==nil{return invalid}
 ingredients:=map[string]bool{}
 for _,v:=range c.Ingredients{
  if !validTenantID(v.ID)||ingredients[v.ID]||!universalName(v.Name){return invalid}
  ingredients[v.ID]=true
 }
 items:=map[string]bool{}
 for _,p:=range c.Items{
  if !validTenantID(p.ID)||items[p.ID]||!universalName(p.Name)||p.Price<1||p.Price>100000000||!universalRefs(p.Ingredients,ingredients)||p.AllergenStatus!="unknown"||len(p.Variants)>10||len(p.Groups)>8{return invalid}
  items[p.ID]=true
  switch p.Kind{
  case "product","dish","drink":if p.DurationMinutes!=0{return invalid}
  case "service":if p.DurationMinutes<1||p.DurationMinutes>480{return invalid}
  default:return invalid
  }
  switch p.Unit{case "piece","kg","L","portion","cup","session":default:return invalid}
  variants,groups:=map[string]bool{},map[string]bool{}
  for _,v:=range p.Variants{
   if !validTenantID(v.ID)||variants[v.ID]||!universalName(v.Name)||v.Price<1||v.Price>100000000{return invalid}
   variants[v.ID]=true
  }
  for _,g:=range p.Groups{
   if !validTenantID(g.ID)||groups[g.ID]||!universalName(g.Name)||len(g.Options)<1||len(g.Options)>12||g.Min<0||g.Max<g.Min||g.Max>len(g.Options)||g.Max<1{return invalid}
   groups[g.ID]=true;options:=map[string]bool{}
   for _,o:=range g.Options{
    if !validTenantID(o.ID)||options[o.ID]||!universalName(o.Name)||o.Delta<0||o.Delta>100000000||!universalRefs(o.Ingredients,ingredients){return invalid}
    options[o.ID]=true
   }
  }
 }
 return nil
}
func defaultUniversal(id string)(universalCatalog,error){
 var presets []universalCatalog
 if err:=json.Unmarshal(universalPresetsJSON,&presets);err!=nil{return universalCatalog{},err}
 for _,c:=range presets{if c.TenantID==id{return c,validateUniversal(c,id)}}
 c:=universalCatalog{Version:1,TenantID:id,Currency:"TRY",Ingredients:[]universalIngredient{},Items:[]universalItem{}}
 return c,validateUniversal(c,id)
}
func loadUniversal(root,id string)(universalCatalog,error){
 if !validTenantID(id){return universalCatalog{},errors.New("invalid tenant")}
 path:=filepath.Join(root,id+".catalog.json")
 info,err:=os.Lstat(path)
 if errors.Is(err,os.ErrNotExist){return defaultUniversal(id)}
 if err!=nil{return universalCatalog{},err}
 if !info.Mode().IsRegular()||info.Size()>262144{return universalCatalog{},errors.New("invalid catalog file")}
 f,err:=os.Open(path);if err!=nil{return universalCatalog{},err};defer f.Close()
 raw,err:=io.ReadAll(io.LimitReader(f,262145));if err!=nil{return universalCatalog{},err}
 if len(raw)>262144{return universalCatalog{},errors.New("catalog too large")}
 var c universalCatalog
 d:=json.NewDecoder(bytes.NewReader(raw));d.DisallowUnknownFields()
 if d.Decode(&c)!=nil||d.Decode(&struct{}{})!=io.EOF{return c,errors.New("invalid catalog JSON")}
 return c,validateUniversal(c,id)
}
type universalQuoteInput struct{
 ItemID string `json:"itemId"`
 VariantID string `json:"variantId"`
 Quantity int `json:"quantity"`
 Selections map[string][]string `json:"selections"`
}
type universalQuote struct{
 Demo bool `json:"demo"`
 TenantID string `json:"tenantId"`
 Currency string `json:"currency"`
 ItemID string `json:"itemId"`
 VariantID string `json:"variantId,omitempty"`
 Quantity int `json:"quantity"`
 UnitPrice int64 `json:"unitPrice"`
 Total int64 `json:"total"`
 Ingredients []string `json:"ingredients"`
 AllergenStatus string `json:"allergenStatus"`
 ExternalEffectsAuthorized bool `json:"externalEffectsAuthorized"`
}
func quoteUniversal(c universalCatalog,i universalQuoteInput)(universalQuote,error){
 q:=universalQuote{Demo:true,TenantID:c.TenantID,Currency:c.Currency,ItemID:i.ItemID,VariantID:i.VariantID,Quantity:i.Quantity,Ingredients:[]string{},AllergenStatus:"unknown"}
 invalid:=errors.New("invalid or unavailable catalog selection")
 if i.Quantity<1||i.Quantity>20{return q,invalid}
 var p *universalItem
 for j:=range c.Items{if c.Items[j].ID==i.ItemID{p=&c.Items[j];break}}
 if p==nil||!p.Available{return q,invalid}
 q.UnitPrice=p.Price
 if len(p.Variants)==0{if i.VariantID!=""{return q,invalid}}else{
  found:=false;for _,v:=range p.Variants{if v.ID==i.VariantID{q.UnitPrice=v.Price;found=true;break}}
  if !found{return q,invalid}
 }
 seenIngredient:=map[string]bool{}
 add:=func(refs []string){for _,id:=range refs{if !seenIngredient[id]{seenIngredient[id]=true;q.Ingredients=append(q.Ingredients,id)}}}
 add(p.Ingredients)
 seenGroup:=map[string]bool{}
 for _,g:=range p.Groups{
  picks:=i.Selections[g.ID];seenGroup[g.ID]=true
  if len(picks)<g.Min||len(picks)>g.Max{return q,invalid}
  seen:=map[string]bool{}
  for _,id:=range picks{if seen[id]{return q,invalid};seen[id]=true}
  found:=0
  for _,o:=range g.Options{if seen[o.ID]{found++;q.UnitPrice+=o.Delta;add(o.Ingredients)}}
  if found!=len(picks){return q,invalid}
 }
 for id:=range i.Selections{if !seenGroup[id]{return q,invalid}}
 q.Total=q.UnitPrice*int64(i.Quantity)
 return q,nil
}
func serveUniversal(w http.ResponseWriter,r *http.Request,c universalCatalog){
 if r.Method=="GET"{respond(w,200,c);return}
 var in universalQuoteInput
 if !retailDecode(w,r,&in){return}
 q,err:=quoteUniversal(c,in);if err!=nil{fail(w,422,err.Error());return}
 respond(w,200,q)
}
