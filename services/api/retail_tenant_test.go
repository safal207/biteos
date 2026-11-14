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
