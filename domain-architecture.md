# DOMAIN ARCHITECTURE

**System:** Sales & Inventory System (ERP-Ready)
**Version:** v1.0
**Architecture:** Modular Monolith with Domain-Driven Design
**Language:** Go 1.21+
**Database:** PostgreSQL with Row Level Security

---

## 1. ARCHITECTURAL OVERVIEW

### 1.1 Design Principles

This system follows **Domain-Driven Design (DDD)** with **Clean Architecture** (Hexagonal Architecture) patterns, implemented as a **modular monolith** that can evolve into microservices when needed.

**Core Principles:**

1. **Modular Monolith First**
   - Single deployable application
   - Bounded contexts as independent modules
   - Shared database with logical separation
   - Clear module boundaries for future extraction

2. **Domain-Driven Design**
   - Business logic in domain layer (aggregates, entities, value objects)
   - Ubiquitous language shared between technical and business teams
   - Bounded contexts with explicit boundaries
   - Domain events for module communication

3. **Clean Architecture (Hexagonal)**
   - Domain layer has no external dependencies
   - Infrastructure abstracted behind interfaces (ports)
   - Dependency inversion (domain defines interfaces, infrastructure implements)
   - Testable business logic

4. **CQRS Pattern**
   - Separate commands (writes) from queries (reads)
   - Commands go through aggregates and enforce business rules
   - Queries use optimized read models

5. **Multi-Tenancy Ready**
   - Company-based data isolation using Row Level Security
   - Every record tagged with company_id
   - Support for multi-branch operations

### 1.2 Four-Layer Architecture

```
┌────────────────────────────────────────────────────────┐
│                 PRESENTATION LAYER                     │
│         (HTTP Handlers, GraphQL, CLI Commands)         │
│                 Depends on: Application                │
└────────────────────────────────────────────────────────┘
                            ↓
┌────────────────────────────────────────────────────────┐
│                  APPLICATION LAYER                     │
│        (Use Cases, DTOs, Application Services)         │
│    Orchestrates: Domain + Infrastructure via Ports     │
└────────────────────────────────────────────────────────┘
                            ↓
┌────────────────────────────────────────────────────────┐
│                    DOMAIN LAYER                        │
│  (Aggregates, Entities, Value Objects, Domain Events)  │
│           *** PURE BUSINESS LOGIC ***                  │
│            NO INFRASTRUCTURE DEPENDENCIES              │
└────────────────────────────────────────────────────────┘
                            ↓
┌────────────────────────────────────────────────────────┐
│                INFRASTRUCTURE LAYER                    │
│     (Postgres Repos, Event Bus, External Services)     │
│         Implements: Domain Interfaces (Adapters)       │
└────────────────────────────────────────────────────────┘
```

### 1.3 Module Structure

```
┌─────────────────────────────────────────────────────────────┐
│                   SINGLE APPLICATION                        │
│                  (Modular Monolith)                         │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  INVENTORY   │  │    SALES     │  │     USER     │     │
│  │   MODULE     │  │   MODULE     │  │   MODULE     │     │
│  │              │  │              │  │              │     │
│  │  - Domain    │  │  - Domain    │  │  - Domain    │     │
│  │  - App       │  │  - App       │  │  - App       │     │
│  │  - Infra     │  │  - Infra     │  │  - Infra     │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│         │                 │                 │              │
│         └─────────────────┼─────────────────┘              │
│                           ↓                                │
│              ┌────────────────────────┐                    │
│              │  In-Process Event Bus  │                    │
│              └────────────────────────┘                    │
└─────────────────────────────────────────────────────────────┘
                            ↓
        ┌───────────────────────────────────────┐
        │    PostgreSQL Database (Shared)       │
        │      with Row Level Security          │
        │                                       │
        │  ┌─────────────────────────────┐     │
        │  │  Inventory Tables           │     │
        │  │  - items, warehouses, etc.  │     │
        │  └─────────────────────────────┘     │
        │  ┌─────────────────────────────┐     │
        │  │  Sales Tables               │     │
        │  │  - customers, orders, etc.  │     │
        │  └─────────────────────────────┘     │
        │  ┌─────────────────────────────┐     │
        │  │  Shared Tables              │     │
        │  │  - users, roles, audit      │     │
        │  └─────────────────────────────┘     │
        └───────────────────────────────────────┘
```

---

## 2. BOUNDED CONTEXTS

### 2.1 Context Map

| Context | Responsibility | Aggregates | Upstream/Downstream |
|---------|---------------|------------|---------------------|
| **Inventory** | Manage items, warehouses, stock movements, valuation | Item, Warehouse, StockTransaction, BillOfMaterials | Upstream to Sales |
| **Sales** | Manage customers, quotations, orders, deliveries, invoices, payments | Customer, Quotation, SalesOrder, Delivery, Invoice, Payment | Downstream from Inventory |
| **User** | Authentication, authorization, roles, permissions | User, Role, Permission | Upstream to all |
| **Shared Kernel** | Common value objects, interfaces, events | Money, Quantity, Address, ContactInfo | Shared by all |

### 2.2 Module Communication

**Primary: Domain Events (In-Process)**

```go
// Inventory Module raises event
event := inventory.StockAdjustedEvent{
    ItemID:      itemID,
    WarehouseID: warehouseID,
    NewQuantity: newQty,
}
eventBus.Publish(ctx, event)

// Sales Module listens and reacts
func (h *StockEventHandler) Handle(event inventory.StockAdjustedEvent) {
    // Update read model, check pending orders, etc.
}
```

**Secondary: Application Service Calls**

```go
// Sales calls Inventory via interface
type StockQueryPort interface {
    GetAvailableStock(ctx context.Context, itemID, warehouseID string) (Quantity, error)
}

// Used for immediate consistency needs (e.g., checking stock before order)
available, err := stockQuery.GetAvailableStock(ctx, orderItem.ItemID, warehouseID)
```

---

## 3. INVENTORY CONTEXT

### 3.1 Bounded Context Responsibility

Manages all inventory-related operations:
- Item master data (products, materials, services)
- Warehouse locations and stock levels
- Stock movements (in, out, transfers, adjustments)
- Reorder level management and alerts
- Inventory valuation (FIFO, LIFO, Average)
- Batch/serial number tracking
- Bill of Materials (BOM) for composite items

### 3.2 Domain Model

#### 3.2.1 Item Aggregate

**Aggregate Root:** Item

```go
// pkg/domain/inventory/item.go

package inventory

import (
    "errors"
    "time"
    "github.com/google/uuid"
    "github.com/shopspring/decimal"
)

// Item - Aggregate root for inventory items
type Item struct {
    // Identity
    id        uuid.UUID
    companyID uuid.UUID
    code      ItemCode      // Value object
    version   int

    // Attributes
    name         string
    description  string
    categoryID   *uuid.UUID
    itemType     ItemType    // Value object
    uom          UnitOfMeasure // Value object

    // Pricing
    standardCost  *Money  // Value object
    averageCost   *Money
    listPrice     *Money

    // Tracking settings
    trackBatch    bool
    trackSerial   bool
    hasExpiry     bool
    allowNegative bool

    // Status
    isActive   bool
    createdAt  time.Time
    updatedAt  time.Time
    createdBy  uuid.UUID

    // Domain events
    events []DomainEvent
}

// ItemCode - Value object ensuring valid item codes
type ItemCode struct {
    value string
}

func NewItemCode(code string) (ItemCode, error) {
    if code == "" {
        return ItemCode{}, errors.New("item code cannot be empty")
    }
    if len(code) > 50 {
        return ItemCode{}, errors.New("item code too long (max 50 chars)")
    }
    return ItemCode{value: code}, nil
}

func (ic ItemCode) String() string {
    return ic.value
}

// ItemType - Enumeration
type ItemType string

const (
    ItemTypeRawMaterial  ItemType = "raw_material"
    ItemTypeFinishedGood ItemType = "finished_good"
    ItemTypeService      ItemType = "service"
    ItemTypeAsset        ItemType = "asset"
)

// Factory method
func NewItem(
    companyID uuid.UUID,
    code ItemCode,
    name string,
    itemType ItemType,
    uom UnitOfMeasure,
    createdBy uuid.UUID,
) (*Item, error) {
    if name == "" {
        return nil, errors.New("item name is required")
    }

    item := &Item{
        id:        uuid.New(),
        companyID: companyID,
        code:      code,
        name:      name,
        itemType:  itemType,
        uom:       uom,
        isActive:  true,
        createdAt: time.Now(),
        updatedAt: time.Now(),
        createdBy: createdBy,
        version:   1,
        events:    []DomainEvent{},
    }

    // Raise domain event
    event := ItemCreatedEvent{
        ItemID:    item.id,
        CompanyID: companyID,
        Code:      code.String(),
        Name:      name,
        ItemType:  string(itemType),
        CreatedAt: item.createdAt,
        CreatedBy: createdBy,
    }
    item.AddEvent(event)

    return item, nil
}

// Business methods
func (i *Item) UpdatePricing(standardCost, listPrice *Money) error {
    if standardCost != nil && standardCost.Amount().LessThan(decimal.Zero) {
        return errors.New("standard cost cannot be negative")
    }
    if listPrice != nil && listPrice.Amount().LessThan(decimal.Zero) {
        return errors.New("list price cannot be negative")
    }

    i.standardCost = standardCost
    i.listPrice = listPrice
    i.updatedAt = time.Now()

    event := ItemPricingUpdatedEvent{
        ItemID:       i.id,
        StandardCost: standardCost,
        ListPrice:    listPrice,
        UpdatedAt:    i.updatedAt,
    }
    i.AddEvent(event)

    return nil
}

func (i *Item) Deactivate(reason string) error {
    if !i.isActive {
        return errors.New("item is already inactive")
    }

    i.isActive = false
    i.updatedAt = time.Now()

    event := ItemDeactivatedEvent{
        ItemID:    i.id,
        Reason:    reason,
        UpdatedAt: i.updatedAt,
    }
    i.AddEvent(event)

    return nil
}

func (i *Item) Activate() error {
    if i.isActive {
        return errors.New("item is already active")
    }

    i.isActive = true
    i.updatedAt = time.Now()

    event := ItemActivatedEvent{
        ItemID:    i.id,
        UpdatedAt: i.updatedAt,
    }
    i.AddEvent(event)

    return nil
}

// Aggregate root interface implementation
func (i *Item) ID() uuid.UUID            { return i.id }
func (i *Item) Version() int              { return i.version }
func (i *Item) Events() []DomainEvent     { return i.events }
func (i *Item) ClearEvents()              { i.events = []DomainEvent{} }
func (i *Item) AddEvent(event DomainEvent) { i.events = append(i.events, event) }
```

#### 3.2.2 Warehouse Aggregate

**Aggregate Root:** Warehouse

