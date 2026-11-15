package main

import (
	"errors"
	"fmt"
	"net/http"
	"sort"
)

// Fixed, illustrative opening-stock unit costs in kuruş. Procurement uses the
// recorded receipt cost. No real merchant accounting or payment is implied.
var financeOpeningCost=map[string]int64{"avocado":2800,"banana":2500,"milk":3100,"eggs":4600,"bread":4000,"buckwheat":6500,"dumplings":11500}
type financeLot struct {qty int; cost int64; useBy string; id string}
type financeAllocation struct {lot *financeLot; qty int}
type financeProduct struct {
	ID string `json:"id"`
	Name map[string]string `json:"name"`
	Category string `json:"category"`
	UnitsSold int `json:"unitsSold"`
	Revenue int64 `json:"revenue"`
	COGS int64 `json:"cogs"`
	GrossProfit int64 `json:"grossProfit"`
	AvailableStock int `json:"availableStock"`
	AvailableValue int64 `json:"availableValue"`
	MaxAvailableUnitCost int64 `json:"maxAvailableUnitCost"`
	ReservedValue int64 `json:"reservedValue"`
}
type financeReport struct {
	Demo bool `json:"demo"`
	Currency string `json:"currency"`
	Method string `json:"method"`
	Fulfilled int `json:"fulfilled"`
	Open int `json:"open"`
	Cancelled int `json:"cancelled"`
	Revenue int64 `json:"revenue"`
	COGS int64 `json:"cogs"`
	GrossProfit int64 `json:"grossProfit"`
	DeliveryFees int64 `json:"deliveryFees"`
	DeliveryCost int64 `json:"deliveryCost"`
	Contribution int64 `json:"contribution"`
	AvailableValue int64 `json:"availableValue"`
	ReservedValue int64 `json:"reservedValue"`
	Products []financeProduct `json:"products"`
	availableLots map[string][]*financeLot
	orderUseBy map[string]string
}

