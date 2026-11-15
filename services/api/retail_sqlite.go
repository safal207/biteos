//go:build sqlite && cgo

package main

/*
#cgo pkg-config: sqlite3
#include <sqlite3.h>
#include <stdlib.h>
*/
import "C"

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"unsafe"
)

// Narrow system SQLite binding. No third-party Go driver and no network API.
type retailSQLConn struct { db *C.sqlite3 }

func connectRetailSQL(path string) (*retailSQLConn,error) {
	p:=C.CString(path)
	defer C.free(unsafe.Pointer(p))
	var db *C.sqlite3
	rc:=C.sqlite3_open_v2(p,&db,C.SQLITE_OPEN_READWRITE|C.SQLITE_OPEN_FULLMUTEX,nil)
	if rc!=C.SQLITE_OK {
		if db!=nil {C.sqlite3_close(db)}
		return nil,fmt.Errorf("sqlite open: %d",int(rc))
	}
	c:=&retailSQLConn{db}
	C.sqlite3_busy_timeout(db,5000)
	if err:=c.exec("PRAGMA synchronous=FULL");err!=nil {c.close();return nil,err}
	return c,nil
}
func(c *retailSQLConn) close(){C.sqlite3_close(c.db)}
func(c *retailSQLConn) exec(sql string) error {
	q:=C.CString(sql)
	defer C.free(unsafe.Pointer(q))
	if rc:=C.sqlite3_exec(c.db,q,nil,nil,nil);rc!=C.SQLITE_OK{
		return fmt.Errorf("sqlite exec: %s",C.GoString(C.sqlite3_errmsg(c.db)))
	}
	return nil
}
func(c *retailSQLConn) query(sql string, consume func(*C.sqlite3_stmt)error)error{
	q:=C.CString(sql)
	defer C.free(unsafe.Pointer(q))
	var stmt *C.sqlite3_stmt
	if C.sqlite3_prepare_v2(c.db,q,-1,&stmt,nil)!=C.SQLITE_OK{return fmt.Errorf("sqlite prepare: %s",C.GoString(C.sqlite3_errmsg(c.db)))}
	defer C.sqlite3_finalize(stmt)
	for {
		switch C.sqlite3_step(stmt){
		case C.SQLITE_DONE:return nil
		case C.SQLITE_ROW:if err:=consume(stmt);err!=nil{return err}
		default:return fmt.Errorf("sqlite step: %s",C.GoString(C.sqlite3_errmsg(c.db)))
		}
	}
}
func sqlBytes(s *C.sqlite3_stmt,i int)[]byte{
	return C.GoBytes(C.sqlite3_column_blob(s,C.int(i)),C.sqlite3_column_bytes(s,C.int(i)))
}
// All variable text is hex-encoded as BLOB literals, never interpolated as SQL syntax.
func sqliteBlob(b []byte)string{return fmt.Sprintf("X'%x'",b)}

const retailSQLSchema = `
CREATE TABLE retail_state (id INTEGER PRIMARY KEY CHECK(id=1), schema_version INTEGER NOT NULL CHECK(schema_version=1), payload BLOB NOT NULL, digest BLOB NOT NULL CHECK(length(digest)=64));
CREATE TABLE retail_outbox (seq INTEGER PRIMARY KEY CHECK(seq>0), event_id BLOB NOT NULL UNIQUE, digest BLOB NOT NULL, payload BLOB NOT NULL);
`