```go
// pkg/domain/inventory/warehouse.go

package inventory

import (
    "errors"
    "github.com/google/uuid"
    "github.com/shopspring/decimal"
)

// Warehouse - Aggregate root managing stock levels
type Warehouse struct {
    id          uuid.UUID
    companyID   uuid.UUID
    code        string
    name        string
    type_       WarehouseType
    address     Address     // Value object
    contactInfo ContactInfo // Value object
    isActive    bool

    // Stock levels (entities within aggregate)
    stockLevels map[uuid.UUID]*StockLevel // key: itemID

    version int
    events  []DomainEvent
}

type WarehouseType string

const (
    WarehouseTypeMain    WarehouseType = "main"
    WarehouseTypeTransit WarehouseType = "transit"
    WarehouseTypeRetail  WarehouseType = "retail"
)

// StockLevel - Entity within Warehouse aggregate
type StockLevel struct {
    itemID           uuid.UUID
    currentQty       Quantity // Value object
    reservedQty      Quantity
    availableQty     Quantity // Derived: current - reserved
    reorderLevel     Quantity
    reorderQty       Quantity
    lastMovementDate time.Time
}

func NewWarehouse(
    companyID uuid.UUID,
    code, name string,
    warehouseType WarehouseType,
) (*Warehouse, error) {
    if code == "" || name == "" {
        return nil, errors.New("warehouse code and name are required")
    }

    wh := &Warehouse{
        id:          uuid.New(),
        companyID:   companyID,
        code:        code,
        name:        name,
        type_:       warehouseType,
        isActive:    true,
        stockLevels: make(map[uuid.UUID]*StockLevel),
        version:     1,
        events:      []DomainEvent{},
    }

    event := WarehouseCreatedEvent{
        WarehouseID: wh.id,
        CompanyID:   companyID,
        Code:        code,
        Name:        name,
    }
    wh.AddEvent(event)

    return wh, nil
}

// AdjustStock - Core business method
func (w *Warehouse) AdjustStock(
    itemID uuid.UUID,
    quantity Quantity,
    reason string,
) error {
    if !w.isActive {
        return errors.New("cannot adjust stock in inactive warehouse")
    }

    stockLevel, exists := w.stockLevels[itemID]
    if !exists {
        // Initialize stock level for new item
        stockLevel = &StockLevel{
            itemID:     itemID,
            currentQty: NewQuantity(decimal.Zero, quantity.Unit()),
            reservedQty: NewQuantity(decimal.Zero, quantity.Unit()),
        }
        w.stockLevels[itemID] = stockLevel
    }

    // Calculate new quantity
    newQty := stockLevel.currentQty.Add(quantity)

    // Business rule: Check negative stock
    if newQty.Amount().LessThan(decimal.Zero) {
        // Check if item allows negative stock
        // This would require a domain service to check item settings
        return errors.New("stock cannot go negative")
    }

    oldQty := stockLevel.currentQty
    stockLevel.currentQty = newQty
    stockLevel.availableQty = newQty.Subtract(stockLevel.reservedQty)
    stockLevel.lastMovementDate = time.Now()

    event := StockAdjustedEvent{
        WarehouseID: w.id,
        ItemID:      itemID,
        OldQuantity: oldQty,
        NewQuantity: newQty,
        Reason:      reason,
        AdjustedAt:  time.Now(),
    }
    w.AddEvent(event)

    // Check reorder level
    if w.needsReorder(stockLevel) {
        reorderEvent := StockBelowReorderLevelEvent{
            WarehouseID:  w.id,
            ItemID:       itemID,
            CurrentStock: stockLevel.availableQty,
            ReorderLevel: stockLevel.reorderLevel,
        }
        w.AddEvent(reorderEvent)
    }

    return nil
}

// ReserveStock - For sales orders
func (w *Warehouse) ReserveStock(itemID uuid.UUID, quantity Quantity) error {
    stockLevel, exists := w.stockLevels[itemID]
    if !exists {
        return errors.New("item not found in warehouse")
    }

    // Check if enough available stock
    if stockLevel.availableQty.Amount().LessThan(quantity.Amount()) {
        return errors.New("insufficient available stock")
    }

    stockLevel.reservedQty = stockLevel.reservedQty.Add(quantity)
    stockLevel.availableQty = stockLevel.currentQty.Subtract(stockLevel.reservedQty)

    event := StockReservedEvent{
        WarehouseID: w.id,
        ItemID:      itemID,
        Quantity:    quantity,
        ReservedAt:  time.Now(),
    }
    w.AddEvent(event)

    return nil
}

// ReleaseReservation - When order is cancelled
func (w *Warehouse) ReleaseReservation(itemID uuid.UUID, quantity Quantity) error {
    stockLevel, exists := w.stockLevels[itemID]
    if !exists {
        return errors.New("item not found in warehouse")
    }

    stockLevel.reservedQty = stockLevel.reservedQty.Subtract(quantity)
    stockLevel.availableQty = stockLevel.currentQty.Subtract(stockLevel.reservedQty)

    event := StockReservationReleasedEvent{
        WarehouseID: w.id,
        ItemID:      itemID,
        Quantity:    quantity,
        ReleasedAt:  time.Now(),
    }
    w.AddEvent(event)

    return nil
}

// SetReorderLevel - Configure reorder settings
func (w *Warehouse) SetReorderLevel(itemID uuid.UUID, reorderLevel, reorderQty Quantity) error {
    stockLevel, exists := w.stockLevels[itemID]
    if !exists {
        return errors.New("item not found in warehouse")
    }

    stockLevel.reorderLevel = reorderLevel
    stockLevel.reorderQty = reorderQty

    return nil
}

func (w *Warehouse) needsReorder(sl *StockLevel) bool {
    return sl.availableQty.Amount().LessThanOrEqual(sl.reorderLevel.Amount())
}

func (w *Warehouse) ID() uuid.UUID        { return w.id }
func (w *Warehouse) Version() int         { return w.version }
func (w *Warehouse) Events() []DomainEvent { return w.events }
func (w *Warehouse) ClearEvents()         { w.events = []DomainEvent{} }
func (w *Warehouse) AddEvent(event DomainEvent) { w.events = append(w.events, event) }
```

#### 3.2.3 StockTransaction Aggregate

**Aggregate Root:** StockTransaction

```go
// pkg/domain/inventory/stock_transaction.go

package inventory

import (
    "errors"
    "time"
    "github.com/google/uuid"
)

// StockTransaction - Records all stock movements
type StockTransaction struct {
    id              uuid.UUID
    companyID       uuid.UUID
    docNumber       string
    transactionDate time.Time
    transactionType TransactionType

    // Warehouses
    fromWarehouseID *uuid.UUID // For transfers and stock-out
    toWarehouseID   *uuid.UUID // For transfers and stock-in

    // Items (entities within aggregate)
    items []TransactionItem

    // Reference
    referenceType string // "purchase_order", "sales_order", "adjustment"
    referenceID   *uuid.UUID

    notes  string
    status TransactionStatus

    // Audit
    createdAt time.Time
    createdBy uuid.UUID
    postedAt  *time.Time
    postedBy  *uuid.UUID

    version int
    events  []DomainEvent
}

type TransactionType string

const (
    TransactionTypeStockIn     TransactionType = "stock_in"
    TransactionTypeStockOut    TransactionType = "stock_out"
    TransactionTypeTransfer    TransactionType = "transfer"
    TransactionTypeAdjustment  TransactionType = "adjustment"
)

type TransactionStatus string

const (
    TransactionStatusDraft     TransactionStatus = "draft"
    TransactionStatusPosted    TransactionStatus = "posted"
    TransactionStatusCancelled TransactionStatus = "cancelled"
)

// TransactionItem - Entity within StockTransaction aggregate
type TransactionItem struct {
    id         uuid.UUID
    itemID     uuid.UUID
    quantity   Quantity
    unitCost   *Money
    batchNo    *string
    serialNo   *string
    expiryDate *time.Time
}

func NewStockTransaction(
    companyID uuid.UUID,
    docNumber string,
    transactionType TransactionType,
    fromWarehouseID, toWarehouseID *uuid.UUID,
    createdBy uuid.UUID,
) (*StockTransaction, error) {
    // Validation based on transaction type
    if transactionType == TransactionTypeTransfer {
        if fromWarehouseID == nil || toWarehouseID == nil {
            return nil, errors.New("transfer requires both from and to warehouse")
        }
        if *fromWarehouseID == *toWarehouseID {
            return nil, errors.New("cannot transfer to same warehouse")
        }
    }

    st := &StockTransaction{
        id:              uuid.New(),
        companyID:       companyID,
        docNumber:       docNumber,
        transactionDate: time.Now(),
        transactionType: transactionType,
        fromWarehouseID: fromWarehouseID,
        toWarehouseID:   toWarehouseID,
        status:          TransactionStatusDraft,
        items:           []TransactionItem{},
        createdAt:       time.Now(),
        createdBy:       createdBy,
        version:         1,
        events:          []DomainEvent{},
    }

    return st, nil
}

// AddItem - Add item to transaction
func (st *StockTransaction) AddItem(
    itemID uuid.UUID,
    quantity Quantity,
    unitCost *Money,
    batchNo, serialNo *string,
    expiryDate *time.Time,
) error {
    if st.status != TransactionStatusDraft {
        return errors.New("can only add items to draft transactions")
    }

    if quantity.Amount().LessThanOrEqual(decimal.Zero) {
        return errors.New("quantity must be positive")
    }

    item := TransactionItem{
        id:         uuid.New(),
        itemID:     itemID,
        quantity:   quantity,
        unitCost:   unitCost,
        batchNo:    batchNo,
        serialNo:   serialNo,
        expiryDate: expiryDate,
    }

    st.items = append(st.items, item)
    return nil
}

// Post - Finalize and apply stock movements
func (st *StockTransaction) Post(postedBy uuid.UUID) error {
    if st.status != TransactionStatusDraft {
        return errors.New("only draft transactions can be posted")
    }

    if len(st.items) == 0 {
        return errors.New("cannot post transaction without items")
    }

    now := time.Now()
    st.status = TransactionStatusPosted
    st.postedAt = &now
    st.postedBy = &postedBy

    event := StockTransactionPostedEvent{
        TransactionID:   st.id,
        CompanyID:       st.companyID,
        TransactionType: st.transactionType,
        FromWarehouseID: st.fromWarehouseID,
        ToWarehouseID:   st.toWarehouseID,
        Items:           st.items,
        PostedAt:        now,
        PostedBy:        postedBy,
    }
    st.AddEvent(event)

    return nil
}

// Cancel - Cancel transaction
func (st *StockTransaction) Cancel(reason string) error {
    if st.status == TransactionStatusCancelled {
        return errors.New("transaction already cancelled")
    }

    st.status = TransactionStatusCancelled

    event := StockTransactionCancelledEvent{
        TransactionID: st.id,
        Reason:        reason,
        CancelledAt:   time.Now(),
    }
    st.AddEvent(event)

    return nil
}

func (st *StockTransaction) ID() uuid.UUID        { return st.id }
func (st *StockTransaction) Version() int         { return st.version }
func (st *StockTransaction) Events() []DomainEvent { return st.events }
func (st *StockTransaction) ClearEvents()         { st.events = []DomainEvent{} }
func (st *StockTransaction) AddEvent(event DomainEvent) { st.events = append(st.events, event) }
```

#### 3.2.4 BillOfMaterials Aggregate

**Aggregate Root:** BillOfMaterials

