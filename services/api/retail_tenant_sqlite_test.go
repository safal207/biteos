//go:build sqlite && cgo

package main

import(
 "encoding/json"
 "net/http"
 "net/http/httptest"
 "os"
 "path/filepath"
 "strings"
 "testing"
 "time"
)

func tenantFixture()[]tenantConfig{return []tenantConfig{{"rozal","tenant-test-rozal-credential-000000000"},{"robys","tenant-test-robys-credential-000000000"}}}
func tenantCall(g http.Handler,method,path,token,key,body string)*httptest.ResponseRecorder{
 r:=httptest.NewRequest(method,path,strings.NewReader(body))
 if token!=""{r.Header.Set("Authorization","Bearer "+token)}
 if key!=""{r.Header.Set("Idempotency-Key",key)}
 w:=httptest.NewRecorder();g.ServeHTTP(w,r);return w
}
func TestTenantSQLiteIsolation(t *testing.T){
 root:=t.TempDir();config:=tenantFixture()
 g,err:=openTenantGateway(root,config);if err!=nil{t.Fatal(err)}
 a,b:="/api/tenants/rozal/retail/","/api/tenants/robys/retail/"
 body:=`{"items":[{"id":"milk","quantity":2}],"mode":"pickup","replacement":"skip"}`
 w:=tenantCall(g,"POST",a+"orders",config[0].Token,"same-order-key",body)
 var first,second retailOrder
 if w.Code!=201||json.Unmarshal(w.Body.Bytes(),&first)!=nil{t.Fatal(w.Code,w.Body.String())}
 w=tenantCall(g,"POST",b+"orders",config[1].Token,"same-order-key",body)
 if w.Code!=201||json.Unmarshal(w.Body.Bytes(),&second)!=nil||first.ID==second.ID{t.Fatal(w.Code,w.Body.String())}
 for _,pair:=range []struct{path,token string}{{a,config[0].Token},{b,config[1].Token}}{
  w=tenantCall(g,"GET",pair.path+"catalog",pair.token,"","")
  var c struct{Products []retailProduct}
  if w.Code!=200||json.Unmarshal(w.Body.Bytes(),&c)!=nil||c.Products[2].Stock!=18{t.Fatal(w.Code,w.Body.String())}
 }
 w=tenantCall(g,"POST",a+"inventory",config[0].Token,"tenant-receipt-1",`{"productId":"milk","quantity":5,"unitCost":3100,"reference":"tenant-demo"}`)
 if w.Code!=201{t.Fatal(w.Code,w.Body.String())}
 w=tenantCall(g,"POST",a+"demand",config[0].Token,"tenant-demand-01",`{"candidateId":"kefir","quantity":3}`)
 if w.Code!=201{t.Fatal(w.Code,w.Body.String())}
 for _,path:=range []string{a+"catalog",a+"finance",a+"evidence",a+"order?id="+first.ID}{
  if w=tenantCall(g,"GET",path,config[1].Token,"","");w.Code!=401{t.Fatal("foreign credential",path,w.Code)}
 }
 if w=tenantCall(g,"GET",b+"order?id="+first.ID,config[1].Token,"","");w.Code!=404{t.Fatal("foreign ID",w.Code)}
 if w=tenantCall(g,"POST",b+"order?id="+first.ID,config[1].Token,"",`{"status":"picking"}`);w.Code!=404{t.Fatal("foreign mutation",w.Code)}
 g,err=openTenantGateway(root,config);if err!=nil{t.Fatal(err)}
 ea,eb:=g.entries["rozal"].engine,g.entries["robys"].engine
 if ea.tenantID!="rozal"||eb.tenantID!="robys"||ea.products[2].Stock!=23||eb.products[2].Stock!=18||len(ea.demandSignals)!=1||len(eb.demandSignals)!=0||len(ea.evidence)!=2||len(eb.evidence)!=1{t.Fatal("tenant state leaked")}
 w=tenantCall(g,"POST",a+"orders",config[0].Token,"same-order-key",body)
 var replay retailOrder
 if w.Code!=200||json.Unmarshal(w.Body.Bytes(),&replay)!=nil||replay.ID!=first.ID{t.Fatal(w.Code,w.Body.String())}
 if _,err=openSQLiteRetailEngine(filepath.Join(root,"rozal.sqlite"));err==nil{t.Fatal("legacy bypass")}
 if _,err=openSQLiteRetailEngineForTenant(filepath.Join(root,"rozal.sqlite"),"robys");err==nil{t.Fatal("wrong database binding")}
}
func TestTenantGatewayDeniesFallback(t *testing.T){
 config:=tenantFixture();g,err:=openTenantGateway(t.TempDir(),config);if err!=nil{t.Fatal(err)}
 for _,path:=range []string{"/api/retail/catalog","/api/catalog","/api/tenants/rozal/retail/business?role=owner","/api/tenants/rozal/retail/brain/review","/api/tenants/rozal/retail/../catalog","/api/tenants/rozal/retail/%63atalog","/api/tenants//retail/catalog","/api/tenants/rozal/retail//catalog"}{
  if w:=tenantCall(g,"GET",path,config[0].Token,"","");w.Code!=404{t.Fatal(path,w.Code)}
 }
 if w:=tenantCall(g,"GET","/api/tenants/unknown/retail/catalog",config[0].Token,"","");w.Code!=401{t.Fatal("unknown tenant",w.Code)}
 if w:=tenantCall(g,"GET","/api/tenants/rozal/retail/catalog?tenant=robys",config[0].Token,"","");w.Code!=400{t.Fatal("query override",w.Code)}
 root:=t.TempDir()
 legacy:=filepath.Join(root,"rozal.sqlite")
 if _,err=openSQLiteRetailEngine(legacy);err!=nil{t.Fatal(err)}
 if _,err=openTenantGateway(root,config);err==nil{t.Fatal("legacy database silently adopted")}
 root=t.TempDir()
 if err=os.Symlink(legacy,filepath.Join(root,"rozal.sqlite"));err!=nil{t.Fatal(err)}
 if _,err=openTenantGateway(root,config);err==nil{t.Fatal("symlink accepted")}
}

