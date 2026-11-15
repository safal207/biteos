package main

import("testing")
func TestRecipeSnapshotIdentity(t *testing.T){
 c,err:=defaultUniversal("robys");if err!=nil{t.Fatal(err)}
 b,err:=loadRecipeBook(t.TempDir(),c);if err!=nil{t.Fatal(err)}
 i:=universalQuoteInput{"latte","large",2,map[string][]string{"extras":{"extra-shot","oat-drink"}}}
 a,err:=buildRecipeSnapshot(c,b,i);if err!=nil||!validRecipeSnapshot(a,"robys"){t.Fatal(a,err)}
 i.Selections["extras"]=[]string{"oat-drink","extra-shot"}
 next,err:=buildRecipeSnapshot(c,b,i);if err!=nil||a.Digest!=next.Digest{t.Fatal("option order changed identity",err)}
 i.Quantity=1
 next,err=buildRecipeSnapshot(c,b,i);if err!=nil||a.Digest==next.Digest{t.Fatal("quantity not bound",err)}
 i.Selections["alien"]=[]string{}
 if _,err=buildRecipeSnapshot(c,b,i);err==nil{t.Fatal("unknown empty group")}
 a.Report.DirectCost++
 // Recomputing the checksum cannot make inconsistent arithmetic valid.
 a.Digest=recipeSnapshotDigest(a)
 if validRecipeSnapshot(a,"robys"){t.Fatal("invalid arithmetic")}
 a,err=buildRecipeSnapshot(c,b,universalQuoteInput{"latte","regular",1,map[string][]string{"extras":{}}})
 if err!=nil||!validRecipeSnapshot(a,"robys"){t.Fatal("empty group",a,err)}
 if validRecipeSnapshot(a,"rozal"){t.Fatal("foreign snapshot")}
}