```go
// pkg/domain/inventory/bill_of_materials.go

package inventory

import (
    "errors"
    "github.com/google/uuid"
)

// BillOfMaterials - Defines item composition
type BillOfMaterials struct {
    id          uuid.UUID
    companyID   uuid.UUID
    code        string
    name        string

    // The finished product
    finishedItemID uuid.UUID
    outputQty      Quantity

    // Components (entities)
    components []BOMComponent

    isActive   bool
    version    int
    events     []DomainEvent
}

// BOMComponent - Entity within BOM aggregate
type BOMComponent struct {
    id           uuid.UUID
    componentItemID uuid.UUID
    quantity     Quantity
    scrapPercent decimal.Decimal // Expected waste
    sortOrder    int
}

func NewBillOfMaterials(
    companyID uuid.UUID,
    code, name string,
    finishedItemID uuid.UUID,
    outputQty Quantity,
) (*BillOfMaterials, error) {
    if code == "" {
        return nil, errors.New("BOM code is required")
    }

    bom := &BillOfMaterials{
        id:             uuid.New(),
        companyID:      companyID,
        code:           code,
        name:           name,
        finishedItemID: finishedItemID,
        outputQty:      outputQty,
        components:     []BOMComponent{},
        isActive:       true,
        version:        1,
        events:         []DomainEvent{},
    }

    return bom, nil
}

// AddComponent - Add component to BOM
func (bom *BillOfMaterials) AddComponent(
    componentItemID uuid.UUID,
    quantity Quantity,
    scrapPercent decimal.Decimal,
) error {
    if componentItemID == bom.finishedItemID {
        return errors.New("finished item cannot be its own component")
    }

    component := BOMComponent{
        id:              uuid.New(),
        componentItemID: componentItemID,
        quantity:        quantity,
        scrapPercent:    scrapPercent,
        sortOrder:       len(bom.components) + 1,
    }

    bom.components = append(bom.components, component)
    return nil
}

// CalculateRequiredQty - Calculate component quantities for production
func (bom *BillOfMaterials) CalculateRequiredQty(
    productionQty Quantity,
) ([]ComponentRequirement, error) {
    requirements := make([]ComponentRequirement, 0, len(bom.components))

    for _, comp := range bom.components {
        // Calculate base requirement
        ratio := productionQty.Amount().Div(bom.outputQty.Amount())
        required := comp.quantity.Amount().Mul(ratio)

        // Add scrap
        scrapMultiplier := decimal.NewFromInt(1).Add(comp.scrapPercent.Div(decimal.NewFromInt(100)))
        requiredWithScrap := required.Mul(scrapMultiplier)

        requirements = append(requirements, ComponentRequirement{
            ComponentItemID: comp.componentItemID,
            RequiredQty:     NewQuantity(requiredWithScrap, comp.quantity.Unit()),
        })
    }

    return requirements, nil
}

type ComponentRequirement struct {
    ComponentItemID uuid.UUID
    RequiredQty     Quantity
}

func (bom *BillOfMaterials) ID() uuid.UUID        { return bom.id }
func (bom *BillOfMaterials) Version() int         { return bom.version }
func (bom *BillOfMaterials) Events() []DomainEvent { return bom.events }
func (bom *BillOfMaterials) ClearEvents()         { bom.events = []DomainEvent{} }
func (bom *BillOfMaterials) AddEvent(event DomainEvent) { bom.events = append(bom.events, event) }
```

### 3.3 Domain Services

```go
// pkg/domain/inventory/services/stock_valuation_service.go

package services

import (
    "context"
    "github.com/shopspring/decimal"
    "github.com/google/uuid"
)

// ValuationMethod - Costing method enumeration
type ValuationMethod string

const (
    FIFO    ValuationMethod = "FIFO"
    LIFO    ValuationMethod = "LIFO"
    Average ValuationMethod = "Average"
)

// StockValuationService - Domain service for complex valuation logic
type StockValuationService interface {
    CalculateStockValue(
        ctx context.Context,
        itemID uuid.UUID,
        warehouseID uuid.UUID,
        method ValuationMethod,
    ) (Money, error)

    CalculateMovementCost(
        ctx context.Context,
        itemID uuid.UUID,
        quantity Quantity,
        method ValuationMethod,
    ) (Money, error)
}

// This service requires access to stock ledger repository
// Implementation would be in infrastructure layer
```

### 3.4 Repository Interfaces (Ports)

```go
// pkg/domain/inventory/repositories.go

package inventory

import (
    "context"
    "github.com/google/uuid"
)

// ItemRepository - Port for Item aggregate persistence
type ItemRepository interface {
    Save(ctx context.Context, item *Item) error
    FindByID(ctx context.Context, id uuid.UUID) (*Item, error)
    FindByCode(ctx context.Context, companyID uuid.UUID, code string) (*Item, error)
    FindAll(ctx context.Context, companyID uuid.UUID, filter ItemFilter) ([]*Item, error)
    Delete(ctx context.Context, id uuid.UUID) error
}

type ItemFilter struct {
    CategoryID *uuid.UUID
    ItemType   *ItemType
    IsActive   *bool
    SearchTerm *string
    Limit      int
    Offset     int
}

// WarehouseRepository - Port for Warehouse aggregate
type WarehouseRepository interface {
    Save(ctx context.Context, warehouse *Warehouse) error
    FindByID(ctx context.Context, id uuid.UUID) (*Warehouse, error)
    FindByCode(ctx context.Context, companyID uuid.UUID, code string) (*Warehouse, error)
    FindAll(ctx context.Context, companyID uuid.UUID) ([]*Warehouse, error)
}

// StockTransactionRepository - Port for StockTransaction aggregate
type StockTransactionRepository interface {
    Save(ctx context.Context, transaction *StockTransaction) error
    FindByID(ctx context.Context, id uuid.UUID) (*StockTransaction, error)
    FindByDocNumber(ctx context.Context, companyID uuid.UUID, docNumber string) (*StockTransaction, error)
    FindPending(ctx context.Context, warehouseID uuid.UUID) ([]*StockTransaction, error)
}

// BillOfMaterialsRepository - Port for BOM aggregate
type BillOfMaterialsRepository interface {
    Save(ctx context.Context, bom *BillOfMaterials) error
    FindByID(ctx context.Context, id uuid.UUID) (*BillOfMaterials, error)
    FindByFinishedItem(ctx context.Context, finishedItemID uuid.UUID) ([]*BillOfMaterials, error)
}

// StockLedgerRepository - Read-only query repository
type StockLedgerRepository interface {
    GetLedgerEntries(ctx context.Context, itemID, warehouseID uuid.UUID) ([]StockLedgerEntry, error)
    GetCurrentStock(ctx context.Context, itemID, warehouseID uuid.UUID) (Quantity, error)
    GetStockValue(ctx context.Context, itemID, warehouseID uuid.UUID) (Money, error)
}

type StockLedgerEntry struct {
    ItemID        uuid.UUID
    WarehouseID   uuid.UUID
    TransactionID uuid.UUID
    Date          time.Time
    Type          TransactionType
    QuantityIn    Quantity
    QuantityOut   Quantity
    Balance       Quantity
    UnitCost      Money
    Value         Money
}
```

### 3.5 Domain Events

```go
// pkg/domain/inventory/events.go

package inventory

import (
    "time"
    "github.com/google/uuid"
)

// Base event interface
type DomainEvent interface {
    EventName() string
    OccurredAt() time.Time
}

// Item events
type ItemCreatedEvent struct {
    ItemID    uuid.UUID
    CompanyID uuid.UUID
    Code      string
    Name      string
    ItemType  string
    CreatedAt time.Time
    CreatedBy uuid.UUID
}

func (e ItemCreatedEvent) EventName() string   { return "inventory.item.created" }
func (e ItemCreatedEvent) OccurredAt() time.Time { return e.CreatedAt }

type ItemPricingUpdatedEvent struct {
    ItemID       uuid.UUID
    StandardCost *Money
    ListPrice    *Money
    UpdatedAt    time.Time
}

func (e ItemPricingUpdatedEvent) EventName() string   { return "inventory.item.pricing_updated" }
func (e ItemPricingUpdatedEvent) OccurredAt() time.Time { return e.UpdatedAt }

type ItemDeactivatedEvent struct {
    ItemID    uuid.UUID
    Reason    string
    UpdatedAt time.Time
}

func (e ItemDeactivatedEvent) EventName() string   { return "inventory.item.deactivated" }
func (e ItemDeactivatedEvent) OccurredAt() time.Time { return e.UpdatedAt }

// Warehouse events
type WarehouseCreatedEvent struct {
    WarehouseID uuid.UUID
    CompanyID   uuid.UUID
    Code        string
    Name        string
}

func (e WarehouseCreatedEvent) EventName() string { return "inventory.warehouse.created" }
func (e WarehouseCreatedEvent) OccurredAt() time.Time { return time.Now() }

type StockAdjustedEvent struct {
    WarehouseID uuid.UUID
    ItemID      uuid.UUID
    OldQuantity Quantity
    NewQuantity Quantity
    Reason      string
    AdjustedAt  time.Time
}

func (e StockAdjustedEvent) EventName() string   { return "inventory.stock.adjusted" }
func (e StockAdjustedEvent) OccurredAt() time.Time { return e.AdjustedAt }

type StockReservedEvent struct {
    WarehouseID uuid.UUID
    ItemID      uuid.UUID
    Quantity    Quantity
    ReservedAt  time.Time
}

func (e StockReservedEvent) EventName() string   { return "inventory.stock.reserved" }
func (e StockReservedEvent) OccurredAt() time.Time { return e.ReservedAt }

type StockReservationReleasedEvent struct {
    WarehouseID uuid.UUID
    ItemID      uuid.UUID
    Quantity    Quantity
    ReleasedAt  time.Time
}

func (e StockReservationReleasedEvent) EventName() string { return "inventory.stock.reservation_released" }
func (e StockReservationReleasedEvent) OccurredAt() time.Time { return e.ReleasedAt }

type StockBelowReorderLevelEvent struct {
    WarehouseID  uuid.UUID
    ItemID       uuid.UUID
    CurrentStock Quantity
    ReorderLevel Quantity
}

func (e StockBelowReorderLevelEvent) EventName() string { return "inventory.stock.below_reorder_level" }
func (e StockBelowReorderLevelEvent) OccurredAt() time.Time { return time.Now() }

// Transaction events
type StockTransactionPostedEvent struct {
    TransactionID   uuid.UUID
    CompanyID       uuid.UUID
    TransactionType TransactionType
    FromWarehouseID *uuid.UUID
    ToWarehouseID   *uuid.UUID
    Items           []TransactionItem
    PostedAt        time.Time
    PostedBy        uuid.UUID
}

func (e StockTransactionPostedEvent) EventName() string { return "inventory.transaction.posted" }
func (e StockTransactionPostedEvent) OccurredAt() time.Time { return e.PostedAt }

type StockTransactionCancelledEvent struct {
    TransactionID uuid.UUID
    Reason        string
    CancelledAt   time.Time
}

func (e StockTransactionCancelledEvent) EventName() string { return "inventory.transaction.cancelled" }
func (e StockTransactionCancelledEvent) OccurredAt() time.Time { return e.CancelledAt }
```

