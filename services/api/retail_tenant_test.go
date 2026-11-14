package main

import("testing")
func TestTenantConfigValidation(t *testing.T){
 good:=[]tenantConfig{{"rozal","a-very-long-test-key-00000000000000"},{"robys","another-long-test-key-000000000000"}}
 if err:=validateTenantConfigs(good);err!=nil{t.Fatal(err)}
 for _,id:=range []string{"","../rozal","a/b","-a","a-","a_b","ROZAL","a.b"}{if validTenantID(id){t.Fatal(id)}}
 bad:=append([]tenantConfig(nil),good...);bad[1].Token=bad[0].Token;if validateTenantConfigs(bad)==nil{t.Fatal("duplicate key")}
 bad=append([]tenantConfig(nil),good...);bad[1].ID=bad[0].ID;if validateTenantConfigs(bad)==nil{t.Fatal("duplicate ID")}
 if !tenantLoopback("127.0.0.1:8092")||!tenantLoopback("[::1]:8092")||tenantLoopback("0.0.0.0:8092")||tenantLoopback(":8092"){t.Fatal("bind policy")}
}

func TestTenantRoleMatrix(t *testing.T){
 for _,c:=range []struct{role,path,method string;want bool}{
  {"owner","finance","GET",true},{"owner","business","GET",false},
  {"manager","inventory","POST",true},{"manager","finance","GET",false},
  {"manager","recipe-cost/review","POST",false},{"manager","observatory/plan","POST",false},
  {"cashier","orders","POST",true},{"cashier","order","POST",true},
  {"cashier","inventory","GET",false},{"cashier","finance","GET",false},
  {"customer","catalog","GET",true},{"customer","universal-catalog","POST",true},
  {"customer","order","GET",false},{"customer","orders","POST",false},
  {"customer","demand","POST",false},{"unknown","catalog","GET",false},
  {"owner","catalog","DELETE",false},
 }{if tenantRoleAllowed(c.role,c.path,c.method)!=c.want{t.Fatal(c)}}
}
func TestTenantRoleCredentials(t *testing.T){
 owners:=[]tenantConfig{{"rozal","a-very-long-test-key-00000000000000"},{"robys","another-long-test-key-000000000000"}}
 valid:=tenantRoleConfig{"rozal","cashier","cashier-credential-000000000000000"}
 if _,err:=validateTenantRoles(owners,[]tenantRoleConfig{valid});err!=nil{t.Fatal(err)}
 for _,bad:=range [][]tenantRoleConfig{
  {{"rozal","owner",valid.Token}},{{"unknown","cashier",valid.Token}},
  {{"rozal","cashier",owners[1].Token}},{{"rozal","customer","short"}},
  {valid,{"robys","customer",valid.Token}},
  {valid,{"rozal","cashier","another-cashier-credential-00000000"}},
 }{if _,err:=validateTenantRoles(owners,bad);err==nil{t.Fatal("invalid credential set accepted")}}
 t.Setenv("BITEOS_TENANT_TOKEN_ROZAL_CASHIER",valid.Token)
 configured:=tenantRolesFromEnv(owners)
 found:=false
 for _,c:=range configured{if c==valid{found=true}}
 if !found{t.Fatal("missing role configuration")}
}
