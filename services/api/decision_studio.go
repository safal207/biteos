package main

import("net/http";"time")

type decisionStudioReport struct{
 Version int `json:"version"`
 TenantID string `json:"tenantId"`
 GeneratedAt time.Time `json:"generatedAt"`
 Memory businessMemoryReport `json:"memory"`
 Learning businessLearningReport `json:"learning"`
 ExternalEffectsAuthorized bool `json:"externalEffectsAuthorized"`
}
// Both projections share one tenant lock and evaluation clock.
func serveDecisionStudio(w http.ResponseWriter,entry tenantEntry,now time.Time){
 e:=entry.engine;e.mu.Lock();defer e.mu.Unlock()
 if e.storageFailed||e.sqliteSave==nil||e.tenantID!=entry.catalog.TenantID{fail(w,503,"tenant storage unavailable");return}
 respond(w,200,decisionStudioReport{Version:1,TenantID:e.tenantID,GeneratedAt:now.UTC(),Memory:projectBusinessMemory(e,now),Learning:projectBusinessLearning(e,now)})
}