---

## 4. SALES CONTEXT

### 4.1 Bounded Context Responsibility

Manages all sales-related operations:
- Customer master data and relationships
- Price lists and discount rules
- Sales quotations (pre-sales)
- Sales orders and fulfillment tracking
- Delivery notes and stock deduction
- Sales invoices and billing
- Payment collection and tracking
- Sales returns and credit notes

### 4.2 Domain Model

#### 4.2.1 Customer Aggregate

**Aggregate Root:** Customer

```go
// pkg/domain/sales/customer.go

package sales

import (
    "errors"
    "github.com/google/uuid"
    "time"
)

// Customer - Aggregate root for customer management
type Customer struct {
    // Identity
    id        uuid.UUID
    companyID uuid.UUID
    code      string
    version   int

    // Basic info
    name           string
    customerType   CustomerType
    taxID          *string

    // Contact
    contactPerson  *string
    contactInfo    ContactInfo // Value object
    billingAddress Address     // Value object
    shippingAddress *Address

    // Commercial terms
    paymentTerms PaymentTerms // Value object
    creditLimit  Money        // Value object
    priceListID  *uuid.UUID

    // Status
    isActive  bool
    createdAt time.Time
    updatedAt time.Time

    // Events
    events []DomainEvent
}

type CustomerType string

const (
    CustomerTypeIndividual CustomerType = "individual"
    CustomerTypeBusiness   CustomerType = "business"
    CustomerTypeGovernment CustomerType = "government"
)

// PaymentTerms - Value object
type PaymentTerms struct {
    code       string // "cash", "net_15", "net_30", "net_60"
    creditDays int
}

func NewPaymentTerms(code string, creditDays int) PaymentTerms {
    return PaymentTerms{
        code:       code,
        creditDays: creditDays,
    }
}

func NewCustomer(
    companyID uuid.UUID,
    code, name string,
    customerType CustomerType,
) (*Customer, error) {
    if code == "" {
        return nil, errors.New("customer code is required")
    }
    if name == "" {
        return nil, errors.New("customer name is required")
    }

    customer := &Customer{
        id:           uuid.New(),
        companyID:    companyID,
        code:         code,
        name:         name,
        customerType: customerType,
        creditLimit:  NewMoney(decimal.Zero, "USD"),
        isActive:     true,
        createdAt:    time.Now(),
        updatedAt:    time.Now(),
        version:      1,
        events:       []DomainEvent{},
    }

    event := CustomerCreatedEvent{
        CustomerID:   customer.id,
        CompanyID:    companyID,
        Code:         code,
        Name:         name,
        CustomerType: string(customerType),
        CreatedAt:    customer.createdAt,
    }
    customer.AddEvent(event)

    return customer, nil
}

// UpdateCreditLimit - Business method
func (c *Customer) UpdateCreditLimit(newLimit Money) error {
    if newLimit.Amount().LessThan(decimal.Zero) {
        return errors.New("credit limit cannot be negative")
    }

    oldLimit := c.creditLimit
    c.creditLimit = newLimit
    c.updatedAt = time.Now()

    event := CustomerCreditLimitUpdatedEvent{
        CustomerID: c.id,
        OldLimit:   oldLimit,
        NewLimit:   newLimit,
        UpdatedAt:  c.updatedAt,
    }
    c.AddEvent(event)

    return nil
}

// SetPaymentTerms - Business method
func (c *Customer) SetPaymentTerms(terms PaymentTerms) {
    c.paymentTerms = terms
    c.updatedAt = time.Now()
}

func (c *Customer) Deactivate() {
    c.isActive = false
    c.updatedAt = time.Now()
}

func (c *Customer) ID() uuid.UUID        { return c.id }
func (c *Customer) Version() int         { return c.version }
func (c *Customer) Events() []DomainEvent { return c.events }
func (c *Customer) ClearEvents()         { c.events = []DomainEvent{} }
func (c *Customer) AddEvent(event DomainEvent) { c.events = append(c.events, event) }
```

#### 4.2.2 SalesQuotation Aggregate

**Aggregate Root:** SalesQuotation

```go
// pkg/domain/sales/sales_quotation.go

package sales

import (
    "errors"
    "github.com/google/uuid"
    "time"
)

// SalesQuotation - Pre-sales offer
type SalesQuotation struct {
    id           uuid.UUID
    companyID    uuid.UUID
    quotationNo  string
    quotationDate time.Time
    customerID   uuid.UUID

    // Items (entities)
    items []QuotationItem

    // Pricing
    subtotal       Money
    discountAmount Money
    taxAmount      Money
    totalAmount    Money

    // Validity
    validUntil *time.Time

    // Status
    status    QuotationStatus
    createdAt time.Time
    createdBy uuid.UUID

    version int
    events  []DomainEvent
}

type QuotationStatus string

const (
    QuotationStatusDraft    QuotationStatus = "draft"
    QuotationStatusSent     QuotationStatus = "sent"
    QuotationStatusAccepted QuotationStatus = "accepted"
    QuotationStatusRejected QuotationStatus = "rejected"
    QuotationStatusExpired  QuotationStatus = "expired"
)

type QuotationItem struct {
    id              uuid.UUID
    itemID          uuid.UUID
    description     string
    quantity        Quantity
    unitPrice       Money
    discountPercent decimal.Decimal
    taxPercent      decimal.Decimal
    lineTotal       Money
}

func NewSalesQuotation(
    companyID uuid.UUID,
    quotationNo string,
    customerID uuid.UUID,
    validUntil *time.Time,
    createdBy uuid.UUID,
) (*SalesQuotation, error) {
    sq := &SalesQuotation{
        id:            uuid.New(),
        companyID:     companyID,
        quotationNo:   quotationNo,
        quotationDate: time.Now(),
        customerID:    customerID,
        validUntil:    validUntil,
        status:        QuotationStatusDraft,
        items:         []QuotationItem{},
        createdAt:     time.Now(),
        createdBy:     createdBy,
        version:       1,
        events:        []DomainEvent{},
    }

    return sq, nil
}

// AddItem - Add item to quotation
func (sq *SalesQuotation) AddItem(
    itemID uuid.UUID,
    description string,
    quantity Quantity,
    unitPrice Money,
    discountPercent, taxPercent decimal.Decimal,
) error {
    if sq.status != QuotationStatusDraft {
        return errors.New("can only add items to draft quotations")
    }

    lineTotal := sq.calculateLineTotal(quantity, unitPrice, discountPercent, taxPercent)

    item := QuotationItem{
        id:              uuid.New(),
        itemID:          itemID,
        description:     description,
        quantity:        quantity,
        unitPrice:       unitPrice,
        discountPercent: discountPercent,
        taxPercent:      taxPercent,
        lineTotal:       lineTotal,
    }

    sq.items = append(sq.items, item)
    sq.recalculateTotals()

    return nil
}

// MarkAsSent - Send quotation to customer
func (sq *SalesQuotation) MarkAsSent() error {
    if sq.status != QuotationStatusDraft {
        return errors.New("only draft quotations can be sent")
    }

    if len(sq.items) == 0 {
        return errors.New("cannot send quotation without items")
    }

    sq.status = QuotationStatusSent

    event := QuotationSentEvent{
        QuotationID: sq.id,
        CustomerID:  sq.customerID,
        TotalAmount: sq.totalAmount,
        SentAt:      time.Now(),
    }
    sq.AddEvent(event)

    return nil
}

// Accept - Customer accepts quotation
func (sq *SalesQuotation) Accept() error {
    if sq.status != QuotationStatusSent {
        return errors.New("only sent quotations can be accepted")
    }

    sq.status = QuotationStatusAccepted

    event := QuotationAcceptedEvent{
        QuotationID: sq.id,
        CustomerID:  sq.customerID,
        AcceptedAt:  time.Now(),
    }
    sq.AddEvent(event)

    return nil
}

// Reject - Customer rejects quotation
func (sq *SalesQuotation) Reject(reason string) error {
    if sq.status != QuotationStatusSent {
        return errors.New("only sent quotations can be rejected")
    }

    sq.status = QuotationStatusRejected

    event := QuotationRejectedEvent{
        QuotationID: sq.id,
        CustomerID:  sq.customerID,
        Reason:      reason,
        RejectedAt:  time.Now(),
    }
    sq.AddEvent(event)

    return nil
}

func (sq *SalesQuotation) calculateLineTotal(
    qty Quantity,
    unitPrice Money,
    discountPct, taxPct decimal.Decimal,
) Money {
    // subtotal = qty * unitPrice
    subtotal := unitPrice.Amount().Mul(qty.Amount())

    // discount = subtotal * (discountPct / 100)
    discount := subtotal.Mul(discountPct.Div(decimal.NewFromInt(100)))
    afterDiscount := subtotal.Sub(discount)

    // tax = afterDiscount * (taxPct / 100)
    tax := afterDiscount.Mul(taxPct.Div(decimal.NewFromInt(100)))
    total := afterDiscount.Add(tax)

    return NewMoney(total, unitPrice.Currency())
}

func (sq *SalesQuotation) recalculateTotals() {
    subtotal := decimal.Zero
    discount := decimal.Zero
    tax := decimal.Zero

    for _, item := range sq.items {
        itemSubtotal := item.unitPrice.Amount().Mul(item.quantity.Amount())
        itemDiscount := itemSubtotal.Mul(item.discountPercent.Div(decimal.NewFromInt(100)))
        afterDiscount := itemSubtotal.Sub(itemDiscount)
        itemTax := afterDiscount.Mul(item.taxPercent.Div(decimal.NewFromInt(100)))

        subtotal = subtotal.Add(itemSubtotal)
        discount = discount.Add(itemDiscount)
        tax = tax.Add(itemTax)
    }

    total := subtotal.Sub(discount).Add(tax)

    // Assume USD for simplicity (in real system, get from company settings)
    sq.subtotal = NewMoney(subtotal, "USD")
    sq.discountAmount = NewMoney(discount, "USD")
    sq.taxAmount = NewMoney(tax, "USD")
    sq.totalAmount = NewMoney(total, "USD")
}

func (sq *SalesQuotation) ID() uuid.UUID        { return sq.id }
func (sq *SalesQuotation) Version() int         { return sq.version }
func (sq *SalesQuotation) Events() []DomainEvent { return sq.events }
func (sq *SalesQuotation) ClearEvents()         { sq.events = []DomainEvent{} }
func (sq *SalesQuotation) AddEvent(event DomainEvent) { sq.events = append(sq.events, event) }
```

#### 4.2.3 SalesOrder Aggregate

**Aggregate Root:** SalesOrder

