package main

import (
 "bytes"
 _ "embed"
 "encoding/json"
 "errors"
 "io"
 "math"
 "os"
 "path/filepath"
 "regexp"
 "strconv"
 "strings"
 "unicode"
 "unicode/utf8"
)

//go:embed brand-presets.json
var brandPresetJSON []byte

type brandProfile struct{
 Version int `json:"version"`
 TenantID string `json:"tenantId"`
 Name string `json:"name"`
 Kind string `json:"kind"`
 Accent string `json:"accent"`
 Surface string `json:"surface"`
 Ink string `json:"ink"`
 Headline map[string]string `json:"headline"`
}
var brandColor=regexp.MustCompile("^#[0-9a-fA-F]{6}$")
func brandText(s string,max int)bool{
 if strings.TrimSpace(s)!=s||s==""||!utf8.ValidString(s)||utf8.RuneCountInString(s)>max{return false}
 for _,r:=range s{if unicode.IsControl(r)||unicode.Is(unicode.Cf,r){return false}}
 return true
}
func brandLuminance(hex string)float64{
 v,_:=strconv.ParseUint(hex[1:],16,32)
 channel:=func(n uint64)float64{f:=float64(n&255)/255;if f<=0.04045{return f/12.92};return math.Pow((f+0.055)/1.055,2.4)}
 return .2126*channel(v>>16)+.7152*channel(v>>8)+.0722*channel(v)
}
func brandContrast(a,b string)float64{
 x,y:=brandLuminance(a),brandLuminance(b);if x<y{x,y=y,x};return (x+.05)/(y+.05)
}
func validateBrand(p brandProfile,tenant string)error{
 if p.Version!=1||!validTenantID(tenant)||p.TenantID!=tenant||!brandText(p.Name,48){return errors.New("invalid brand identity")}
 switch p.Kind{case "retail","coffee","restaurant","bakery":default:return errors.New("invalid brand kind")}
 if len(p.Headline)!=3{return errors.New("exactly three translations required")}
 for _,l:=range []string{"tr","ru","en"}{if !brandText(p.Headline[l],120){return errors.New("invalid brand headline")}}
 for _,c:=range []string{p.Accent,p.Surface,p.Ink}{if !brandColor.MatchString(c){return errors.New("invalid brand color")}}
 if brandContrast(p.Accent,"#FFFFFF")<4.5||brandContrast(p.Ink,p.Surface)<4.5||brandContrast(p.Accent,p.Surface)<4.5{return errors.New("insufficient text contrast")}
 return nil
}
func defaultBrand(id string)(brandProfile,error){
 var profiles []brandProfile
 if err:=json.Unmarshal(brandPresetJSON,&profiles);err!=nil{return brandProfile{},err}
 for _,p:=range profiles{if p.TenantID==id{return p,validateBrand(p,id)}}
 p:=brandProfile{1,id,id,"retail","#A62239","#FFF8F1","#332427",map[string]string{"tr":"Yerel mağaza","ru":"Местный магазин","en":"Local store"}}
 return p,validateBrand(p,id)
}
func loadTenantBrand(root,id string)(brandProfile,error){
 if !validTenantID(id){return brandProfile{},errors.New("invalid tenant ID")}
 path:=filepath.Join(root,id+".brand.json")
 info,err:=os.Lstat(path)
 if errors.Is(err,os.ErrNotExist){return defaultBrand(id)}
 if err!=nil{return brandProfile{},err}
 if !info.Mode().IsRegular()||info.Size()>16384{return brandProfile{},errors.New("invalid brand file")}
 f,err:=os.Open(path);if err!=nil{return brandProfile{},err};defer f.Close()
 raw,err:=io.ReadAll(io.LimitReader(f,16385));if err!=nil{return brandProfile{},err}
 if len(raw)>16384{return brandProfile{},errors.New("brand file too large")}
 var p brandProfile
 d:=json.NewDecoder(bytes.NewReader(raw));d.DisallowUnknownFields()
 if d.Decode(&p)!=nil||d.Decode(&struct{}{})!=io.EOF{return brandProfile{},errors.New("invalid brand JSON")}
 return p,validateBrand(p,id)
}