func openSQLiteRetailEngine(path string)(*retailEngine,error){return openSQLiteRetailEngineForTenant(path,"")}
func openSQLiteRetailEngineForTenant(path,tenant string)(*retailEngine,error){
	if tenant!=""&&!validTenantID(tenant){return nil,errors.New("invalid tenant binding")}
	if path=="" {return nil,errors.New("explicit RETAIL_STORE required for SQLite")}
	if err:=os.MkdirAll(filepath.Dir(path),0700);err!=nil{return nil,err}
	f,err:=os.OpenFile(path,os.O_CREATE|os.O_EXCL|os.O_WRONLY,0600)
	fresh:=err==nil
	if fresh {if err=f.Close();err!=nil{return nil,err}} else if !errors.Is(err,os.ErrExist){return nil,err}
	c,err:=connectRetailSQL(path)
	if err!=nil{return nil,err}
	defer c.close()
	mode:=""
	pragma:="PRAGMA journal_mode"
	if fresh {pragma="PRAGMA journal_mode=WAL"}
	if err=c.query(pragma,func(s *C.sqlite3_stmt)error{mode=string(sqlBytes(s,0));return nil});err!=nil{return nil,err}
	if mode!="wal"{return nil,errors.New("SQLite retail database must use WAL")}
	if err=c.exec("BEGIN IMMEDIATE");err!=nil{return nil,err}
	defer c.exec("ROLLBACK")
	e:=newRetailEngine()
	e.tenantID=tenant
	if fresh{
		if err=c.exec(retailSQLSchema);err!=nil{return nil,err}
		raw,err:=json.Marshal(e.state());if err!=nil{return nil,err}
		if err=c.exec("INSERT INTO retail_state VALUES(1,1,"+sqliteBlob(raw)+","+sqliteBlob([]byte(checkpointDigest(raw)))+")");err!=nil{return nil,err}
	}
	var raw []byte
	count:=0
	if err=c.query("SELECT payload,digest,schema_version FROM retail_state WHERE id=1",func(s *C.sqlite3_stmt)error{
		count++
		raw=sqlBytes(s,0)
		if C.sqlite3_column_int(s,2)!=1||checkpointDigest(raw)!=string(sqlBytes(s,1)){return errors.New("sqlite state checksum/version mismatch")}
		return nil
	});err!=nil{return nil,err}
	if count!=1{return nil,errors.New("missing SQLite retail state")}
	var state retailState
	if err=json.Unmarshal(raw,&state);err!=nil{return nil,err}
	if err=validateRetailState(state);err!=nil{return nil,err}
	if state.TenantID!=tenant{return nil,errors.New("SQLite tenant binding mismatch")}
	i:=0
	if err=c.query("SELECT seq,event_id,digest,payload FROM retail_outbox ORDER BY seq",func(s *C.sqlite3_stmt)error{
		if i>=len(state.Evidence){return errors.New("unexpected outbox event")}
		ev:=state.Evidence[i]
		var stored retailEvidence
		if err:=json.Unmarshal(sqlBytes(s,3),&stored);err!=nil{return err}
		if int(C.sqlite3_column_int64(s,0))!=ev.Sequence||string(sqlBytes(s,1))!=ev.EventID||string(sqlBytes(s,2))!=ev.Digest||retailDigest(stored)!=ev.Digest||stored.Digest!=ev.Digest{return errors.New("outbox mismatch")}
		i++
		return nil
	});err!=nil{return nil,err}
	if i!=len(state.Evidence){return nil,errors.New("missing outbox events")}
	if err=c.exec("COMMIT");err!=nil{return nil,err}
	e.restore(state)
	// Keep the exact initial bytes for compare-and-set; JSON may be reencoded
	// by later compatible builds. Prevent stale writers from overwriting state.
	priorDigest:=checkpointDigest(raw)
	e.sqliteSave=func(before []byte,next retailState)error{
		if err:=validateRetailState(next);err!=nil{return err}
		if next.TenantID!=tenant{return errors.New("tenant binding changed")}
		var previous retailState
		if err:=json.Unmarshal(before,&previous);err!=nil{return err}
		for id,v:=range previous.RecipeReviews{if n,ok:=next.RecipeReviews[id];!ok||n.Digest!=v.Digest{return errors.New("recipe review history changed")}}
		for id,v:=range previous.ObservationPlans{if n,ok:=next.ObservationPlans[id];!ok||n.Digest!=v.Digest{return errors.New("observation plan history changed")}}
		for id,v:=range previous.ObservationResults{if n,ok:=next.ObservationResults[id];!ok||n.Digest!=v.Digest{return errors.New("observation result history changed")}}
		if len(next.Evidence)<len(previous.Evidence){return errors.New("outbox truncation")}
		for i,v:=range previous.Evidence{if next.Evidence[i].Digest!=v.Digest{return errors.New("outbox history changed")}}
		raw,err:=json.Marshal(next);if err!=nil{return err}
		nextDigest:=checkpointDigest(raw)
		db,err:=connectRetailSQL(path);if err!=nil{return err}
		defer db.close()
		if err=db.exec("BEGIN IMMEDIATE");err!=nil{return err}
		defer db.exec("ROLLBACK")
		if err=db.exec("UPDATE retail_state SET payload="+sqliteBlob(raw)+",digest="+sqliteBlob([]byte(nextDigest))+" WHERE id=1 AND digest="+sqliteBlob([]byte(priorDigest)));err!=nil{return err}
		if C.sqlite3_changes(db.db)!=1{return errors.New("stale SQLite state")}
		for _,ev:=range next.Evidence[len(previous.Evidence):]{
			b,err:=json.Marshal(ev);if err!=nil{return err}
			if err=db.exec(fmt.Sprintf("INSERT INTO retail_outbox VALUES(%d,%s,%s,%s)",ev.Sequence,sqliteBlob([]byte(ev.EventID)),sqliteBlob([]byte(ev.Digest)),sqliteBlob(b)));err!=nil{return err}
		}
		if err=db.exec("COMMIT");err!=nil{return err}
		priorDigest=nextDigest
		return nil
	}
	return e,nil
}
