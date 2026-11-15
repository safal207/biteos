package main

import("encoding/json";"os";"path/filepath";"testing")
func TestBrandProfilesAndContrast(t *testing.T){
 for _,id:=range []string{"rozal","robys","sample-shop"}{
  p,err:=defaultBrand(id);if err!=nil||p.TenantID!=id{t.Fatal(id,err)}
  if brandContrast(p.Ink,p.Surface)<4.5||brandContrast(p.Accent,"#FFFFFF")<4.5{t.Fatal("contrast",id)}
 }
 p,_:=defaultBrand("rozal")
 for _,change:=range []func(*brandProfile){
  func(b *brandProfile){b.TenantID="robys"},
  func(b *brandProfile){b.Accent="#EEEEEE"},
  func(b *brandProfile){b.Surface="url(foo)"},
  func(b *brandProfile){b.Name="bad\nname"},
  func(b *brandProfile){b.Name="bad\u202Ename"},
  func(b *brandProfile){delete(b.Headline,"en")},
  func(b *brandProfile){b.Kind="unknown"},
 }{
  v,_:=defaultBrand(p.TenantID);change(&v);if validateBrand(v,"rozal")==nil{t.Fatal("invalid brand accepted",v)}
 }
}
func TestBrandFileBoundary(t *testing.T){
 root:=t.TempDir();path:=filepath.Join(root,"rozal.brand.json")
 p,_:=defaultBrand("rozal");p.Name="Local test";raw,_:=json.Marshal(p)
 if err:=os.WriteFile(path,raw,0600);err!=nil{t.Fatal(err)}
 got,err:=loadTenantBrand(root,"rozal");if err!=nil||got.Name!=p.Name{t.Fatal(got,err)}
 if _,err=loadTenantBrand(root,"robys");err!=nil{t.Fatal(err)}
 p.TenantID="robys";raw,_=json.Marshal(p);if err=os.WriteFile(path,raw,0600);err!=nil{t.Fatal(err)}
 if _,err=loadTenantBrand(root,"rozal");err==nil{t.Fatal("foreign config")}
 if err=os.WriteFile(path,[]byte(`{"version":1,"extra":"invalid"}`),0600);err!=nil{t.Fatal(err)}
 if _,err=loadTenantBrand(root,"rozal");err==nil{t.Fatal("extra fields")}
 if err=os.Remove(path);err!=nil{t.Fatal(err)}
 if err=os.Symlink(filepath.Join(root,"unknown"),path);err!=nil{t.Fatal(err)}
 if _,err=loadTenantBrand(root,"rozal");err==nil{t.Fatal("symlink")}
}
