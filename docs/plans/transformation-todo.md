# Material/Product Transformation - Implementation Tracker

**Feature:** Material/Product Transformation (Inventory Module)
**Status:** Planning Complete - Awaiting Implementation Approval
**Started:** 2025-12-17
**Last Updated:** 2025-12-17

---

## EPIC 1: Domain & Architecture Setup
**Status:** 🔴 Not Started

### Task 1.1: Define Transformation Domain Boundary
- [ ] Create domain namespace/folder structure
- [ ] Verify no manufacturing concepts leak into code
- [ ] Document domain boundaries in architecture docs

### Task 1.2: Define Core Domain Models
- [ ] Create `src/types/transformation-template.ts`
- [ ] Create `src/types/transformation-order.ts`
- [ ] Create `src/types/transformation-lineage.ts`
- [ ] Define state machine enums (DRAFT → RELEASED → EXECUTING → COMPLETED)
- [ ] Define status types and filter interfaces

**Acceptance Criteria:**
- ✅ Models use SRS terminology exactly
- ✅ No product-specific attributes exist
- ✅ Quantities are explicit, no formulas

---

## EPIC 2: Database & Persistence Layer
**Status:** 🔴 Not Started

### Task 2.1: Create Transformation Tables
- [ ] Create new migration file: `supabase/migrations/[VERSION]_transformation_schema.sql`
- [ ] Define `transformation_templates` table
- [ ] Define `transformation_template_inputs` table
- [ ] Define `transformation_template_outputs` table
- [ ] Define `transformation_orders` table
- [ ] Define `transformation_order_inputs` table
- [ ] Define `transformation_order_outputs` table
- [ ] Define `transformation_lineage` table (N→M relationships)
- [ ] Add foreign keys to `items`, `warehouses`, `users`, `companies` tables
- [ ] Add RLS policies for multi-tenant access control
- [ ] Add indexes for performance (company_id, status, warehouse_id)
- [ ] Add triggers for `updated_at` timestamps
- [ ] Test migration up/down scripts

**Acceptance Criteria:**
- ✅ No changes to existing inventory tables
- ✅ Foreign keys reference item and warehouse tables
- ✅ Lineage table supports N→M relationships
- ✅ Migration runs cleanly with `supabase db reset`

### Task 2.2: Enforce Template Immutability
- [ ] Add `is_active` boolean to `transformation_templates`
- [ ] Add `usage_count` integer to `transformation_templates`
- [ ] Create trigger/constraint to prevent editing when `usage_count > 0`
- [ ] Add database function to check template lock status

**Acceptance Criteria:**
- ✅ Used templates cannot be edited
- ✅ Versioning or hard lock is enforced
- ✅ Attempted edits return explicit error

---

## EPIC 3: Transformation Template Management
**Status:** 🔴 Not Started

### Task 3.1: Create Template CRUD APIs
- [ ] Create `src/lib/validations/transformation-template.ts` (Zod schemas)
- [ ] Create `src/app/api/transformations/templates/route.ts` (GET, POST)
- [ ] Create `src/app/api/transformations/templates/[id]/route.ts` (GET, PATCH, DELETE)
- [ ] Create `src/app/api/transformations/templates/[id]/deactivate/route.ts` (POST)
- [ ] Implement template immutability check in PATCH endpoint
- [ ] Add pagination to GET list endpoint
- [ ] Add filtering by name, status, item

**Acceptance Criteria:**
- ✅ Templates support N inputs and N outputs
- ✅ Validation prevents empty input/output
- ✅ Templates are reusable
- ✅ Cannot edit template with `usage_count > 0`

### Task 3.2: Template Validation Rules
- [ ] Implement validation: ≥1 input required
- [ ] Implement validation: ≥1 output required
- [ ] Implement validation: All quantities > 0
- [ ] Implement validation: No circular references (item as both input and output)
- [ ] Add explicit error messages for each validation failure

**Acceptance Criteria:**
- ✅ Invalid templates cannot be saved
- ✅ Error messages are explicit and helpful

---

## EPIC 4: Transformation Order Lifecycle
**Status:** 🔴 Not Started