// Caller holds the engine lock. Rebuild costs from movement order, not current
// prices. Cancellation releases precisely the original allocated lots (FIFO).
func(e *retailEngine) financeProjection()(financeReport,error){
	r:=financeReport{Demo:true,Currency:"TRY",Method:"demo-fifo-at-reservation-v1",Products:[]financeProduct{}}
	if err:=validateRetailState(e.state());err!=nil{return r,err}
	lots:=map[string][]*financeLot{}
	r.availableLots=lots
	r.orderUseBy=map[string]string{}
	alloc:=map[string]map[string][]financeAllocation{}
	released:=map[string]map[string]bool{}
	rows:=map[string]*financeProduct{}
	lineQty:=map[string]map[string]int{}
	for id,o:=range e.orders{
		lineQty[id]=map[string]int{}
		alloc[id]=map[string][]financeAllocation{}
		released[id]=map[string]bool{}
		var subtotal int64
		for _,line:=range o.Lines{
			if line.Quantity<1||line.Quantity>20||line.UnitPrice<1||line.UnitPrice>100000000||lineQty[id][line.ID]!=0{return r,errors.New("invalid order lines")}
			lineQty[id][line.ID]=line.Quantity
			subtotal+=line.UnitPrice*int64(line.Quantity)
		}
		if subtotal!=o.Subtotal||o.Fee<0||o.Total!=subtotal+o.Fee||o.Currency!="TRY"{return r,errors.New("inconsistent order totals")}
		if o.Mode=="pickup"&&o.Fee!=0{return r,errors.New("pickup fee")}
		if o.Mode=="delivery"{zone,_,ok:=findRetailSlot(o.ZoneID,o.SlotID);if !ok||o.Fee!=zone.Fee{return r,errors.New("delivery fee mismatch")}}
	}
	for _,p:=range newRetailEngine().products{
		cost,ok:=financeOpeningCost[p.ID];if !ok{return r,errors.New("missing opening cost")}
		lots[p.ID]=[]*financeLot{{qty:p.Stock,cost:cost,id:"opening-"+p.ID}}
		rows[p.ID]=&financeProduct{ID:p.ID,Name:p.Name,Category:p.Category}
	}
	for idx,m:=range e.movements{
		if rows[m.ProductID]==nil{return r,errors.New("unknown product")}
		switch m.Kind{
		case "receive":
			if m.Delta<1||m.Delta>1000||m.UnitCost<1||m.UnitCost>100000000{return r,errors.New("invalid receiving cost")}
			lots[m.ProductID]=append(lots[m.ProductID],&financeLot{qty:m.Delta,cost:m.UnitCost,useBy:m.UseBy,id:fmt.Sprintf("receipt-%d",idx+1)})
		case "reserve":
			n:=-m.Delta
			if n<1||lineQty[m.Reference][m.ProductID]!=n||len(alloc[m.Reference][m.ProductID])!=0{return r,errors.New("invalid reserve allocation")}
			parts:=[]financeAllocation{}
			for _,lot:=range lots[m.ProductID]{
				if n==0{break}
				take:=lot.qty;if take>n{take=n}
				if take==0{continue}
				lot.qty-=take;n-=take;parts=append(parts,financeAllocation{lot,take})
			}
			if n!=0{return r,errors.New("unfunded allocation")}
			alloc[m.Reference][m.ProductID]=parts
		case "release":
			parts:=alloc[m.Reference][m.ProductID]
			if len(parts)==0||released[m.Reference][m.ProductID]||m.Delta!=lineQty[m.Reference][m.ProductID]{return r,errors.New("invalid release")}
			for _,a:=range parts{a.lot.qty+=a.qty}
			released[m.Reference][m.ProductID]=true
		default:return r,errors.New("unknown movement")
		}
	}
	for id,o:=range e.orders{
		fulfilled:=(o.Mode=="delivery"&&o.Status=="delivered")||(o.Mode=="pickup"&&o.Status=="collected")
		cancelled:=o.Status=="cancelled"
		if fulfilled{r.Fulfilled++}else if cancelled{r.Cancelled++}else{
			if o.Status!="reserved"&&o.Status!="picking"&&o.Status!="packed"&&!(o.Mode=="delivery"&&o.Status=="in_transit"){return r,errors.New("unknown fulfillment status")}
			r.Open++
		}
		for _,line:=range o.Lines{
			row:=rows[line.ID];parts:=alloc[id][line.ID]
			if row==nil||len(parts)==0||released[id][line.ID]!=cancelled{return r,errors.New("allocation mismatch")}
			var cost int64
			for _,a:=range parts{
				cost+=int64(a.qty)*a.lot.cost
				if a.lot.useBy!=""&&(r.orderUseBy[id]==""||a.lot.useBy<r.orderUseBy[id]){r.orderUseBy[id]=a.lot.useBy}
			}
			if fulfilled{
				row.UnitsSold+=line.Quantity;row.Revenue+=line.UnitPrice*int64(line.Quantity);row.COGS+=cost
			}else if !cancelled{row.ReservedValue+=cost}
		}
		if fulfilled&&o.Mode=="delivery"{
			r.DeliveryFees+=o.Fee
			// Sample variable fulfillment expense, not actual courier rates.
			if o.ZoneID=="center"{r.DeliveryCost+=4500}else{r.DeliveryCost+=8000}
		}
	}
	for _,p:=range e.products{
		row:=rows[p.ID]
		for _,lot:=range lots[p.ID]{row.AvailableStock+=lot.qty;row.AvailableValue+=int64(lot.qty)*lot.cost;if lot.qty>0&&lot.cost>row.MaxAvailableUnitCost{row.MaxAvailableUnitCost=lot.cost}}
		if row.AvailableStock!=p.Stock{return r,errors.New("finance stock mismatch")}
		row.GrossProfit=row.Revenue-row.COGS
		r.Revenue+=row.Revenue;r.COGS+=row.COGS;r.AvailableValue+=row.AvailableValue;r.ReservedValue+=row.ReservedValue
		r.Products=append(r.Products,*row)
	}
	sort.Slice(r.Products,func(i,j int)bool{return r.Products[i].ID<r.Products[j].ID})
	r.GrossProfit=r.Revenue-r.COGS
	r.Contribution=r.GrossProfit+r.DeliveryFees-r.DeliveryCost
	return r,nil
}

func(e *retailEngine) finance(w http.ResponseWriter,r *http.Request){
	if !method(w,r,"GET"){return}
	e.mu.Lock()
	defer e.mu.Unlock()
	if e.storageFailed{fail(w,503,"storage recovery required");return}
	report,err:=e.financeProjection()
	if err!=nil{fail(w,503,"finance reconciliation unavailable");return}
	respond(w,200,report)
}