```go
// pkg/domain/sales/sales_order.go

package sales

import (
    "errors"
    "github.com/google/uuid"
    "github.com/shopspring/decimal"
    "time"
)

// SalesOrder - Confirmed customer order
type SalesOrder struct {
    id          uuid.UUID
    companyID   uuid.UUID
    orderNo     string
    orderDate   time.Time
    customerID  uuid.UUID
    warehouseID uuid.UUID

    // Reference to quotation if converted
    quotationID *uuid.UUID

    // Items (entities)
    items []OrderItem

    // Pricing
    subtotal       Money
    discountAmount Money
    taxAmount      Money
    totalAmount    Money

    // Delivery
    deliveryDate     *time.Time
    shippingAddress  *Address

    // Status tracking
    status           OrderStatus
    deliveryStatus   DeliveryStatus
    invoiceStatus    InvoiceStatus

    // Audit
    createdAt time.Time
    createdBy uuid.UUID

    version int
    events  []DomainEvent
}

type OrderStatus string

const (
    OrderStatusDraft     OrderStatus = "draft"
    OrderStatusConfirmed OrderStatus = "confirmed"
    OrderStatusCancelled OrderStatus = "cancelled"
    OrderStatusClosed    OrderStatus = "closed"
)

type DeliveryStatus string

const (
    DeliveryStatusPending          DeliveryStatus = "pending"
    DeliveryStatusPartiallyShipped DeliveryStatus = "partially_shipped"
    DeliveryStatusFullyShipped     DeliveryStatus = "fully_shipped"
)

type InvoiceStatus string

const (
    InvoiceStatusNotInvoiced       InvoiceStatus = "not_invoiced"
    InvoiceStatusPartiallyInvoiced InvoiceStatus = "partially_invoiced"
    InvoiceStatusFullyInvoiced     InvoiceStatus = "fully_invoiced"
)

type OrderItem struct {
    id              uuid.UUID
    itemID          uuid.UUID
    description     string
    quantity        Quantity
    deliveredQty    Quantity
    invoicedQty     Quantity
    unitPrice       Money
    discountPercent decimal.Decimal
    taxPercent      decimal.Decimal
    lineTotal       Money
}

func NewSalesOrder(
    companyID uuid.UUID,
    orderNo string,
    customerID uuid.UUID,
    warehouseID uuid.UUID,
    quotationID *uuid.UUID,
    createdBy uuid.UUID,
) (*SalesOrder, error) {
    so := &SalesOrder{
        id:             uuid.New(),
        companyID:      companyID,
        orderNo:        orderNo,
        orderDate:      time.Now(),
        customerID:     customerID,
        warehouseID:    warehouseID,
        quotationID:    quotationID,
        status:         OrderStatusDraft,
        deliveryStatus: DeliveryStatusPending,
        invoiceStatus:  InvoiceStatusNotInvoiced,
        items:          []OrderItem{},
        createdAt:      time.Now(),
        createdBy:      createdBy,
        version:        1,
        events:         []DomainEvent{},
    }

    return so, nil
}

// AddItem - Add item to order
func (so *SalesOrder) AddItem(
    itemID uuid.UUID,
    description string,
    quantity Quantity,
    unitPrice Money,
    discountPercent, taxPercent decimal.Decimal,
) error {
    if so.status != OrderStatusDraft {
        return errors.New("can only add items to draft orders")
    }

    lineTotal := so.calculateLineTotal(quantity, unitPrice, discountPercent, taxPercent)

    item := OrderItem{
        id:              uuid.New(),
        itemID:          itemID,
        description:     description,
        quantity:        quantity,
        deliveredQty:    NewQuantity(decimal.Zero, quantity.Unit()),
        invoicedQty:     NewQuantity(decimal.Zero, quantity.Unit()),
        unitPrice:       unitPrice,
        discountPercent: discountPercent,
        taxPercent:      taxPercent,
        lineTotal:       lineTotal,
    }

    so.items = append(so.items, item)
    so.recalculateTotals()

    return nil
}

// Confirm - Confirm order and trigger stock reservation
func (so *SalesOrder) Confirm() error {
    if so.status != OrderStatusDraft {
        return errors.New("only draft orders can be confirmed")
    }

    if len(so.items) == 0 {
        return errors.New("cannot confirm order without items")
    }

    so.status = OrderStatusConfirmed

    event := SalesOrderConfirmedEvent{
        OrderID:     so.id,
        CompanyID:   so.companyID,
        CustomerID:  so.customerID,
        WarehouseID: so.warehouseID,
        Items:       so.getItemReservations(),
        TotalAmount: so.totalAmount,
        ConfirmedAt: time.Now(),
    }
    so.AddEvent(event)

    return nil
}

// RecordDelivery - Record items delivered
func (so *SalesOrder) RecordDelivery(deliveries map[uuid.UUID]Quantity) error {
    if so.status != OrderStatusConfirmed {
        return errors.New("only confirmed orders can have deliveries")
    }

    for itemID, deliveredQty := range deliveries {
        found := false
        for i := range so.items {
            if so.items[i].id == itemID {
                found = true

                // Validate quantity
                newDeliveredQty := so.items[i].deliveredQty.Add(deliveredQty)
                if newDeliveredQty.Amount().GreaterThan(so.items[i].quantity.Amount()) {
                    return errors.New("delivered quantity exceeds ordered quantity")
                }

                so.items[i].deliveredQty = newDeliveredQty
                break
            }
        }
        if !found {
            return errors.New("item not found in order")
        }
    }

    so.updateDeliveryStatus()

    event := OrderItemsDeliveredEvent{
        OrderID:     so.id,
        Deliveries:  deliveries,
        DeliveredAt: time.Now(),
    }
    so.AddEvent(event)

    return nil
}

// RecordInvoice - Record items invoiced
func (so *SalesOrder) RecordInvoice(invoicedItems map[uuid.UUID]Quantity) error {
    if so.status != OrderStatusConfirmed {
        return errors.New("only confirmed orders can be invoiced")
    }

    for itemID, invoicedQty := range invoicedItems {
        for i := range so.items {
            if so.items[i].id == itemID {
                newInvoicedQty := so.items[i].invoicedQty.Add(invoicedQty)

                // Invoiced quantity should not exceed delivered quantity
                if newInvoicedQty.Amount().GreaterThan(so.items[i].deliveredQty.Amount()) {
                    return errors.New("invoiced quantity exceeds delivered quantity")
                }

                so.items[i].invoicedQty = newInvoicedQty
                break
            }
        }
    }

    so.updateInvoiceStatus()
    return nil
}

// Cancel - Cancel order
func (so *SalesOrder) Cancel(reason string) error {
    if so.status == OrderStatusCancelled {
        return errors.New("order already cancelled")
    }
    if so.status == OrderStatusClosed {
        return errors.New("cannot cancel closed order")
    }

    so.status = OrderStatusCancelled

    event := SalesOrderCancelledEvent{
        OrderID:     so.id,
        Reason:      reason,
        CancelledAt: time.Now(),
    }
    so.AddEvent(event)

    return nil
}

func (so *SalesOrder) updateDeliveryStatus() {
    allDelivered := true
    anyDelivered := false

    for _, item := range so.items {
        if item.deliveredQty.Amount().LessThan(item.quantity.Amount()) {
            allDelivered = false
        }
        if item.deliveredQty.Amount().GreaterThan(decimal.Zero) {
            anyDelivered = true
        }
    }

    if allDelivered {
        so.deliveryStatus = DeliveryStatusFullyShipped
    } else if anyDelivered {
        so.deliveryStatus = DeliveryStatusPartiallyShipped
    }
}

func (so *SalesOrder) updateInvoiceStatus() {
    allInvoiced := true
    anyInvoiced := false

    for _, item := range so.items {
        if item.invoicedQty.Amount().LessThan(item.quantity.Amount()) {
            allInvoiced = false
        }
        if item.invoicedQty.Amount().GreaterThan(decimal.Zero) {
            anyInvoiced = true
        }
    }

    if allInvoiced {
        so.invoiceStatus = InvoiceStatusFullyInvoiced
    } else if anyInvoiced {
        so.invoiceStatus = InvoiceStatusPartiallyInvoiced
    }
}

func (so *SalesOrder) getItemReservations() []ItemReservation {
    reservations := make([]ItemReservation, len(so.items))
    for i, item := range so.items {
        reservations[i] = ItemReservation{
            ItemID:   item.itemID,
            Quantity: item.quantity,
        }
    }
    return reservations
}

type ItemReservation struct {
    ItemID   uuid.UUID
    Quantity Quantity
}

func (so *SalesOrder) calculateLineTotal(
    qty Quantity,
    unitPrice Money,
    discountPct, taxPct decimal.Decimal,
) Money {
    subtotal := unitPrice.Amount().Mul(qty.Amount())
    discount := subtotal.Mul(discountPct.Div(decimal.NewFromInt(100)))
    afterDiscount := subtotal.Sub(discount)
    tax := afterDiscount.Mul(taxPct.Div(decimal.NewFromInt(100)))
    total := afterDiscount.Add(tax)

    return NewMoney(total, unitPrice.Currency())
}

func (so *SalesOrder) recalculateTotals() {
    subtotal := decimal.Zero
    discount := decimal.Zero
    tax := decimal.Zero

    for _, item := range so.items {
        itemSubtotal := item.unitPrice.Amount().Mul(item.quantity.Amount())
        itemDiscount := itemSubtotal.Mul(item.discountPercent.Div(decimal.NewFromInt(100)))
        afterDiscount := itemSubtotal.Sub(itemDiscount)
        itemTax := afterDiscount.Mul(item.taxPercent.Div(decimal.NewFromInt(100)))

        subtotal = subtotal.Add(itemSubtotal)
        discount = discount.Add(itemDiscount)
        tax = tax.Add(itemTax)
    }

    total := subtotal.Sub(discount).Add(tax)

    so.subtotal = NewMoney(subtotal, "USD")
    so.discountAmount = NewMoney(discount, "USD")
    so.taxAmount = NewMoney(tax, "USD")
    so.totalAmount = NewMoney(total, "USD")
}

func (so *SalesOrder) ID() uuid.UUID        { return so.id }
func (so *SalesOrder) Version() int         { return so.version }
func (so *SalesOrder) Events() []DomainEvent { return so.events }
func (so *SalesOrder) ClearEvents()         { so.events = []DomainEvent{} }
func (so *SalesOrder) AddEvent(event DomainEvent) { so.events = append(so.events, event) }
```

#### 4.2.4 Invoice Aggregate

**Aggregate Root:** Invoice

