# ERP System User Stories and Epics

## 1. INVENTORY DOMAIN

### 1.1 Item Master

**User Story:**
As an inventory officer, I want to create and manage a centralized list of all items, so that every department refers to the same source of product information.

**Acceptance Criteria:**

- I can create new items with name, code/SKU, unit of measure, and category.
- I can define purchase and sales prices (optional).
- I can assign an item to one or more warehouses.
- I can deactivate items no longer in use.
- The system prevents duplicate item codes.
- Item details appear consistently across sales and stock records.

**Dependencies:**

- Linked to Sales Orders, Deliveries, and Stock Movements.

### 1.2 Warehouse Management

**User Story:**
As an inventory manager, I want to define multiple warehouses and locations so I can track stock levels per site.

**Acceptance Criteria:**

- I can add, edit, and deactivate warehouse records.
- Each stock entry or transaction is tagged to a warehouse.
- System can show total and per-warehouse stock quantities.
- Transfers between warehouses are logged and traceable.

**Dependencies:**

- Used in Stock Transactions, Reorder alerts, and Sales Fulfillment.

### 1.3 Stock Transactions

**User Story:**
As an inventory officer, I want to record all stock movements (in, out, transfer, adjustment) so that inventory quantities remain accurate.

**Acceptance Criteria:**

- I can record "Stock In" with reference (e.g., Purchase, Adjustment).
- I can record "Stock Out" (e.g., Sales, Damaged, Returned).
- The system automatically updates available quantity.
- Each transaction has date, reference number, user, and remarks.
- I can generate a transaction ledger filtered by date, item, or warehouse.

**Dependencies:**

- Tied to Delivery Notes, Returns, Purchase Receipts (future).

### 1.4 Reorder Management

**User Story:**
As an inventory manager, I want to set minimum stock levels for each item so that I'm alerted before running out of stock.

**Acceptance Criteria:**

- I can define reorder level per item or per warehouse.
- When stock falls below the threshold, a notification appears.
- Reorder alerts can be viewed in a summary dashboard.
- I can export the list for purchase planning.

**Dependencies:**

- Future link to Procurement Module for automatic PO creation.

### 1.5 Inventory Valuation

**User Story:**
As an accountant/inventory controller, I want the system to compute the cost of goods using a consistent valuation method (FIFO, LIFO, or Average), so that financial reports are accurate.

**Acceptance Criteria:**

- I can choose the default valuation method in settings.
- Stock value recalculates automatically with each transaction.
- I can generate valuation reports by date and warehouse.

**Dependencies:**

- Links to accounting module in future phase.

### 1.6 Batch / Serial Tracking (optional for expansion)

**User Story:**
As a warehouse supervisor, I want to track each batch or serial number for traceable items (like perishables or electronics).

**Acceptance Criteria:**

- Each stock-in record can include batch or serial number.
- The system tracks expiry dates and alerts before expiry.
- Batch numbers appear in stock and delivery reports.

### 1.7 Recipe / Bill of Materials (BOM) (for future manufacturing use)

**User Story:**
As a production planner, I want to define a finished product's composition (ingredients or parts) so that inventory can deduct components automatically upon production.

**Acceptance Criteria:**

- I can define parent item and list components with quantities.
- When a product is produced or sold, the system can auto-deduct components.

## 2. SALES DOMAIN

### 2.1 Customer Master

**User Story:**
As a sales officer, I want to maintain a customer directory with contact details, tax IDs, and payment terms so that I can manage relationships and credit limits.

**Acceptance Criteria:**

- I can add new customers with unique IDs.
- I can define credit terms and payment methods.
- I can deactivate or archive inactive customers.
- The customer list appears as selectable in quotations, orders, and invoices.

**Dependencies:**

- Links with CRM (future) and Accounting (for AR tracking).

### 2.2 Price List & Discounts

**User Story:**
As a sales manager, I want to define price lists and discount rules per customer or group so that pricing remains consistent.

**Acceptance Criteria:**

- I can create multiple price lists with validity dates.
- I can assign a price list to a specific customer or group.
- I can apply item-based or order-based discounts.
- Discount application is logged and approval may be required (optional).

**Dependencies:**

- Used in Quotation, Sales Order, and Invoice generation.

### 2.3 Sales Quotation

**User Story:**
As a sales officer, I want to create and send quotations to customers so I can formalize offers before sales are confirmed.

**Acceptance Criteria:**