func TestTenantBrandEndpoint(t *testing.T){
 config:=tenantFixture();g,err:=openTenantGateway(t.TempDir(),config);if err!=nil{t.Fatal(err)}
 for _,c:=range config{
  path:="/api/tenants/"+c.ID+"/retail/brand"
  w:=tenantCall(g,"GET",path,c.Token,"","")
  var p brandProfile
  if w.Code!=200||json.Unmarshal(w.Body.Bytes(),&p)!=nil||p.TenantID!=c.ID||validateBrand(p,c.ID)!=nil{t.Fatal(w.Code,w.Body.String())}
  if w=tenantCall(g,"GET",path,"wrong","","");w.Code!=401{t.Fatal(w.Code)}
  if w=tenantCall(g,"POST",path,c.Token,"","{}");w.Code!=404{t.Fatal(w.Code)}
 }
}

func TestTenantUniversalCatalogBoundary(t *testing.T){
 config:=tenantFixture();g,err:=openTenantGateway(t.TempDir(),config);if err!=nil{t.Fatal(err)}
 a,b:="/api/tenants/rozal/retail/universal-catalog","/api/tenants/robys/retail/universal-catalog"
 before,_:=json.Marshal(g.entries["robys"].engine.state())
 body:=`{"itemId":"latte","variantId":"large","quantity":2,"selections":{"extras":["extra-shot","oat-drink"]}}`
 w:=tenantCall(g,"POST",b,config[1].Token,"",body)
 var q universalQuote
 if w.Code!=200||json.Unmarshal(w.Body.Bytes(),&q)!=nil||q.Total!=29000||q.TenantID!="robys"||q.ExternalEffectsAuthorized{t.Fatal(w.Code,w.Body.String())}
 if w=tenantCall(g,"POST",a,config[0].Token,"",body);w.Code!=422{t.Fatal("foreign item",w.Code)}
 if w=tenantCall(g,"GET",b,config[0].Token,"","");w.Code!=401{t.Fatal("foreign key",w.Code)}
 after,_:=json.Marshal(g.entries["robys"].engine.state());if string(before)!=string(after){t.Fatal("quote mutated state")}
}