### Task 4.1: Create Transformation Order
- [ ] Create `src/lib/validations/transformation-order.ts` (Zod schemas)
- [ ] Create `src/app/api/transformations/orders/route.ts` (GET, POST)
- [ ] Create `src/app/api/transformations/orders/[id]/route.ts` (GET, PATCH)
- [ ] Capture: template_id, source_warehouse_id, dest_warehouse_id, planned_quantity
- [ ] Default status to DRAFT on creation
- [ ] Copy template inputs/outputs to order inputs/outputs

**Acceptance Criteria:**
- ✅ Order starts in DRAFT state
- ✅ No inventory impact on creation

### Task 4.2: Implement State Machine
- [ ] Define valid state transitions in types
- [ ] Create `validateStateTransition()` function
- [ ] Add state transition audit log (track user, timestamp, from_state, to_state)
- [ ] Implement state transition endpoints:
  - [ ] `/api/transformations/orders/[id]/release/route.ts` (DRAFT → RELEASED)
  - [ ] `/api/transformations/orders/[id]/execute/route.ts` (RELEASED → EXECUTING)
  - [ ] `/api/transformations/orders/[id]/complete/route.ts` (EXECUTING → COMPLETED)
  - [ ] `/api/transformations/orders/[id]/close/route.ts` (COMPLETED → CLOSED)

**Acceptance Criteria:**
- ✅ Illegal transitions are blocked with clear errors
- ✅ State transitions are auditable (who, when, why)

### Task 4.3: Release Order Validation
- [ ] Validate template is active before release
- [ ] Validate warehouses exist
- [ ] Check inventory availability for all input items
- [ ] Prevent release if validation fails
- [ ] Return detailed validation errors

**Acceptance Criteria:**
- ✅ Cannot release invalid orders
- ✅ Inventory still unchanged after release (validation only)

---

## EPIC 5: Inventory Integration (Execution Phase)
**Status:** 🔴 Not Started

### Task 5.1: Consume Input Inventory
- [ ] Create `src/services/inventory/transformationService.ts`
- [ ] Implement `consumeInputs()` function:
  - [ ] Validate stock availability for each input
  - [ ] Create stock_transaction (type='out') for each input line
  - [ ] Update `item_warehouse.current_stock` atomically
  - [ ] Update `item_warehouse.available_stock`
  - [ ] Record qty_before, qty_after in transaction items
- [ ] Use database transaction for atomicity
- [ ] Implement rollback on failure

**Acceptance Criteria:**
- ✅ Inventory decreases correctly
- ✅ No negative inventory possible
- ✅ Transactions are auditable via stock_transactions table

### Task 5.2: Produce Output Inventory
- [ ] Implement `produceOutputs()` function:
  - [ ] Accept actual quantities (may differ from planned)
  - [ ] Create stock_transaction (type='in') for each output
  - [ ] Update `item_warehouse.current_stock` atomically
  - [ ] Support scrap/waste outputs with zero value flag
  - [ ] Record qty_before, qty_after
- [ ] Include in same transaction as input consumption

**Acceptance Criteria:**
- ✅ Output items appear in destination warehouse
- ✅ Items are immediately usable (sale, transfer, etc.)
- ✅ No WIP or special flags exist

### Task 5.3: Enforce Post-Transformation Inventory Rule
- [ ] Verify outputs have no special "produced" flag
- [ ] Test outputs can be sold immediately
- [ ] Test outputs can be transferred immediately
- [ ] Verify no dependency on order status after COMPLETED

**Acceptance Criteria:**
- ✅ Output items are indistinguishable from purchased items
- ✅ No dependency on order status after posting
- ✅ No "produced" state exists in item records

---

## EPIC 6: Cost Redistribution
**Status:** 🔴 Not Started

### Task 6.1: Allocate Cost from Inputs to Outputs
- [ ] Implement `calculateCostAllocation()` function
- [ ] Use quantity-based allocation as default strategy:
  - Total input cost / Total output quantity = Cost per unit
  - Apply to each output based on quantity