```go
// pkg/domain/sales/invoice.go

package sales

import (
    "errors"
    "github.com/google/uuid"
    "github.com/shopspring/decimal"
    "time"
)

// Invoice - Billing document
type Invoice struct {
    id          uuid.UUID
    companyID   uuid.UUID
    invoiceNo   string
    invoiceDate time.Time
    dueDate     time.Time
    customerID  uuid.UUID

    // Reference
    orderID *uuid.UUID

    // Items
    items []InvoiceItem

    // Pricing
    subtotal       Money
    discountAmount Money
    taxAmount      Money
    totalAmount    Money

    // Payment tracking
    paidAmount     Money
    paymentStatus  PaymentStatus

    // Audit
    createdAt time.Time
    createdBy uuid.UUID

    version int
    events  []DomainEvent
}

type PaymentStatus string

const (
    PaymentStatusUnpaid         PaymentStatus = "unpaid"
    PaymentStatusPartiallyPaid  PaymentStatus = "partially_paid"
    PaymentStatusPaid           PaymentStatus = "paid"
    PaymentStatusOverdue        PaymentStatus = "overdue"
)

type InvoiceItem struct {
    id              uuid.UUID
    itemID          uuid.UUID
    description     string
    quantity        Quantity
    unitPrice       Money
    discountPercent decimal.Decimal
    taxPercent      decimal.Decimal
    lineTotal       Money
}

func NewInvoice(
    companyID uuid.UUID,
    invoiceNo string,
    customerID uuid.UUID,
    invoiceDate, dueDate time.Time,
    orderID *uuid.UUID,
    createdBy uuid.UUID,
) (*Invoice, error) {
    if dueDate.Before(invoiceDate) {
        return nil, errors.New("due date cannot be before invoice date")
    }

    inv := &Invoice{
        id:            uuid.New(),
        companyID:     companyID,
        invoiceNo:     invoiceNo,
        invoiceDate:   invoiceDate,
        dueDate:       dueDate,
        customerID:    customerID,
        orderID:       orderID,
        items:         []InvoiceItem{},
        paidAmount:    NewMoney(decimal.Zero, "USD"),
        paymentStatus: PaymentStatusUnpaid,
        createdAt:     time.Now(),
        createdBy:     createdBy,
        version:       1,
        events:        []DomainEvent{},
    }

    return inv, nil
}

// AddItem - Add line item
func (inv *Invoice) AddItem(
    itemID uuid.UUID,
    description string,
    quantity Quantity,
    unitPrice Money,
    discountPercent, taxPercent decimal.Decimal,
) error {
    lineTotal := inv.calculateLineTotal(quantity, unitPrice, discountPercent, taxPercent)

    item := InvoiceItem{
        id:              uuid.New(),
        itemID:          itemID,
        description:     description,
        quantity:        quantity,
        unitPrice:       unitPrice,
        discountPercent: discountPercent,
        taxPercent:      taxPercent,
        lineTotal:       lineTotal,
    }

    inv.items = append(inv.items, item)
    inv.recalculateTotals()

    return nil
}

// RecordPayment - Apply payment to invoice
func (inv *Invoice) RecordPayment(amount Money, paymentDate time.Time) error {
    if inv.paymentStatus == PaymentStatusPaid {
        return errors.New("invoice is already fully paid")
    }

    if amount.Amount().LessThanOrEqual(decimal.Zero) {
        return errors.New("payment amount must be positive")
    }

    newPaidAmount := NewMoney(
        inv.paidAmount.Amount().Add(amount.Amount()),
        inv.paidAmount.Currency(),
    )

    // Cannot overpay
    if newPaidAmount.Amount().GreaterThan(inv.totalAmount.Amount()) {
        return errors.New("payment exceeds invoice total")
    }

    inv.paidAmount = newPaidAmount
    inv.updatePaymentStatus()

    event := InvoicePaymentRecordedEvent{
        InvoiceID:     inv.id,
        PaymentAmount: amount,
        TotalPaid:     inv.paidAmount,
        PaymentDate:   paymentDate,
    }
    inv.AddEvent(event)

    return nil
}

func (inv *Invoice) updatePaymentStatus() {
    outstanding := inv.totalAmount.Amount().Sub(inv.paidAmount.Amount())

    if outstanding.Equal(decimal.Zero) {
        inv.paymentStatus = PaymentStatusPaid
    } else if inv.paidAmount.Amount().GreaterThan(decimal.Zero) {
        inv.paymentStatus = PaymentStatusPartiallyPaid

        // Check if overdue
        if time.Now().After(inv.dueDate) {
            inv.paymentStatus = PaymentStatusOverdue
        }
    } else {
        // No payment yet
        if time.Now().After(inv.dueDate) {
            inv.paymentStatus = PaymentStatusOverdue
        } else {
            inv.paymentStatus = PaymentStatusUnpaid
        }
    }
}

func (inv *Invoice) calculateLineTotal(
    qty Quantity,
    unitPrice Money,
    discountPct, taxPct decimal.Decimal,
) Money {
    subtotal := unitPrice.Amount().Mul(qty.Amount())
    discount := subtotal.Mul(discountPct.Div(decimal.NewFromInt(100)))
    afterDiscount := subtotal.Sub(discount)
    tax := afterDiscount.Mul(taxPct.Div(decimal.NewFromInt(100)))
    total := afterDiscount.Add(tax)

    return NewMoney(total, unitPrice.Currency())
}

func (inv *Invoice) recalculateTotals() {
    subtotal := decimal.Zero
    discount := decimal.Zero
    tax := decimal.Zero

    for _, item := range inv.items {
        itemSubtotal := item.unitPrice.Amount().Mul(item.quantity.Amount())
        itemDiscount := itemSubtotal.Mul(item.discountPercent.Div(decimal.NewFromInt(100)))
        afterDiscount := itemSubtotal.Sub(itemDiscount)
        itemTax := afterDiscount.Mul(item.taxPercent.Div(decimal.NewFromInt(100)))

        subtotal = subtotal.Add(itemSubtotal)
        discount = discount.Add(itemDiscount)
        tax = tax.Add(itemTax)
    }

    total := subtotal.Sub(discount).Add(tax)

    inv.subtotal = NewMoney(subtotal, "USD")
    inv.discountAmount = NewMoney(discount, "USD")
    inv.taxAmount = NewMoney(tax, "USD")
    inv.totalAmount = NewMoney(total, "USD")
}

func (inv *Invoice) ID() uuid.UUID        { return inv.id }
func (inv *Invoice) Version() int         { return inv.version }
func (inv *Invoice) Events() []DomainEvent { return inv.events }
func (inv *Invoice) ClearEvents()         { inv.events = []DomainEvent{} }
func (inv *Invoice) AddEvent(event DomainEvent) { inv.events = append(inv.events, event) }
```

### 4.3 Repository Interfaces (Ports)

```go
// pkg/domain/sales/repositories.go

package sales

import (
    "context"
    "github.com/google/uuid"
)

// CustomerRepository - Port for Customer persistence
type CustomerRepository interface {
    Save(ctx context.Context, customer *Customer) error
    FindByID(ctx context.Context, id uuid.UUID) (*Customer, error)
    FindByCode(ctx context.Context, companyID uuid.UUID, code string) (*Customer, error)
    FindAll(ctx context.Context, companyID uuid.UUID, filter CustomerFilter) ([]*Customer, error)
}

type CustomerFilter struct {
    CustomerType *CustomerType
    IsActive     *bool
    SearchTerm   *string
    Limit        int
    Offset       int
}

// SalesQuotationRepository
type SalesQuotationRepository interface {
    Save(ctx context.Context, quotation *SalesQuotation) error
    FindByID(ctx context.Context, id uuid.UUID) (*SalesQuotation, error)
    FindByCustomer(ctx context.Context, customerID uuid.UUID) ([]*SalesQuotation, error)
}

// SalesOrderRepository
type SalesOrderRepository interface {
    Save(ctx context.Context, order *SalesOrder) error
    FindByID(ctx context.Context, id uuid.UUID) (*SalesOrder, error)
    FindByCustomer(ctx context.Context, customerID uuid.UUID) ([]*SalesOrder, error)
    FindPending(ctx context.Context, companyID uuid.UUID) ([]*SalesOrder, error)
}

// InvoiceRepository
type InvoiceRepository interface {
    Save(ctx context.Context, invoice *Invoice) error
    FindByID(ctx context.Context, id uuid.UUID) (*Invoice, error)
    FindByCustomer(ctx context.Context, customerID uuid.UUID) ([]*Invoice, error)
    FindUnpaid(ctx context.Context, companyID uuid.UUID) ([]*Invoice, error)
    FindOverdue(ctx context.Context, companyID uuid.UUID) ([]*Invoice, error)
}
```

### 4.4 Domain Events

```go
// pkg/domain/sales/events.go

package sales

import (
    "time"
    "github.com/google/uuid"
)

// Customer events
type CustomerCreatedEvent struct {
    CustomerID   uuid.UUID
    CompanyID    uuid.UUID
    Code         string
    Name         string
    CustomerType string
    CreatedAt    time.Time
}

func (e CustomerCreatedEvent) EventName() string { return "sales.customer.created" }
func (e CustomerCreatedEvent) OccurredAt() time.Time { return e.CreatedAt }

type CustomerCreditLimitUpdatedEvent struct {
    CustomerID uuid.UUID
    OldLimit   Money
    NewLimit   Money
    UpdatedAt  time.Time
}

func (e CustomerCreditLimitUpdatedEvent) EventName() string { return "sales.customer.credit_limit_updated" }
func (e CustomerCreditLimitUpdatedEvent) OccurredAt() time.Time { return e.UpdatedAt }

// Quotation events
type QuotationSentEvent struct {
    QuotationID uuid.UUID
    CustomerID  uuid.UUID
    TotalAmount Money
    SentAt      time.Time
}

func (e QuotationSentEvent) EventName() string { return "sales.quotation.sent" }
func (e QuotationSentEvent) OccurredAt() time.Time { return e.SentAt }

type QuotationAcceptedEvent struct {
    QuotationID uuid.UUID
    CustomerID  uuid.UUID
    AcceptedAt  time.Time
}

func (e QuotationAcceptedEvent) EventName() string { return "sales.quotation.accepted" }
func (e QuotationAcceptedEvent) OccurredAt() time.Time { return e.AcceptedAt }

// Order events
type SalesOrderConfirmedEvent struct {
    OrderID      uuid.UUID
    CompanyID    uuid.UUID
    CustomerID   uuid.UUID
    WarehouseID  uuid.UUID
    Items        []ItemReservation
    TotalAmount  Money
    ConfirmedAt  time.Time
}

func (e SalesOrderConfirmedEvent) EventName() string { return "sales.order.confirmed" }
func (e SalesOrderConfirmedEvent) OccurredAt() time.Time { return e.ConfirmedAt }

type OrderItemsDeliveredEvent struct {
    OrderID     uuid.UUID
    Deliveries  map[uuid.UUID]Quantity
    DeliveredAt time.Time
}

func (e OrderItemsDeliveredEvent) EventName() string { return "sales.order.items_delivered" }
func (e OrderItemsDeliveredEvent) OccurredAt() time.Time { return e.DeliveredAt }

type SalesOrderCancelledEvent struct {
    OrderID     uuid.UUID
    Reason      string
    CancelledAt time.Time
}

func (e SalesOrderCancelledEvent) EventName() string { return "sales.order.cancelled" }
func (e SalesOrderCancelledEvent) OccurredAt() time.Time { return e.CancelledAt }

// Invoice events
type InvoicePaymentRecordedEvent struct {
    InvoiceID     uuid.UUID
    PaymentAmount Money
    TotalPaid     Money
    PaymentDate   time.Time
}

func (e InvoicePaymentRecordedEvent) EventName() string { return "sales.invoice.payment_recorded" }
func (e InvoicePaymentRecordedEvent) OccurredAt() time.Time { return e.PaymentDate }
```

---

## 5. SHARED KERNEL

### 5.1 Common Value Objects