func TestTenantRecipeBoundary(t *testing.T){
 config:=tenantFixture();g,err:=openTenantGateway(t.TempDir(),config);if err!=nil{t.Fatal(err)}
 a,b:="/api/tenants/rozal/retail/recipe-cost","/api/tenants/robys/retail/recipe-cost"
 before,_:=json.Marshal(g.entries["robys"].engine.state())
 body:=`{"itemId":"latte","variantId":"large","quantity":2,"selections":{"extras":["extra-shot","oat-drink"]}}`
 w:=tenantCall(g,"POST",b,config[1].Token,"",body)
 var r recipeCostReport
 if w.Code!=200||json.Unmarshal(w.Body.Bytes(),&r)!=nil||r.DirectCost!=12400||r.GrossContribution!=16600||r.Quote.TenantID!="robys"||r.ExternalEffectsAuthorized{t.Fatal(w.Code,w.Body.String())}
 if w=tenantCall(g,"POST",a,config[0].Token,"",body);w.Code!=422{t.Fatal("foreign recipe",w.Code)}
 if w=tenantCall(g,"GET",b,config[0].Token,"","");w.Code!=401{t.Fatal("foreign credential",w.Code)}
 after,_:=json.Marshal(g.entries["robys"].engine.state());if string(before)!=string(after){t.Fatal("cost simulation mutated state")}
}

func TestTenantRecipeReviewPersistence(t *testing.T){
 root:=t.TempDir();config:=tenantFixture();g,err:=openTenantGateway(root,config);if err!=nil{t.Fatal(err)}
 base:="/api/tenants/robys/retail/recipe-cost";token:=config[1].Token
 selection:=universalQuoteInput{"latte","large",2,map[string][]string{"extras":{"extra-shot","oat-drink"}}}
 raw,_:=json.Marshal(selection)
 w:=tenantCall(g,"POST",base+"/snapshot",token,"",string(raw))
 var snapshot recipeSnapshot
 if w.Code!=200||json.Unmarshal(w.Body.Bytes(),&snapshot)!=nil||!validRecipeSnapshot(snapshot,"robys"){t.Fatal(w.Code,w.Body.String())}
 in:=recipeReviewInput{selection,snapshot.Digest,"reviewed"}
 body,_:=json.Marshal(in)
 e:=g.entries["robys"].engine
 before:=e.state()
 w=tenantCall(g,"POST",base+"/review",config[0].Token,"",string(body));if w.Code!=401{t.Fatal("foreign token",w.Code)}
 w=tenantCall(g,"POST",base+"/review",token,"",string(body))
 var receipt struct{Record recipeReviewRecord;Current bool;ExternalEffectsAuthorized bool}
 if w.Code!=201||json.Unmarshal(w.Body.Bytes(),&receipt)!=nil||!receipt.Current||receipt.ExternalEffectsAuthorized||receipt.Record.ExternalEffectsAuthorized||len(e.recipeReviews)!=1{t.Fatal(w.Code,w.Body.String())}
 state:=e.state();state.RecipeReviews=nil
 a,_:=json.Marshal(before);b,_:=json.Marshal(state);if string(a)!=string(b){t.Fatal("review changed commerce")}
 original:=receipt.Record
 w=tenantCall(g,"POST",base+"/review",token,"",string(body));if w.Code!=200{t.Fatal(w.Code)}
 in.Outcome="needs-followup";bad,_:=json.Marshal(in)
 if w=tenantCall(g,"POST",base+"/review",token,"",string(bad));w.Code!=409{t.Fatal("outcome conflict",w.Code)}
 in.Outcome="reviewed";in.Selection.Quantity=1;bad,_=json.Marshal(in)
 if w=tenantCall(g,"POST",base+"/review",token,"",string(bad));w.Code!=409{t.Fatal("selection conflict",w.Code)}
 // Obtain a second, as-yet unreviewed snapshot before configuration changes.
 selection.Quantity=1;raw,_=json.Marshal(selection)
 w=tenantCall(g,"POST",base+"/snapshot",token,"",string(raw))
 var pending recipeSnapshot
 if w.Code!=200||json.Unmarshal(w.Body.Bytes(),&pending)!=nil{t.Fatal(w.Code,w.Body.String())}
 book:=g.entries["robys"].recipes;book.Costs[0].PackCost+=10000
 raw,_=json.Marshal(book)
 if err=os.WriteFile(filepath.Join(root,"robys.recipes.json"),raw,0600);err!=nil{t.Fatal(err)}
 g,err=openTenantGateway(root,config);if err!=nil{t.Fatal(err)}
 w=tenantCall(g,"POST",base+"/review",token,"",string(body))
 if w.Code!=200||json.Unmarshal(w.Body.Bytes(),&receipt)!=nil||receipt.Current||receipt.Record.Digest!=original.Digest{t.Fatal("historical replay",w.Code,w.Body.String())}
 bad,_=json.Marshal(recipeReviewInput{selection,pending.Digest,"reviewed"})
 if w=tenantCall(g,"POST",base+"/review",token,"",string(bad));w.Code!=409{t.Fatal("stale new review",w.Code)}
 w=tenantCall(g,"GET",base+"/review",token,"","")
 var history struct{Records []recipeReviewRecord}
 if w.Code!=200||json.Unmarshal(w.Body.Bytes(),&history)!=nil||len(history.Records)!=1||history.Records[0].Digest!=original.Digest{t.Fatal(w.Code,w.Body.String())}
 w=tenantCall(g,"GET","/api/tenants/rozal/retail/recipe-cost/review",config[0].Token,"","")
 if w.Code!=200||json.Unmarshal(w.Body.Bytes(),&history)!=nil||len(history.Records)!=0{t.Fatal("foreign history",w.Code,w.Body.String())}
}