- [ ] Handle scrap outputs (assign minimal/zero cost)
- [ ] Store cost allocation in `transformation_order_outputs.allocated_cost`
- [ ] Update `item_warehouse.stock_value` for outputs
- [ ] Verify total cost before = total cost after

**Acceptance Criteria:**
- ✅ Total cost before = total cost after
- ✅ Scrap handling is explicit
- ✅ No cost creation or loss

### Task 6.2: Cost Variance Handling
- [ ] Calculate planned vs actual quantity variance
- [ ] Record variance in `transformation_orders.cost_variance`
- [ ] Store variance explanation in `transformation_orders.variance_notes`
- [ ] Ensure cost remains balanced despite variance

**Acceptance Criteria:**
- ✅ Variance is recorded
- ✅ Cost remains balanced
- ✅ Variance is auditable

---

## EPIC 7: Traceability & Lineage
**Status:** 🔴 Not Started

### Task 7.1: Record Input → Output Lineage
- [ ] Implement `recordLineage()` function
- [ ] Create records in `transformation_lineage` table during execution
- [ ] Support N→M relationships (many inputs → many outputs)
- [ ] Store proportional quantities for partial tracing
- [ ] Include cost attribution per lineage link

**Acceptance Criteria:**
- ✅ Every output line traces to ≥1 input line
- ✅ Supports N→M relationships
- ✅ Persists after order closure

### Task 7.2: Enforce Lineage Separation
- [ ] Verify inventory queries do NOT join to lineage table
- [ ] Ensure lineage does not affect stock availability calculations
- [ ] Test performance of inventory queries (no degradation)
- [ ] Document that lineage is audit/reporting only

**Acceptance Criteria:**
- ✅ Inventory queries do not depend on lineage
- ✅ Lineage used only for audit/reporting
- ✅ No performance impact on stock operations

---

## EPIC 8: Validation & Guardrails
**Status:** 🔴 Not Started

### Task 8.1: Prevent Invalid Transformations
- [ ] Block negative quantities at validation layer
- [ ] Prevent circular transformations (item as input and output)
- [ ] Prevent execution without sufficient stock
- [ ] Add constraint checks in database
- [ ] Return explicit, actionable error messages

**Acceptance Criteria:**
- ✅ Errors are explicit and user-friendly
- ✅ No partial data corruption possible

### Task 8.2: Concurrency & Atomicity
- [ ] Wrap execute operation in database transaction
- [ ] Use row-level locking for `item_warehouse` updates
- [ ] Test concurrent execution of orders for same item
- [ ] Verify no double-consumption of stock
- [ ] Implement rollback on any failure

**Acceptance Criteria:**
- ✅ No double-consumption
- ✅ Transactions are atomic
- ✅ Rollback on failure

---

## EPIC 9: Reporting & Audit Readiness
**Status:** 🔴 Not Started

### Task 9.1: Transformation History Query
- [ ] Create `src/app/api/transformations/reports/history/route.ts`
- [ ] Support filters: item_id, warehouse_id, date_range, status
- [ ] Include pagination and sorting
- [ ] Return full order details with inputs/outputs
- [ ] Add audit trail (state changes, user actions)

**Acceptance Criteria:**
- ✅ Orders searchable by item, date, warehouse
- ✅ Full audit trail visible

### Task 9.2: Lineage & Cost Audit Queries
- [ ] Create `src/app/api/transformations/lineage/route.ts`
- [ ] Support input → output trace
- [ ] Support reverse trace (output → inputs)
- [ ] Show cost flow through transformation
- [ ] Export to CSV for audit

**Acceptance Criteria:**
- ✅ Input → output trace works
- ✅ Cost redistribution is explainable

---

## EPIC 10: Testing & Quality
**Status:** 🔴 Not Started

### Task 10.1: Unit Tests
- [ ] Test state transition validation
- [ ] Test cost allocation calculations
- [ ] Test template validation rules
- [ ] Test circular reference detection
- [ ] Test quantity validations

**Coverage Target:** ≥80% for service layer

### Task 10.2: Integration Tests
- [ ] Test full order lifecycle (DRAFT → CLOSED)
- [ ] Test inventory consumption and production
- [ ] Test partial execution (less than planned quantity)
- [ ] Test lineage recording
- [ ] Test cost redistribution end-to-end