```go
// pkg/domain/shared/value_objects.go

package shared

import (
    "errors"
    "regexp"
    "github.com/shopspring/decimal"
)

// Money - Value object for monetary amounts
type Money struct {
    amount   decimal.Decimal
    currency string
}

func NewMoney(amount decimal.Decimal, currency string) Money {
    return Money{
        amount:   amount.Round(2), // Round to 2 decimal places
        currency: currency,
    }
}

func (m Money) Amount() decimal.Decimal { return m.amount }
func (m Money) Currency() string        { return m.currency }

func (m Money) Add(other Money) (Money, error) {
    if m.currency != other.currency {
        return Money{}, errors.New("cannot add money with different currencies")
    }
    return NewMoney(m.amount.Add(other.amount), m.currency), nil
}

func (m Money) Subtract(other Money) (Money, error) {
    if m.currency != other.currency {
        return Money{}, errors.New("cannot subtract money with different currencies")
    }
    return NewMoney(m.amount.Sub(other.amount), m.currency), nil
}

func (m Money) Multiply(multiplier decimal.Decimal) Money {
    return NewMoney(m.amount.Mul(multiplier), m.currency)
}

func (m Money) IsZero() bool {
    return m.amount.Equal(decimal.Zero)
}

func (m Money) IsPositive() bool {
    return m.amount.GreaterThan(decimal.Zero)
}

func (m Money) IsNegative() bool {
    return m.amount.LessThan(decimal.Zero)
}

// Quantity - Value object for quantities with unit of measure
type Quantity struct {
    amount decimal.Decimal
    uom    UnitOfMeasure
}

func NewQuantity(amount decimal.Decimal, uom UnitOfMeasure) Quantity {
    return Quantity{
        amount: amount,
        uom:    uom,
    }
}

func (q Quantity) Amount() decimal.Decimal { return q.amount }
func (q Quantity) Unit() UnitOfMeasure     { return q.uom }

func (q Quantity) Add(other Quantity) Quantity {
    // In production, validate that UOMs are compatible
    return NewQuantity(q.amount.Add(other.amount), q.uom)
}

func (q Quantity) Subtract(other Quantity) Quantity {
    return NewQuantity(q.amount.Sub(other.amount), q.uom)
}

// UnitOfMeasure - Value object for unit of measure
type UnitOfMeasure struct {
    code   string
    name   string
    symbol string
}

func NewUnitOfMeasure(code, name, symbol string) UnitOfMeasure {
    return UnitOfMeasure{
        code:   code,
        name:   name,
        symbol: symbol,
    }
}

func (u UnitOfMeasure) Code() string   { return u.code }
func (u UnitOfMeasure) Name() string   { return u.name }
func (u UnitOfMeasure) Symbol() string { return u.symbol }

// Address - Value object for physical addresses
type Address struct {
    line1      string
    line2      string
    city       string
    state      string
    postalCode string
    country    string
}

func NewAddress(line1, city, country string) Address {
    return Address{
        line1:   line1,
        city:    city,
        country: country,
    }
}

func (a Address) Line1() string      { return a.line1 }
func (a Address) City() string       { return a.city }
func (a Address) Country() string    { return a.country }
func (a Address) FullAddress() string {
    result := a.line1
    if a.line2 != "" {
        result += ", " + a.line2
    }
    result += ", " + a.city
    if a.state != "" {
        result += ", " + a.state
    }
    if a.postalCode != "" {
        result += " " + a.postalCode
    }
    result += ", " + a.country
    return result
}

// ContactInfo - Value object for contact information
type ContactInfo struct {
    email string
    phone string
}

func NewContactInfo(email, phone string) (ContactInfo, error) {
    // Validate email format
    if email != "" && !isValidEmail(email) {
        return ContactInfo{}, errors.New("invalid email format")
    }

    return ContactInfo{
        email: email,
        phone: phone,
    }, nil
}

func (c ContactInfo) Email() string { return c.email }
func (c ContactInfo) Phone() string { return c.phone }

func isValidEmail(email string) bool {
    emailRegex := regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)
    return emailRegex.MatchString(email)
}
```

### 5.2 Common Interfaces

```go
// pkg/domain/shared/interfaces.go

package shared

import (
    "context"
    "github.com/google/uuid"
    "time"
)

// DomainEvent - Base interface for all domain events
type DomainEvent interface {
    EventName() string
    OccurredAt() time.Time
}

// AggregateRoot - Marker interface for aggregate roots
type AggregateRoot interface {
    ID() uuid.UUID
    Version() int
    Events() []DomainEvent
    ClearEvents()
    AddEvent(event DomainEvent)
}

// EventBus - Publish/Subscribe for domain events
type EventBus interface {
    Publish(ctx context.Context, event DomainEvent) error
    Subscribe(eventName string, handler EventHandler)
}

type EventHandler func(ctx context.Context, event DomainEvent) error
```

---

## 6. APPLICATION LAYER

### 6.1 Use Cases (Application Services)

```go
// pkg/application/inventory/create_item_usecase.go

package inventory

import (
    "context"
    "github.com/google/uuid"
    "erp/pkg/domain/inventory"
    "erp/pkg/domain/shared"
)

// CreateItemCommand - Input DTO
type CreateItemCommand struct {
    CompanyID     string
    Code          string
    Name          string
    Description   string
    CategoryID    *string
    ItemType      string
    UOMCode       string
    StandardCost  *decimal.Decimal
    ListPrice     *decimal.Decimal
}

// CreateItemResult - Output DTO
type CreateItemResult struct {
    ItemID string
}

// CreateItemUseCase - Application service
type CreateItemUseCase struct {
    itemRepo inventory.ItemRepository
    eventBus shared.EventBus
}

func NewCreateItemUseCase(
    itemRepo inventory.ItemRepository,
    eventBus shared.EventBus,
) *CreateItemUseCase {
    return &CreateItemUseCase{
        itemRepo: itemRepo,
        eventBus: eventBus,
    }
}

func (uc *CreateItemUseCase) Execute(
    ctx context.Context,
    cmd CreateItemCommand,
) (*CreateItemResult, error) {
    // 1. Parse inputs
    companyID, err := uuid.Parse(cmd.CompanyID)
    if err != nil {
        return nil, err
    }

    itemCode, err := inventory.NewItemCode(cmd.Code)
    if err != nil {
        return nil, err
    }

    itemType := inventory.ItemType(cmd.ItemType)
    uom := shared.NewUnitOfMeasure(cmd.UOMCode, cmd.UOMCode, cmd.UOMCode)

    // Get current user from context (for audit)
    userID := getUserIDFromContext(ctx)

    // 2. Create domain object (enforces business rules)
    item, err := inventory.NewItem(companyID, itemCode, cmd.Name, itemType, uom, userID)
    if err != nil {
        return nil, err
    }

    // 3. Set additional properties
    if cmd.StandardCost != nil || cmd.ListPrice != nil {
        var stdCost, listPrice *shared.Money
        if cmd.StandardCost != nil {
            cost := shared.NewMoney(*cmd.StandardCost, "USD")
            stdCost = &cost
        }
        if cmd.ListPrice != nil {
            price := shared.NewMoney(*cmd.ListPrice, "USD")
            listPrice = &price
        }
        if err := item.UpdatePricing(stdCost, listPrice); err != nil {
            return nil, err
        }
    }

    // 4. Persist to database
    if err := uc.itemRepo.Save(ctx, item); err != nil {
        return nil, err
    }

    // 5. Publish domain events
    for _, event := range item.Events() {
        if err := uc.eventBus.Publish(ctx, event); err != nil {
            // Log error but don't fail the use case
            // Events can be retried or published async
        }
    }
    item.ClearEvents()

    // 6. Return result
    return &CreateItemResult{
        ItemID: item.ID().String(),
    }, nil
}

func getUserIDFromContext(ctx context.Context) uuid.UUID {
    // Extract user ID from context (set by auth middleware)
    return uuid.New() // Placeholder
}
```

### 6.2 Query Services (CQRS Read Side)

```go
// pkg/application/inventory/queries/item_query_service.go

package queries

import (
    "context"
)

// ItemDTO - Data Transfer Object for queries
type ItemDTO struct {
    ID            string
    Code          string
    Name          string
    Description   string
    CategoryName  string
    ItemType      string
    UOMSymbol     string
    StandardCost  string
    ListPrice     string
    IsActive      bool
}

// ItemQueryService - Read-optimized queries
type ItemQueryService interface {
    GetItemByID(ctx context.Context, itemID string) (*ItemDTO, error)
    GetItemByCode(ctx context.Context, companyID, code string) (*ItemDTO, error)
    ListItems(ctx context.Context, companyID string, filters ItemQueryFilter) ([]ItemDTO, error)
    SearchItems(ctx context.Context, companyID, searchTerm string) ([]ItemDTO, error)
}

type ItemQueryFilter struct {
    CategoryID *string
    ItemType   *string
    IsActive   *bool
    Limit      int
    Offset     int
}

// Implementation would query database directly for performance
// Can use read-optimized views, denormalized data, etc.
```

---

## 7. INFRASTRUCTURE LAYER

### 7.1 Repository Implementation Example

