# 1. Project Overview
Implement van-level inventory and sales tracking in the ERP by treating each van as a separate warehouse/location. Reuse existing stock transfer, inventory deduction, and sales modules. Support mobile workflows for drivers and reconciliation workflows for back office.

# 2. Business Objectives
1. Track inventory per van accurately (load → sell → end-of-day).  
2. Prevent sales of items not available on the van.  
3. Provide real-time visibility of van stock, variance, and route performance.  
4. Avoid changes to core accounting/inventory logic.  
5. Minimize risk by using native ERP warehouse and stock transfer features.  

# 3. Scope

## In-scope
- Warehouse-per-van creation & assignment.  
- Stock Transfer (Depot → Van).  
- Van-based Sales Order/Invoice creation.  
- Driver mobile workflows (Load, Sell, End-of-Day).  
- End-of-day reconciliation (count, variance, adjustments).  
- Reporting dashboards (on-hand, sales, variance).  
- Permissions to restrict drivers to their van warehouse.  

## Out-of-scope (for now)
- GPS/route optimization.  
- Offline sync engine.  
- Cash wallet ledger.  
- Telemetry-based van tracking.  

# 4. Functional Requirements

## 4.1 Van Warehouse Setup
- System must allow creation of a warehouse per van.  
- Drivers can be linked to exactly one van warehouse.  
- Drivers must see only their assigned warehouse in any inventory or sales screen.  

## 4.2 Van Loading (Stock Transfer)
- Depot users initiate stock transfer to a van.  
- Driver must confirm “Today’s Load” before items are available for sale.  
- System must update van on-hand immediately upon confirmation.  

## 4.3 On-Route Selling
- Drivers must only be able to sell items available in their van warehouse.  
- System must validate:  
  - Quantity ≤ on-hand.  
  - Van warehouse assigned automatically.  
- Payments captured per transaction.  

## 4.4 End-of-Day Close
- Driver performs physical count in mobile app.  
- System computes:  
  - **Expected Ending = Load – Sales**  
  - **Variance = Physical Count – Expected Ending**  
- Back office approves or rejects variances.  
- Approved variances generate stock adjustment entries.  

## 4.5 Reporting
- Van On-Hand Snapshot.  
- Load vs. Sales vs. Ending Stock variance.  
- Van Sales Summary.  
- Payment Collection Summary.  

# 5. Non-Functional Requirements
- **Performance:** Mobile screens must load within 2 seconds on average connection.  
- **Reliability:** No impact on depot inventory or accounting modules.  
- **Usability:** Driver UI must be simplified to max 3–4 actions.  
- **Security:** Drivers cannot access non-van warehouses or modify stock transfers.  

# 6. Roles & Permissions

### Drivers
- Allowed: view load, create sales, submit end-of-day count.  
- Denied: create stock adjustments (except via end-of-day flow), access depot warehouses.  

### Depot Staff
- Allowed: create & approve stock transfers, run reports.  

### Supervisors
- Allowed: approve/reject variance adjustments.  

# 7. Acceptance Criteria
- Sales for each van deduct from the correct warehouse.  
- Variance adjustments appear only after supervisor approval.  
- Driver cannot sell items not in van.  
- End-of-day reconciliation produces zero variance when counts match expected.  
- Depot workflows remain unaffected.  

# 8. Risks
- Drivers selecting wrong warehouse → mitigated by restrictions & auto-assignment.  
- Incorrect van loads → mitigated by driver confirmation logic.  
- Variance manipulation → mitigated by mandatory supervisor approval.  