**Coverage Target:** All happy paths + common edge cases

### Task 10.3: Failure & Edge Case Tests
- [ ] Test insufficient stock scenario
- [ ] Test invalid state transitions
- [ ] Test concurrent execution of same order
- [ ] Test template lock enforcement
- [ ] Test rollback on execution failure
- [ ] Test circular transformation prevention

**Coverage Target:** All validation rules + failure scenarios

---

## EPIC 11: UI Implementation (Bonus)
**Status:** 🔴 Not Started

### Task 11.1: Template Management UI
- [ ] Create `src/app/(dashboard)/inventory/transformations/templates/page.tsx`
- [ ] Create `src/components/transformations/TransformationTemplateForm.tsx`
- [ ] List templates with search/filter
- [ ] Create/edit template form with input/output builder
- [ ] Show usage count and lock status
- [ ] Deactivate template action

### Task 11.2: Order Management UI
- [ ] Create `src/app/(dashboard)/inventory/transformations/page.tsx`
- [ ] Create `src/app/(dashboard)/inventory/transformations/new/page.tsx`
- [ ] Create `src/app/(dashboard)/inventory/transformations/[id]/page.tsx`
- [ ] List orders with filters
- [ ] Create order from template
- [ ] Order detail view with state actions
- [ ] Execute dialog with actual quantity input
- [ ] Show lineage visualization

### Task 11.3: React Query Hooks & API Clients
- [ ] Create `src/hooks/useTransformationTemplates.ts`
- [ ] Create `src/hooks/useTransformationOrders.ts`
- [ ] Create `src/hooks/useTransformationLineage.ts`
- [ ] Create `src/lib/api/transformation-templates.ts`
- [ ] Create `src/lib/api/transformation-orders.ts`
- [ ] Create `src/lib/api/transformation-lineage.ts`

---

## Progress Summary

| Epic | Status | Tasks Complete | Total Tasks |
|------|--------|----------------|-------------|
| EPIC 1: Domain & Architecture | 🔴 Not Started | 0 | 2 |
| EPIC 2: Database & Persistence | 🔴 Not Started | 0 | 2 |
| EPIC 3: Template Management | 🔴 Not Started | 0 | 2 |
| EPIC 4: Order Lifecycle | 🔴 Not Started | 0 | 3 |
| EPIC 5: Inventory Integration | 🔴 Not Started | 0 | 3 |
| EPIC 6: Cost Redistribution | 🔴 Not Started | 0 | 2 |
| EPIC 7: Traceability & Lineage | 🔴 Not Started | 0 | 2 |
| EPIC 8: Validation & Guardrails | 🔴 Not Started | 0 | 2 |
| EPIC 9: Reporting & Audit | 🔴 Not Started | 0 | 2 |
| EPIC 10: Testing & Quality | 🔴 Not Started | 0 | 3 |
| EPIC 11: UI Implementation | 🔴 Not Started | 0 | 3 |
| **TOTAL** | **0%** | **0** | **26** |

---

## Risk & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Template immutability not enforced | High | Add database constraints + validation in service layer |
| Concurrent stock consumption | High | Use row-level locking + transactions |
| Cost calculation errors | Medium | Comprehensive unit tests + validation |
| Performance on large lineage queries | Medium | Add indexes on lineage table, paginate results |
| Circular transformation logic | Medium | Implement detection before template save |

---

## Notes & Decisions

- **Decision:** Use existing `stock_transactions` infrastructure instead of custom inventory update logic
- **Decision:** Template immutability enforced via `usage_count` check, not versioning (simpler)
- **Decision:** Cost allocation defaults to quantity-based (can extend later)
- **Decision:** Lineage table is separate from inventory logic (audit only)
- **Decision:** No WIP state - outputs are immediately standard inventory

---

## Next Steps

1. ✅ Review this plan with Carl
2. ⏳ Get approval to proceed with implementation
3. ⏳ Start with EPIC 2 (Database Schema) after approval
4. ⏳ Implement EPICs sequentially, testing each before moving forward