```go
// pkg/infrastructure/persistence/postgres/item_repository.go

package postgres

import (
    "context"
    "database/sql"
    "github.com/google/uuid"
    "erp/pkg/domain/inventory"
)

type postgresItemRepository struct {
    db *sql.DB
}

func NewPostgresItemRepository(db *sql.DB) inventory.ItemRepository {
    return &postgresItemRepository{db: db}
}

func (r *postgresItemRepository) Save(ctx context.Context, item *inventory.Item) error {
    query := `
        INSERT INTO items (
            id, company_id, item_code, item_name, item_type, uom_code,
            standard_cost, list_price, is_active, created_at, updated_at, version
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (id) DO UPDATE SET
            item_name = EXCLUDED.item_name,
            standard_cost = EXCLUDED.standard_cost,
            list_price = EXCLUDED.list_price,
            is_active = EXCLUDED.is_active,
            updated_at = EXCLUDED.updated_at,
            version = items.version + 1
    `

    // Map domain aggregate to database schema
    // Execute query with RLS context set
    _, err := r.db.ExecContext(ctx, query /* ... mapped values ... */)
    return err
}

func (r *postgresItemRepository) FindByID(ctx context.Context, id uuid.UUID) (*inventory.Item, error) {
    query := `
        SELECT id, company_id, item_code, item_name, item_type, uom_code,
               standard_cost, list_price, is_active, created_at, updated_at, version
        FROM items
        WHERE id = $1 AND deleted_at IS NULL
    `

    // Query database
    // Reconstruct domain aggregate from database row
    // Return item
    return nil, nil // Placeholder
}

func (r *postgresItemRepository) FindByCode(ctx context.Context, companyID uuid.UUID, code string) (*inventory.Item, error) {
    query := `
        SELECT id, company_id, item_code, item_name, item_type, uom_code,
               standard_cost, list_price, is_active, created_at, updated_at, version
        FROM items
        WHERE company_id = $1 AND item_code = $2 AND deleted_at IS NULL
    `

    // Execute and map
    return nil, nil // Placeholder
}

func (r *postgresItemRepository) FindAll(ctx context.Context, companyID uuid.UUID, filter inventory.ItemFilter) ([]*inventory.Item, error) {
    // Build dynamic query based on filters
    // Execute and map to array of items
    return nil, nil // Placeholder
}

func (r *postgresItemRepository) Delete(ctx context.Context, id uuid.UUID) error {
    // Soft delete
    query := `UPDATE items SET deleted_at = NOW() WHERE id = $1`
    _, err := r.db.ExecContext(ctx, query, id)
    return err
}
```

### 7.2 Event Bus Implementation

```go
// pkg/infrastructure/events/in_memory_event_bus.go

package events

import (
    "context"
    "sync"
    "erp/pkg/domain/shared"
)

// InMemoryEventBus - Simple in-process event bus
type InMemoryEventBus struct {
    handlers map[string][]shared.EventHandler
    mu       sync.RWMutex
}

func NewInMemoryEventBus() shared.EventBus {
    return &InMemoryEventBus{
        handlers: make(map[string][]shared.EventHandler),
    }
}

func (bus *InMemoryEventBus) Publish(ctx context.Context, event shared.DomainEvent) error {
    bus.mu.RLock()
    handlers := bus.handlers[event.EventName()]
    bus.mu.RUnlock()

    // Execute all handlers synchronously (within same transaction)
    for _, handler := range handlers {
        if err := handler(ctx, event); err != nil {
            // Log error but continue with other handlers
            // In production, might want to use error aggregation
            continue
        }
    }

    return nil
}

func (bus *InMemoryEventBus) Subscribe(eventName string, handler shared.EventHandler) {
    bus.mu.Lock()
    defer bus.mu.Unlock()

    bus.handlers[eventName] = append(bus.handlers[eventName], handler)
}
```

---

## 8. PROJECT STRUCTURE

```
erp/
├── cmd/
│   ├── api/                     # HTTP API server entrypoint
│   │   └── main.go
│   ├── worker/                  # Background job worker
│   │   └── main.go
│   └── migrate/                 # Database migration CLI
│       └── main.go
│
├── pkg/
│   ├── domain/                  # Domain layer (pure business logic)
│   │   ├── shared/
│   │   │   ├── value_objects.go
│   │   │   └── interfaces.go
│   │   ├── inventory/
│   │   │   ├── item.go
│   │   │   ├── warehouse.go
│   │   │   ├── stock_transaction.go
│   │   │   ├── bill_of_materials.go
│   │   │   ├── repositories.go
│   │   │   ├── events.go
│   │   │   └── services/
│   │   │       └── stock_valuation_service.go
│   │   └── sales/
│   │       ├── customer.go
│   │       ├── sales_quotation.go
│   │       ├── sales_order.go
│   │       ├── invoice.go
│   │       ├── repositories.go
│   │       ├── events.go
│   │       └── services/
│   │           └── pricing_service.go
│   │
│   ├── application/             # Application layer (use cases)
│   │   ├── inventory/
│   │   │   ├── create_item_usecase.go
│   │   │   ├── adjust_stock_usecase.go
│   │   │   ├── transfer_stock_usecase.go
│   │   │   └── queries/
│   │   │       ├── item_query_service.go
│   │   │       └── stock_query_service.go
│   │   └── sales/
│   │       ├── create_order_usecase.go
│   │       ├── deliver_order_usecase.go
│   │       ├── create_invoice_usecase.go
│   │       ├── record_payment_usecase.go
│   │       └── queries/
│   │           ├── customer_query_service.go
│   │           └── order_query_service.go
│   │
│   ├── infrastructure/          # Infrastructure layer (adapters)
│   │   ├── persistence/
│   │   │   ├── postgres/
│   │   │   │   ├── db.go
│   │   │   │   ├── item_repository.go
│   │   │   │   ├── warehouse_repository.go
│   │   │   │   ├── customer_repository.go
│   │   │   │   └── order_repository.go
│   │   │   └── migrations/
│   │   ├── events/
│   │   │   ├── in_memory_event_bus.go
│   │   │   └── event_store.go
│   │   ├── cache/
│   │   │   └── redis_cache.go
│   │   └── external/
│   │       ├── email/
│   │       │   └── smtp_service.go
│   │       └── sms/
│   │           └── twilio_service.go
│   │
│   └── interfaces/              # Presentation layer
│       ├── http/
│       │   ├── server.go
│       │   ├── middleware/
│       │   │   ├── auth.go
│       │   │   ├── logging.go
│       │   │   └── error_handler.go
│       │   ├── handlers/
│       │   │   ├── inventory_handler.go
│       │   │   └── sales_handler.go
│       │   └── dto/
│       │       ├── item_dto.go
│       │       └── order_dto.go
│       └── cli/
│           └── commands/
│
├── internal/                    # Private application code
│   ├── config/
│   │   └── config.go
│   └── security/
│       └── rls.go
│
├── migrations/                  # SQL migration files
│   ├── 001_create_companies.up.sql
│   ├── 002_create_items.up.sql
│   └── ...
│
├── tests/
│   ├── unit/                    # Unit tests (domain layer)
│   ├── integration/             # Integration tests
│   └── e2e/                     # End-to-end tests
│
├── scripts/                     # Build and deployment scripts
├── docs/                        # Additional documentation
├── go.mod
├── go.sum
└── README.md
```

---

## 9. TESTING STRATEGY

### 9.1 Domain Layer Tests (Unit Tests)

```go
// pkg/domain/inventory/item_test.go

package inventory_test

import (
    "testing"
    "github.com/google/uuid"
    "github.com/shopspring/decimal"
    "erp/pkg/domain/inventory"
    "erp/pkg/domain/shared"
)

func TestNewItem_ValidData_Success(t *testing.T) {
    // Given
    companyID := uuid.New()
    code, _ := inventory.NewItemCode("ITEM001")
    uom := shared.NewUnitOfMeasure("EA", "Each", "ea")
    userID := uuid.New()

    // When
    item, err := inventory.NewItem(
        companyID,
        code,
        "Test Item",
        inventory.ItemTypeFinishedGood,
        uom,
        userID,
    )

    // Then
    if err != nil {
        t.Fatalf("expected no error, got %v", err)
    }

    if item == nil {
        t.Fatal("expected item to be created")
    }

    // Verify domain event was raised
    events := item.Events()
    if len(events) != 1 {
        t.Errorf("expected 1 domain event, got %d", len(events))
    }

    if events[0].EventName() != "inventory.item.created" {
        t.Errorf("expected item.created event, got %s", events[0].EventName())
    }
}

func TestItem_UpdatePricing_NegativePrice_Fails(t *testing.T) {
    // Given
    item := createTestItem(t)
    negativeCost := shared.NewMoney(decimal.NewFromInt(-10), "USD")

    // When
    err := item.UpdatePricing(&negativeCost, nil)

    // Then
    if err == nil {
        t.Error("expected error for negative cost")
    }
}

func createTestItem(t *testing.T) *inventory.Item {
    code, _ := inventory.NewItemCode("TEST001")
    uom := shared.NewUnitOfMeasure("EA", "Each", "ea")
    item, _ := inventory.NewItem(
        uuid.New(),
        code,
        "Test",
        inventory.ItemTypeFinishedGood,
        uom,
        uuid.New(),
    )
    return item
}
```

### 9.2 Application Layer Tests (Use Case Tests)

```go
// pkg/application/inventory/create_item_usecase_test.go

package inventory_test

import (
    "context"
    "testing"
    "github.com/shopspring/decimal"
    "erp/pkg/application/inventory"
)

func TestCreateItemUseCase_ValidCommand_Success(t *testing.T) {
    // Given
    mockRepo := NewMockItemRepository()
    mockEventBus := NewMockEventBus()
    useCase := inventory.NewCreateItemUseCase(mockRepo, mockEventBus)

    cmd := inventory.CreateItemCommand{
        CompanyID:   "550e8400-e29b-41d4-a716-446655440000",
        Code:        "ITEM001",
        Name:        "Test Item",
        ItemType:    "finished_good",
        UOMCode:     "EA",
    }

    // When
    result, err := useCase.Execute(context.Background(), cmd)

    // Then
    if err != nil {
        t.Fatalf("expected no error, got %v", err)
    }

    if result.ItemID == "" {
        t.Error("expected item ID to be returned")
    }

    // Verify repository was called
    if mockRepo.SaveCallCount != 1 {
        t.Errorf("expected Save to be called once, called %d times", mockRepo.SaveCallCount)
    }

    // Verify event was published
    if mockEventBus.PublishCallCount != 1 {
        t.Errorf("expected event to be published once, published %d times", mockEventBus.PublishCallCount)
    }
}

// Mock implementations
type MockItemRepository struct {
    SaveCallCount int
}

func NewMockItemRepository() *MockItemRepository {
    return &MockItemRepository{}
}

func (m *MockItemRepository) Save(ctx context.Context, item *inventory.Item) error {
    m.SaveCallCount++
    return nil
}

// ... other interface methods ...

type MockEventBus struct {
    PublishCallCount int
}

func NewMockEventBus() *MockEventBus {
    return &MockEventBus{}
}

func (m *MockEventBus) Publish(ctx context.Context, event shared.DomainEvent) error {
    m.PublishCallCount++
    return nil
}

func (m *MockEventBus) Subscribe(eventName string, handler shared.EventHandler) {
    // No-op for tests
}
```

---

## 10. EVOLUTION & SCALABILITY

### 10.1 Current Phase: Modular Monolith

**Advantages:**
- ✅ Simple deployment (single binary)
- ✅ ACID transactions across modules
- ✅ Lower infrastructure costs
- ✅ Easier debugging and development
- ✅ Fast inter-module communication

### 10.2 Scaling Strategy

**Phase 1: Vertical Scaling**
- Increase server resources (CPU, RAM)
- Database read replicas
- Connection pooling
- Caching layer (Redis)

**Phase 2: Horizontal Scaling**
- Multiple app instances behind load balancer
- Stateless application design
- Session management in Redis
- Database connection pooling

**Phase 3: Microservices Extraction** (when needed)

Extract bounded contexts to independent services:

1. **Notification Service** (first - easiest)
2. **Reporting Service** (read-heavy, benefits from separation)
3. **Inventory Service** (if inventory operations become bottleneck)
4. **Sales Service** (if sales volume demands independent scaling)

**Migration Path:**
```
Current: Modular Monolith → Extract Notifications → Extract Reporting → Full Microservices
```

**Communication Changes:**
- In-memory events → Message broker (Kafka/RabbitMQ)
- Direct calls → gRPC or REST APIs
- Shared database → Database per service
- ACID transactions → Saga pattern

### 10.3 Future-Ready Design

The architecture is designed for microservices extraction:

✅ **Bounded contexts** clearly defined
✅ **Domain events** enable async communication
✅ **Repository pattern** abstracts data access
✅ **Interface-based** module communication
✅ **No shared state** between modules
✅ **Company-based isolation** enables sharding

---

## 11. SUMMARY

This domain architecture provides:

- ✅ **Clean separation** of business logic from infrastructure
- ✅ **Testable** domain models without external dependencies
- ✅ **Modular design** ready for microservices extraction
- ✅ **Event-driven** communication between modules
- ✅ **Multi-tenant ready** with Row Level Security
- ✅ **CQRS pattern** for read/write optimization
- ✅ **DDD principles** for complex business rules
- ✅ **Type-safe** Go implementation
- ✅ **Scalable** from small to enterprise-level

The system starts simple as a modular monolith and can evolve to microservices as scale demands.
