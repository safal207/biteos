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
