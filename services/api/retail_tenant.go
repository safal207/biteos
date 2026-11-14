package main

import (
 "crypto/sha256"
 "errors"
 "fmt"
 "net"
 "net/http"
 "os"
 "path/filepath"
 "strings"
 "time"
)

func validTenantID(id string)bool{
 if len(id)<1||len(id)>32{return false}
 for i,c:=range id{
  if c>='a'&&c<='z'||c>='0'&&c<='9'||c=='-'&&i>0&&i<len(id)-1{continue}
  return false
 }
 return true
}
type tenantConfig struct{ID,Token string}
type tenantEntry struct{digest [32]byte; engine *retailEngine; handler *http.ServeMux; brand brandProfile; catalog universalCatalog; recipes recipeBook}
type tenantGateway struct{entries map[string]tenantEntry; roles map[string][]tenantRoleCredential}
func validateTenantConfigs(config []tenantConfig)error{
 if len(config)<1||len(config)>8{return errors.New("configure 1–8 tenants")}
 ids:=map[string]bool{};keys:=map[[32]byte]bool{}
 for _,c:=range config{
  d:=sha256.Sum256([]byte(c.Token))
  if !validTenantID(c.ID)||ids[c.ID]||len(c.Token)<32||len(c.Token)>256||strings.ContainsAny(c.Token," \t\r\n")||keys[d]{return errors.New("invalid tenant ID or duplicate/invalid credential")}
  ids[c.ID]=true;keys[d]=true
 }
 return nil
}
// Separate SQLite databases and engines; no implicit tenant or legacy fallback.
// Root is operator-controlled, not supplied by an HTTP request.
func openTenantGateway(root string,config []tenantConfig)(*tenantGateway,error){
 return openTenantGatewayWithRoles(root,config,nil)
}
func openTenantGatewayWithRoles(root string,config []tenantConfig,roles []tenantRoleConfig)(*tenantGateway,error){
 if err:=validateTenantConfigs(config);err!=nil{return nil,err}
 credentials,err:=validateTenantRoles(config,roles);if err!=nil{return nil,err}
 if root==""{return nil,errors.New("explicit tenant root required")}
 if err:=os.MkdirAll(root,0700);err!=nil{return nil,err}
 absolute,err:=filepath.Abs(root);if err!=nil{return nil,err}
 info,err:=os.Lstat(absolute);if err!=nil||!info.IsDir()||info.Mode()&os.ModeSymlink!=0{return nil,errors.New("tenant root must be a real directory")}
 g:=&tenantGateway{entries:map[string]tenantEntry{},roles:credentials}
 for _,c:=range config{
  brand,err:=loadTenantBrand(absolute,c.ID);if err!=nil{return nil,fmt.Errorf("tenant %s brand: %w",c.ID,err)}
  catalog,err:=loadUniversal(absolute,c.ID);if err!=nil{return nil,fmt.Errorf("tenant %s catalog: %w",c.ID,err)}
  recipes,err:=loadRecipeBook(absolute,catalog);if err!=nil{return nil,fmt.Errorf("tenant %s recipes: %w",c.ID,err)}
  path:=filepath.Join(absolute,c.ID+".sqlite")
  for _,name:=range []string{path,path+"-wal",path+"-shm"}{
   f,err:=os.Lstat(name);if err==nil&&!f.Mode().IsRegular(){return nil,errors.New("tenant store must be a regular file")}
   if err!=nil&&!errors.Is(err,os.ErrNotExist){return nil,err}
  }
  e,err:=openSQLiteRetailEngineForTenant(path,c.ID)
  if err!=nil{return nil,fmt.Errorf("tenant %s: %w",c.ID,err)}
  mux:=http.NewServeMux();e.register(mux)
  g.entries[c.ID]=tenantEntry{sha256.Sum256([]byte("Bearer "+c.Token)),e,mux,brand,catalog,recipes}
 }
 return g,nil
}
// The route allowlist is a hard upper bound even for owner credentials.
// Legacy review/business and independent restaurant APIs are deliberately absent.
func tenantAllowed(path,method string)bool{
 switch path{
 case "decision-studio","business-learning","business-memory","observatory","brand","catalog","delivery","evidence","finance","lifetime","brain":return method=="GET"
 case "recipe-cost/review","recipe-cost","universal-catalog","order","inventory","growth","demand","twin","spatial":return method=="GET"||method=="POST"
 case "observatory/plan","observatory/observation","economic-intelligence","recipe-cost/snapshot","orders","demand/plan":return method=="POST"
 }
 return false
}
func(g *tenantGateway) ServeHTTP(w http.ResponseWriter,r *http.Request){
 w.Header().Set("Cache-Control","no-store")
 w.Header().Set("X-Content-Type-Options","nosniff")
 if r.URL.RawPath!=""||r.URL.EscapedPath()!=r.URL.Path||!strings.HasPrefix(r.URL.Path,"/api/tenants/"){fail(w,404,"tenant endpoint unavailable");return}
 parts:=strings.SplitN(strings.TrimPrefix(r.URL.Path,"/api/tenants/"),"/",3)
 if len(parts)!=3||!validTenantID(parts[0])||parts[1]!="retail"||!tenantAllowed(parts[2],r.Method){fail(w,404,"tenant endpoint unavailable");return}
 entry,ok:=g.entries[parts[0]]
 if !ok||len(r.Header.Values("Authorization"))!=1{fail(w,401,"tenant credential required");return}
 got:=sha256.Sum256([]byte(r.Header.Get("Authorization")))
 role:=authenticateTenantRole(entry.digest,g.roles[parts[0]],got)
 if role==""{fail(w,401,"tenant credential required");return}
 if !tenantRoleAllowed(role,parts[2],r.Method){fail(w,403,"tenant role forbidden");return}
 // Reject tenant selection via query or header: path is authoritative.
 if r.URL.Query().Has("tenant")||r.URL.Query().Has("tenantId")||r.Header.Get("X-Tenant-ID")!=""{fail(w,400,"tenant selection must use path only");return}
 if parts[2]=="brand"{respond(w,200,entry.brand);return}
 if parts[2]=="universal-catalog"{serveUniversal(w,r,entry.catalog);return}
 if parts[2]=="recipe-cost"{serveRecipe(w,r,entry.catalog,entry.recipes);return}
 if parts[2]=="recipe-cost/snapshot"{serveRecipeSnapshot(w,r,entry);return}
 if parts[2]=="recipe-cost/review"{serveRecipeReview(w,r,entry);return}
 if parts[2]=="economic-intelligence"{serveEconomic(w,r,entry);return}
 if parts[2]=="decision-studio"{serveDecisionStudio(w,entry,time.Now());return}
 if parts[2]=="business-learning"{serveBusinessLearning(w,entry,time.Now());return}
 if parts[2]=="business-memory"{serveBusinessMemory(w,entry,time.Now());return}
 if parts[2]=="observatory"{serveObservatory(w,r,entry,"list");return}
 if parts[2]=="observatory/plan"{serveObservatory(w,r,entry,"plan");return}
 if parts[2]=="observatory/observation"{serveObservatory(w,r,entry,"observation");return}
 clone:=r.Clone(r.Context());clone.URL.Path="/api/retail/"+parts[2];clone.URL.RawPath=""
 clone.RequestURI=clone.URL.RequestURI()
 // Authentication already happened. Never forward operator credentials.
 clone.Header.Del("Authorization")
 entry.handler.ServeHTTP(w,clone)
}
func tenantConfigsFromEnv()([]tenantConfig,error){
 raw:=os.Getenv("BITEOS_TENANTS")
 configs:=[]tenantConfig{}
 for _,id:=range strings.Split(raw,","){
  if !validTenantID(id){return nil,errors.New("invalid BITEOS_TENANTS")}
  name:="BITEOS_TENANT_TOKEN_"+strings.ToUpper(strings.ReplaceAll(id,"-","_"))
  configs=append(configs,tenantConfig{id,os.Getenv(name)})
 }
 return configs,validateTenantConfigs(configs)
}
func tenantLoopback(addr string)bool{
 host,_,err:=net.SplitHostPort(addr)
 if err!=nil{return false}
 ip:=net.ParseIP(host);return ip!=nil&&ip.IsLoopback()
}
func runTenantServer()error{
 configs,err:=tenantConfigsFromEnv();if err!=nil{return err}
 addr:=env("BITEOS_TENANT_ADDR","127.0.0.1:8092")
 if !tenantLoopback(addr){return errors.New("tenant demo requires literal loopback address")}
 g,err:=openTenantGatewayWithRoles(os.Getenv("BITEOS_TENANT_ROOT"),configs,tenantRolesFromEnv(configs));if err!=nil{return err}
 server:=&http.Server{Addr:addr,Handler:g,ReadHeaderTimeout:5*time.Second,ReadTimeout:10*time.Second,WriteTimeout:10*time.Second,IdleTimeout:60*time.Second}
 return server.ListenAndServe()
}