func TestTenantEconomicBoundary(t *testing.T){
 config:=tenantFixture();g,err:=openTenantGateway(t.TempDir(),config);if err!=nil{t.Fatal(err)}
 a,b:="/api/tenants/rozal/retail/economic-intelligence","/api/tenants/robys/retail/economic-intelligence"
 before,_:=json.Marshal(g.entries["robys"].engine.state());body,_:=json.Marshal(economicFixture())
 w:=tenantCall(g,"POST",b,config[1].Token,"",string(body))
 var r economicReport
 if w.Code!=200||json.Unmarshal(w.Body.Bytes(),&r)!=nil||r.TenantID!="robys"||r.IncrementalContribution!=35000||r.ExternalEffectsAuthorized{t.Fatal(w.Code,w.Body.String())}
 if w=tenantCall(g,"POST",b,config[0].Token,"",string(body));w.Code!=401{t.Fatal("foreign credential",w.Code)}
 if w=tenantCall(g,"POST",a,config[0].Token,"",string(body));w.Code!=422{t.Fatal("foreign item",w.Code)}
 after,_:=json.Marshal(g.entries["robys"].engine.state());if string(before)!=string(after){t.Fatal("scenario mutated state")}
}

func TestTenantObservatoryPersistence(t *testing.T){
 root:=t.TempDir();config:=tenantFixture();g,err:=openTenantGateway(root,config);if err!=nil{t.Fatal(err)}
 entry:=g.entries["robys"]
 _,plan,now:=observatoryFixture(t)
 path:="/api/tenants/robys/retail/observatory"
 token:=config[1].Token
 before:=entry.engine.state()
 planJSON:=obsBytes(plan)
 if w:=tenantCall(g,"POST",path+"/plan",config[0].Token,"",planJSON);w.Code!=401{t.Fatal("foreign key",w.Code)}
 if w:=tenantCall(g,"POST","/api/tenants/rozal/retail/observatory/plan",config[0].Token,"",planJSON);w.Code!=422{t.Fatal("foreign forecast",w.Code)}
 // Fake clock is injected exclusively through the internal helper in tests.
 call:=func(entry tenantEntry,op,body string,at time.Time)*httptest.ResponseRecorder{
  r:=httptest.NewRequest("POST",path+"/"+op,strings.NewReader(body))
  w:=httptest.NewRecorder();serveObservatoryAt(w,r,entry,op,at);return w
 }
 w:=call(entry,"plan",planJSON,now)
 var p observationPlan
 if w.Code!=201||json.Unmarshal(w.Body.Bytes(),&p)!=nil||!validObservationPlan(p,"robys"){t.Fatal(w.Code,w.Body.String())}
 if w=call(entry,"plan",planJSON,now);w.Code!=200{t.Fatal("plan replay",w.Code)}
 altered:=plan;altered.StartDay="2026-11-16"
 if w=call(entry,"plan",obsBytes(altered),now);w.Code!=409{t.Fatal("plan conflict",w.Code)}
 input:=observedFixture(p)
 if w=call(entry,"observation",obsBytes(input),now);w.Code!=422{t.Fatal("early",w.Code)}
 w=call(entry,"observation",obsBytes(input),now.AddDate(0,0,3))
 var result observationResult
 if w.Code!=201||json.Unmarshal(w.Body.Bytes(),&result)!=nil||result.ActualSold!=55||result.CausalEffectEstablished{t.Fatal(w.Code,w.Body.String())}
 if w=call(entry,"observation",obsBytes(input),now.AddDate(0,0,3));w.Code!=200{t.Fatal("observation replay",w.Code)}
 changed:=input;changed.CampaignCost++
 if w=call(entry,"observation",obsBytes(changed),now.AddDate(0,0,3));w.Code!=409{t.Fatal("observation conflict",w.Code)}
 state:=entry.engine.state();state.ObservationPlans=nil;state.ObservationResults=nil
 if obsBytes(before)!=obsBytes(state){t.Fatal("observatory changed commerce")}
 g,err=openTenantGateway(root,config);if err!=nil{t.Fatal(err)}
 w=tenantCall(g,"GET",path,token,"","")
 var list struct{Plans []observationPlan;Observations []observationResult}
 if w.Code!=200||json.Unmarshal(w.Body.Bytes(),&list)!=nil||len(list.Plans)!=1||len(list.Observations)!=1||list.Observations[0].Digest!=result.Digest{t.Fatal(w.Code,w.Body.String())}
 w=tenantCall(g,"GET","/api/tenants/rozal/retail/observatory",config[0].Token,"","")
 if w.Code!=200||json.Unmarshal(w.Body.Bytes(),&list)!=nil||len(list.Plans)!=0||len(list.Observations)!=0{t.Fatal("cross-tenant history",w.Code)}
}