- I can create a quotation with customer, items, prices, and validity.
- I can print/email the quotation as PDF.
- I can convert a quotation into a Sales Order with one click.
- System records status: Draft ’ Sent ’ Accepted ’ Rejected.

**Dependencies:**

- Uses Customer and Price List modules.

### 2.4 Sales Order

**User Story:**
As a sales officer, I want to record confirmed customer orders so I can manage fulfillment and track delivery progress.

**Acceptance Criteria:**

- I can create a Sales Order from scratch or from a quotation.
- Order must include customer, delivery date, and items.
- Status transitions automatically: Draft ’ Confirmed ’ Delivered ’ Invoiced ’ Closed.
- I can partially fulfill or invoice orders.
- The system reserves inventory quantities upon confirmation.

**Dependencies:**

- Links to Delivery Note, Invoice, and Inventory deduction.

### 2.5 Delivery Note

**User Story:**
As a warehouse officer, I want to record product deliveries so that stock is updated and customers can receive items accurately.

**Acceptance Criteria:**

- Delivery can be created from a confirmed Sales Order.
- I can mark each item as delivered (full or partial).
- System reduces stock quantity in the warehouse.
- Delivery status: Draft ’ Delivered ’ Verified.
- Delivery document can be printed with customer signature area.

**Dependencies:**

- Updates Inventory (Stock Out).
- Used by Accounting for invoicing later.

### 2.6 Sales Invoice

**User Story:**
As a sales accountant, I want to create invoices from deliveries or orders so that revenue and customer balance are tracked.

**Acceptance Criteria:**

- I can generate invoices linked to deliveries or sales orders.
- Taxes, discounts, and shipping charges are applied automatically.
- Invoice number follows a configured numbering series.
- I can print/email the invoice and record its payment status.

**Dependencies:**

- Future link to Accounting journal entries.

### 2.7 Payment Collection

**User Story:**
As a sales accountant, I want to record customer payments so I can track collections and outstanding balances.

**Acceptance Criteria:**

- Payments can be linked to one or more invoices.
- I can specify mode (cash, bank, online, etc.).
- The system shows outstanding balance per customer.
- Payment history is visible under each invoice.

**Dependencies:**

- Future integration to Finance/AR ledger.

### 2.8 Sales Returns / Credit Notes

**User Story:**
As a sales officer, I want to record returned goods so I can adjust both inventory and customer accounts.

**Acceptance Criteria:**

- I can select which invoice/delivery the return relates to.
- Returned items go back into stock (if approved).
- System can auto-generate credit notes.
- Return reasons and approval status are logged.

**Dependencies:**

- Links with Inventory (Stock In) and Finance (Credit Note).

## 3. CROSS-MODULE & ADMIN STORIES

### 3.1 User Management

**User Story:**
As an administrator, I want to manage user roles and permissions so that data access is controlled.

**Acceptance Criteria:**

- I can create users and assign roles (Admin, Sales, Inventory, Approver, Viewer).
- Permissions define which modules and actions are allowed.
- Logs capture user activities and timestamps.

### 3.2 Audit Logs

**User Story:**
As an auditor, I want to view all key changes made in the system so I can trace actions and ensure accountability.

**Acceptance Criteria:**

- Every record change (create, edit, delete) is logged with user, date, and time.
- I can filter logs by user, module, or date.

### 3.3 Alerts & Notifications

**User Story:**
As a manager, I want to receive alerts for low stock, overdue payments, or pending approvals so I can act promptly.

**Acceptance Criteria:**

- System triggers alerts when defined thresholds are met.
- Alerts can be viewed in-app or sent by email (future).

## 4. REPORTING & ANALYTICS STORIES

### 4.1 Inventory Reports

- As an inventory manager, I want to see stock on hand by warehouse.
- As a buyer, I want to view items below reorder level.
- As a controller, I want to generate valuation reports for accounting periods.

### 4.2 Sales Reports

- As a sales manager, I want to see sales summary by date, product, region.
- As a finance officer, I want to view unpaid invoices and overdue payments.
- As a director, I want a sales performance dashboard (revenue, top items, customers).

## Scalability Readiness in User Stories

Across all user stories, each major entity (Customer, Item, Warehouse, Order, Invoice) should:

- Support multi-company / multi-branch attributes.
- Allow custom fields and tags for future extensibility.
- Be designed for approval workflows (draft ’ approved).
- Be compatible with audit trails and API exposure for other ERP modules.
