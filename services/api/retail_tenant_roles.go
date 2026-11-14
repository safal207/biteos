package main

import (
 "crypto/sha256"
 "crypto/subtle"
 "errors"
 "os"
 "strings"
)

// These are service credentials for a trusted local pilot, not individual user identities.
type tenantRoleConfig struct { TenantID,Role,Token string }
type tenantRoleCredential struct { role string; digest [32]byte }

func validateTenantRoles(owners []tenantConfig, roles []tenantRoleConfig)(map[string][]tenantRoleCredential,error){
 result:=map[string][]tenantRoleCredential{}
 known:=map[string]bool{}
 used:=map[[32]byte]bool{}
 assigned:=map[[2]string]bool{}
 for _,o:=range owners{known[o.ID]=true;used[sha256.Sum256([]byte(o.Token))]=true}
 for _,c:=range roles{
  k:=[2]string{c.TenantID,c.Role}
  d:=sha256.Sum256([]byte(c.Token))
  if !known[c.TenantID] || (c.Role!="manager"&&c.Role!="cashier"&&c.Role!="customer") ||
   len(c.Token)<32||len(c.Token)>256||strings.ContainsAny(c.Token," \t\r\n")||used[d]||assigned[k]{
   return nil,errors.New("invalid or duplicate tenant role credential")
  }
  used[d]=true;assigned[k]=true
  result[c.TenantID]=append(result[c.TenantID],tenantRoleCredential{c.Role,sha256.Sum256([]byte("Bearer "+c.Token))})
 }
 return result,nil
}
func authenticateTenantRole(owner [32]byte,credentials []tenantRoleCredential,got [32]byte)string{
 role:=""
 if subtle.ConstantTimeCompare(owner[:],got[:])==1{role="owner"}
 for _,c:=range credentials{
  if subtle.ConstantTimeCompare(c.digest[:],got[:])==1{role=c.role}
 }
 return role
}
// Explicit allowlist, default deny. A shared customer credential cannot establish
// per-customer ownership; order reads/writes are deliberately NOT granted to it.
func tenantRoleAllowed(role,path,method string)bool{
 if !tenantAllowed(path,method){return false}
 if role=="owner"{return true}
 if role!="manager"&&role!="cashier"&&role!="customer"{return false}
 switch path{
 case "brand","catalog","delivery","universal-catalog":
  return true
 case "orders","order":
  return role=="manager"||role=="cashier"
 case "inventory","lifetime","demand","demand/plan":
  return role=="manager"
 default:
  return false
 }
}
func tenantRolesFromEnv(owners []tenantConfig)[]tenantRoleConfig{
 var result []tenantRoleConfig
 for _,o:=range owners{
  prefix:="BITEOS_TENANT_TOKEN_"+strings.ToUpper(strings.ReplaceAll(o.ID,"-","_"))+"_"
  for _,role:=range []string{"manager","cashier","customer"}{
   if token,ok:=os.LookupEnv(prefix+strings.ToUpper(role));ok{
    result=append(result,tenantRoleConfig{o.ID,role,token})
   }
  }
 }
 return result
}
