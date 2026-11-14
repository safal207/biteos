package main

import ("encoding/json";"os";"path/filepath";"testing")
func TestUniversalQuote(t *testing.T){
 c,err:=defaultUniversal("robys");if err!=nil{t.Fatal(err)}
 in:=universalQuoteInput{"latte","large",2,map[string][]string{"extras":{"extra-shot","oat-drink"}}}
 q,err:=quoteUniversal(c,in)
 if err!=nil||q.UnitPrice!=14500||q.Total!=29000||len(q.Ingredients)!=3||q.ExternalEffectsAuthorized||q.AllergenStatus!="unknown"{t.Fatal(q,err)}
 for _,bad:=range []universalQuoteInput{
  {"latte","",1,nil},{"latte","large",0,nil},{"latte","large",21,nil},{"milk","large",1,nil},
  {"latte","regular",1,map[string][]string{"extras":{"extra-shot","extra-shot"}}},
  {"latte","regular",1,map[string][]string{"extras":{"foreign"}}},
  {"latte","regular",1,map[string][]string{"foreign":{}}},
  {"cake","large",1,nil},
 }{if _,err:=quoteUniversal(c,bad);err==nil{t.Fatal("accepted",bad)}}
 c.Items[0].Groups[0].Min=1
 if _,err:=quoteUniversal(c,universalQuoteInput{"latte","regular",1,nil});err==nil{t.Fatal("required group")}
 c.Items[0].Available=false
 if _,err:=quoteUniversal(c,in);err==nil{t.Fatal("unavailable")}
}
func TestUniversalValidation(t *testing.T){
 for _,id:=range []string{"rozal","robys","new-shop"}{if _,err:=defaultUniversal(id);err!=nil{t.Fatal(id,err)}}
 for _,edit:=range []func(*universalCatalog){
  func(c *universalCatalog){c.TenantID="rozal"},
  func(c *universalCatalog){c.Items[0].Variants[0].Price=-1},
  func(c *universalCatalog){c.Items[0].Groups[0].Max=3},
  func(c *universalCatalog){c.Items[0].Ingredients=[]string{"unknown"}},
  func(c *universalCatalog){c.Items[0].AllergenStatus="safe"},
  func(c *universalCatalog){c.Items[2].DurationMinutes=0},
  func(c *universalCatalog){c.Items=append(c.Items,c.Items[0])},
 }{c,_:=defaultUniversal("robys");edit(&c);if validateUniversal(c,"robys")==nil{t.Fatal("invalid catalog accepted")}}
 root:=t.TempDir();c,_:=defaultUniversal("robys");b,_:=json.Marshal(c)
 path:=filepath.Join(root,"rozal.catalog.json")
 if err:=os.WriteFile(path,b,0600);err!=nil{t.Fatal(err)}
 if _,err:=loadUniversal(root,"rozal");err==nil{t.Fatal("cross-tenant config")}
}
