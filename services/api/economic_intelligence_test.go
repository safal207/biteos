package main

import("reflect";"testing")
func economicFixture()economicInput{
 return economicInput{Selection:universalQuoteInput{"latte","regular",1,nil},Days:2,DiscountBPS:1000,MinMarginBPS:2000,CampaignCost:10000,IngredientBudget:map[string]int64{"espresso":1080,"milk":12000},Windows:[]economicWindow{
 {"morning",1,"counter",100,2000,3000,25,500},
 {"delivery",1,"delivery",50,2000,4000,20,1200},
 {"next-day",2,"counter",50,2000,4000,25,500},
 }}
}
func TestEconomicCounterfactual(t *testing.T){
 c,err:=defaultUniversal("robys");if err!=nil{t.Fatal(err)}
 b,err:=loadRecipeBook(t.TempDir(),c);if err!=nil{t.Fatal(err)}
 i:=economicFixture()
 r,err:=calculateEconomic(c,b,i)
 if err!=nil||r.Baseline.Sold!=40||r.Baseline.Contribution!=205000||r.Campaign.Sold!=60||r.Campaign.Demand!=70||r.Campaign.Unmet!=10||r.Campaign.Contribution!=240000||r.IncrementalContribution!=35000||r.Decision!="REVIEW_CAPACITY"||r.ExternalEffectsAuthorized{t.Fatal(r,err)}
 if r.Campaign.Rows[0].Limit!="capacity"||r.Campaign.Rows[2].Limit!="ingredients"||r.Campaign.Remaining["milk"]!=0||r.Baseline.Remaining["milk"]!=4000||i.IngredientBudget["milk"]!=12000{t.Fatal("capacity or source mutation")}
 again,err:=calculateEconomic(c,b,i);if err!=nil||!reflect.DeepEqual(r,again){t.Fatal("nondeterministic",err)}
 i.Windows[0].Visits++
 changed,err:=calculateEconomic(c,b,i);if err!=nil||changed.Digest==r.Digest{t.Fatal("unbound assumptions",err)}
 i.DiscountBPS=8000
 blocked,err:=calculateEconomic(c,b,i);if err!=nil||blocked.Decision!="MARGIN_BLOCK"{t.Fatal(blocked,err)}
}
func TestEconomicInputRejection(t *testing.T){
 c,_:=defaultUniversal("robys");b,_:=loadRecipeBook(t.TempDir(),c)
 for _,change:=range []func(*economicInput){
  func(i *economicInput){delete(i.IngredientBudget,"milk")},
  func(i *economicInput){i.IngredientBudget["alien"]=100},
  func(i *economicInput){i.Selection.Quantity=2},
  func(i *economicInput){i.Windows[1].ID=i.Windows[0].ID},
  func(i *economicInput){i.Windows[0].Day=2},
  func(i *economicInput){i.Windows[0].CampaignConversionBPS=10001},
  func(i *economicInput){i.Windows[0].Channel="unknown"},
  func(i *economicInput){i.Windows[0].OtherCostPerUnit=-1},
 }{i:=economicFixture();change(&i);if _,err:=calculateEconomic(c,b,i);err==nil{t.Fatal("accepted invalid scenario",i)}}
 i:=economicFixture();i.IngredientBudget["milk"]=0
 r,err:=calculateEconomic(c,b,i);if err!=nil||r.Decision!="NO_FEASIBLE_SALES"||r.Campaign.Sold!=0||r.Campaign.Contribution!=-i.CampaignCost{t.Fatal(r,err)}
}
