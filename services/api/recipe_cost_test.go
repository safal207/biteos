package main

import ("encoding/json";"os";"path/filepath";"testing")
func TestRecipeCostGraph(t *testing.T){
 c,err:=defaultUniversal("robys");if err!=nil{t.Fatal(err)}
 b,err:=loadRecipeBook(t.TempDir(),c);if err!=nil{t.Fatal(err)}
 if err=validateRecipeBook(b,c);err!=nil{t.Fatal(err)}
 i:=universalQuoteInput{"latte","large",2,map[string][]string{"extras":{"extra-shot","oat-drink"}}}
 r,err:=calculateRecipe(c,b,i)
 // 36g espresso = 36 TRY, 300ml milk = 21 TRY, 50ml oat = 5 TRY per serving.
 if err!=nil||r.Quote.Total!=29000||r.DirectCost!=12400||r.GrossContribution!=16600||len(r.Lines)!=3||len(r.SourceDigest)!=64||r.ExternalEffectsAuthorized{t.Fatal(r,err)}
 second,err:=calculateRecipe(c,b,i);if err!=nil||second.SourceDigest!=r.SourceDigest{t.Fatal(second,err)}
 b.Costs[0].PackCost+=10000
 changed,err:=calculateRecipe(c,b,i);if err!=nil||changed.SourceDigest==r.SourceDigest||changed.DirectCost<=r.DirectCost{t.Fatal(changed,err)}
 if _,err=calculateRecipe(c,b,universalQuoteInput{"cake","",1,nil});err==nil{t.Fatal("missing recipe")}
}
func TestRecipeRejectsInvalidGraph(t *testing.T){
 c,_:=defaultUniversal("robys")
 for _,edit:=range []func(*recipeBook){
  func(b *recipeBook){b.TenantID="rozal"},
  func(b *recipeBook){b.Costs[0].PackQuantity=0},
  func(b *recipeBook){b.Costs[0].PackCost=-1},
  func(b *recipeBook){b.Recipes[0].Portions[0].Components=b.Recipes[0].Portions[0].Components[:1]},
  func(b *recipeBook){b.Recipes[0].Options[0].Components[0].IngredientID="milk"},
  func(b *recipeBook){b.Recipes[0].Options[0].Components[0].Quantity=0},
 }{b,err:=loadRecipeBook(t.TempDir(),c);if err!=nil{t.Fatal(err)};edit(&b);if validateRecipeBook(b,c)==nil{t.Fatal("bad recipe")}}
 root:=t.TempDir();b,_:=loadRecipeBook(root,c);b.TenantID="rozal";raw,_:=json.Marshal(b)
 if err:=os.WriteFile(filepath.Join(root,"robys.recipes.json"),raw,0600);err!=nil{t.Fatal(err)}
 if _,err:=loadRecipeBook(root,c);err==nil{t.Fatal("foreign recipe loaded")}
}