func TestTenantRoleGatewayBoundary(t *testing.T){
 owners:=tenantFixture()
 roles:=[]tenantRoleConfig{
  {"rozal","manager","test-manager-secret-000000000000000"},
  {"rozal","cashier","test-cashier-secret-000000000000000"},
  {"rozal","customer","test-customer-secret-00000000000000"},
 }
 g,err:=openTenantGatewayWithRoles(t.TempDir(),owners,roles);if err!=nil{t.Fatal(err)}
 a,b:="/api/tenants/rozal/retail/","/api/tenants/robys/retail/"
 before,_:=json.Marshal(g.entries["rozal"].engine.state())
 for _,c:=range []struct{role int;method,path string;want int}{
  {0,"GET",a+"finance",403},{0,"POST",a+"recipe-cost/review",403},
  {1,"POST",a+"inventory",403},{1,"GET",a+"evidence",403},
  {2,"POST",a+"orders",403},{2,"GET",a+"order?id=foreign",403},
  {2,"GET",a+"finance?role=owner",403},{1,"GET",b+"catalog",401},
  {2,"GET",a+"catalog",200},{1,"GET",a+"delivery",200},
 }{
  w:=tenantCall(g,c.method,c.path,roles[c.role].Token,"role-test-key","{}")
  if w.Code!=c.want{t.Fatal(c,w.Code,w.Body.String())}
 }
 after,_:=json.Marshal(g.entries["rozal"].engine.state())
 if string(before)!=string(after){t.Fatal("denied operations mutated state")}
 // An attacker-controlled role header must not grant permissions.
 req:=httptest.NewRequest("GET",a+"finance",nil)
 req.Header.Set("Authorization","Bearer "+roles[2].Token)
 req.Header.Set("X-Role","owner")
 w:=httptest.NewRecorder();g.ServeHTTP(w,req)
 if w.Code!=403{t.Fatal("role spoof",w.Code)}
 req.Header.Add("Authorization","Bearer "+owners[0].Token)
 w=httptest.NewRecorder();g.ServeHTTP(w,req)
 if w.Code!=401{t.Fatal("ambiguous credentials",w.Code)}
 body:=`{"items":[{"id":"milk","quantity":1}],"mode":"pickup","replacement":"skip","expectedPrice":{"unitPrices":{"milk":4900},"fee":0}}`
 w=tenantCall(g,"POST",a+"orders",roles[1].Token,"role-test-key",body)
 if w.Code!=201{t.Fatal(w.Code,w.Body.String())}
 var order retailOrder
 if err=json.Unmarshal(w.Body.Bytes(),&order);err!=nil{t.Fatal(err)}
 if w=tenantCall(g,"GET",a+"order?id="+order.ID,roles[2].Token,"","");w.Code!=403{t.Fatal("customer order leak",w.Code)}
 if w=tenantCall(g,"POST",a+"order?id="+order.ID,roles[1].Token,"",`{"status":"picking"}`);w.Code!=200{t.Fatal(w.Code,w.Body.String())}
 if w=tenantCall(g,"GET",a+"finance",owners[0].Token,"","");w.Code!=200{t.Fatal(w.Code)}
}
