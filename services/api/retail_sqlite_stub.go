//go:build !sqlite || !cgo

package main

import "errors"

func openSQLiteRetailEngine(path string)(*retailEngine,error){return openSQLiteRetailEngineForTenant(path,"")}
func openSQLiteRetailEngineForTenant(path,tenant string)(*retailEngine,error){
	return nil,errors.New("SQLite backend requires a build with CGO_ENABLED=1 and -tags sqlite")
}
