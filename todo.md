# ERP System - TODO List

**Status Legend:** ⬜ Not Started | 🔄 In Progress | ✅ Completed | 🚫 Blocked

---

## 🚀 CURRENT IMPLEMENTATION: INVENTORY DOMAIN BACKEND (Self-Hosted Supabase)

### Phase 1: Backend Setup & Supabase Installation

#### 1.1 Backend Directory Structure
- [x] ✅ Create `backend/` directory
- [x] ✅ Create `backend/.env` file
- [x] ✅ Create `backend/.gitignore`
- [x] ✅ Create `backend/README.md`
- [x] ✅ Update root `.gitignore` to include backend env files (already included)

#### 1.2 Install Supabase CLI
- [x] ✅ Install Supabase CLI via Homebrew: `brew install supabase/tap/supabase`
- [x] ✅ Verify installation: `supabase --version` (v2.54.11)

#### 1.3 Initialize Supabase in Backend
- [x] ✅ Navigate to `backend/` directory
- [x] ✅ Run `supabase init` (creates `backend/supabase/` directory)
- [x] ✅ Review generated `backend/supabase/config.toml`
- [x] ✅ Create `backend/supabase/migrations/` directory
- [x] ✅ Create `backend/supabase/seed.sql` placeholder

#### 1.4 Start Supabase Local
- [x] ✅ Run `supabase start` from backend directory
- [x] ✅ Wait for Docker containers to start
- [x] ✅ Note local credentials (API URL, anon key, service role key)
- [x] ✅ Access Supabase Studio at http://localhost:54323

#### 1.5 Configure Environment Variables
- [x] ✅ Add Supabase credentials to `backend/.env`
- [x] ✅ Add Supabase URL and anon key to `frontend/.env.local`
- [x] ✅ Verify environment variables are in `.gitignore`

#### 1.6 Install Supabase Client in Frontend
- [x] ✅ Install: `cd frontend && npm install @supabase/supabase-js`
- [x] ✅ Create `frontend/src/lib/supabase/client.ts` (browser client)
- [x] ✅ Create `frontend/src/lib/supabase/server.ts` (server components)
- [x] ✅ Create `frontend/src/lib/supabase/middleware.ts` (auth)

**Estimated Time:** 2-3 hours

---

### Phase 2: Database Schema - Item Master

#### 2.1 Create Item Categories Migration
- [x] ✅ Create migration: `001_db_schema_up.sql` and `001_db_schema_down.sql`
- [x] ✅ Write SQL for item_categories table (category_id, category_name, description, parent_category_id, is_active)
- [x] ✅ Create indexes on category_name, is_active
- [x] ✅ Enable RLS and create policies

#### 2.2 Create Items Migration
- [x] ✅ Create migration: `002_db_schema_up.sql` and `002_db_schema_down.sql`
- [x] ✅ Write SQL for items table (item_id, item_code, item_name, description, unit_of_measure, category_id, purchase_price, sales_price, is_active)
- [x] ✅ Add UNIQUE constraint on item_code
- [x] ✅ Add foreign key to item_categories
- [x] ✅ Create indexes on item_code, category_id, is_active
- [x] ✅ Enable RLS and create policies (authenticated users can read, specific roles can write)

#### 2.3 Apply Migrations
- [x] ✅ Apply migrations via Docker psql
- [x] ✅ Verify tables created in database
- [x] ✅ Verify RLS policies, indexes, and constraints

**Estimated Time:** 3-4 hours

---

### Phase 3: Database Schema - Warehouse Management

#### 3.1 Create Warehouses Migration
- [ ] ⬜ Create migration: `supabase migration new create_warehouses`
- [ ] ⬜ Write SQL for warehouses table (warehouse_id, warehouse_code, warehouse_name, address, city, region_state, contact_person, phone, is_active)
- [ ] ⬜ Add UNIQUE constraint on warehouse_code
- [ ] ⬜ Create indexes
- [ ] ⬜ Enable RLS and create policies

#### 3.2 Create Item-Warehouse Junction Migration
- [ ] ⬜ Create migration: `supabase migration new create_item_warehouses`
- [ ] ⬜ Write SQL for item_warehouses table (id, item_id, warehouse_id, current_quantity, reorder_level, reorder_quantity)
- [ ] ⬜ Add UNIQUE constraint on (item_id, warehouse_id)
- [ ] ⬜ Add foreign keys to items and warehouses
- [ ] ⬜ Create indexes
- [ ] ⬜ Enable RLS and create policies

#### 3.3 Apply Migrations & Verify
- [ ] ⬜ Apply migrations with `supabase db reset`
- [ ] ⬜ Verify tables in Supabase Studio

**Estimated Time:** 2-3 hours

---

### Phase 4: Database Schema - Stock Transactions

#### 4.1 Create Transaction Type Enum
- [x] ✅ Used VARCHAR(50) instead of enum for transaction_type field

#### 4.2 Create Stock Transactions Migration
- [x] ✅ Added to existing migration `00001_db_schema_up.sql` (co-located per convention)
- [x] ✅ Created stock_transactions table with UUID primary key, company_id, audit fields
- [x] ✅ Created stock_transaction_items table for line items
- [x] ✅ Created stock_ledger table for immutable event sourcing
- [x] ✅ Added foreign key constraints to companies, users, warehouses, items
- [x] ✅ Created indexes on transaction_date, item_id, warehouse_id, company_id
- [x] ✅ Enabled RLS and created policies

#### 4.3 Create Database Function for Quantity Updates
- [ ] ⬜ Future enhancement: Create function: `update_item_warehouse_quantity()`
  - On stock_in: increase current_quantity
  - On stock_out: decrease current_quantity
  - On transfer: decrease from_warehouse, increase to_warehouse
  - On adjustment: increase or decrease based on quantity sign

#### 4.4 Create Trigger
- [ ] ⬜ Future enhancement: Create trigger on stock_transactions AFTER INSERT
- [ ] ⬜ Future enhancement: Trigger calls `update_item_warehouse_quantity()`

#### 4.5 Apply Migrations & Verify
- [x] ✅ Applied migrations to database
- [x] ✅ Verified tables created successfully (10 tables total)
- [x] ✅ Regenerated TypeScript types with new stock transaction tables
- [x] ✅ Verified table structure and constraints

**Estimated Time:** 4-5 hours | **Actual:** ~2 hours

---

### Phase 5: Seed Data

#### 5.1 Create Seed File
- [x] ✅ Created `backend/supabase/seed.sql` with comprehensive test data
- [x] ✅ Added 1 demo company (Philippines-based)
- [x] ✅ Created system user in auth.users and users tables
- [x] ✅ Added 10 units of measure (including Philippines-specific units: sack, cavan)
- [x] ✅ Added 8 item categories (hierarchical structure)
- [x] ✅ Added 18 items across categories (raw materials, finished goods, services)
- [x] ✅ Added 5 warehouses in Mindanao locations (Davao, CDO, GenSan, Zamboanga, Butuan)
- [x] ✅ Added 72 item_warehouse records with dynamic stock levels using RANDOM()

#### 5.2 Apply Seed Data
- [x] ✅ Applied seed data via Docker psql
- [x] ✅ Verified data in database (10 UoMs, 8 categories, 18 items, 5 warehouses, 72 stock records)
- [x] ✅ Stock levels vary by warehouse type (main: 100-600, retail: 20-120)

**Note:** Stock transactions seed data deferred to Phase 6 (API implementation)

**Estimated Time:** 2 hours | **Actual:** ~2 hours

---

### Phase 6: Frontend Supabase Client Setup

#### 6.1 Create Supabase Client Utilities
- [ ] ⬜ Implement `frontend/src/lib/supabase/client.ts` (createBrowserClient)
- [ ] ⬜ Implement `frontend/src/lib/supabase/server.ts` (createServerClient with cookies)
- [ ] ⬜ Implement `frontend/src/lib/supabase/middleware.ts` (auth middleware)

#### 6.2 Update Environment Variables
- [ ] ⬜ Verify `frontend/.env.local` has NEXT_PUBLIC_SUPABASE_URL
- [ ] ⬜ Verify `frontend/.env.local` has NEXT_PUBLIC_SUPABASE_ANON_KEY
- [ ] ⬜ Test Supabase client connection

**Estimated Time:** 1-2 hours

---

### Phase 7: API Implementation - Items

#### 7.1 Create Items API Routes
- [ ] ⬜ Create `frontend/src/app/api/items/route.ts` (GET all, POST create)
- [ ] ⬜ Implement GET with filters (search, category, is_active)
- [ ] ⬜ Implement POST with validation (check duplicate item_code)
- [ ] ⬜ Create `frontend/src/app/api/items/[id]/route.ts` (GET one, PUT update, DELETE)
- [ ] ⬜ Implement error handling and proper HTTP status codes

#### 7.2 Create Item Categories API Routes
- [ ] ⬜ Create `frontend/src/app/api/item-categories/route.ts` (GET, POST)
- [ ] ⬜ Implement CRUD operations

#### 7.3 Update Frontend API Client
- [ ] ⬜ Update `frontend/src/lib/api/items.ts` to call real API routes
- [ ] ⬜ Remove mock API calls
- [ ] ⬜ Keep existing validation logic

#### 7.4 Test Items Module
- [ ] ⬜ Disable MSW for items endpoints
- [ ] ⬜ Test item list page with real data
- [ ] ⬜ Test create new item
- [ ] ⬜ Test update item
- [ ] ⬜ Test delete item
- [ ] ⬜ Test search and filters

**Estimated Time:** 4-5 hours

---

### Phase 8: API Implementation - Warehouses

#### 8.1 Create Warehouses API Routes
- [ ] ⬜ Create `frontend/src/app/api/warehouses/route.ts` (GET, POST)
- [ ] ⬜ Create `frontend/src/app/api/warehouses/[id]/route.ts` (GET, PUT, DELETE)
- [ ] ⬜ Create `frontend/src/app/api/warehouses/[id]/stock/route.ts` (GET stock levels)
- [ ] ⬜ Implement stock level calculation (join item_warehouses)

#### 8.2 Update Frontend API Client
- [ ] ⬜ Update `frontend/src/lib/api/warehouses.ts`
- [ ] ⬜ Update hooks to use real data

#### 8.3 Test Warehouses Module
- [ ] ⬜ Disable MSW for warehouses endpoints
- [ ] ⬜ Test warehouse CRUD operations
- [ ] ⬜ Test stock level display per warehouse

**Estimated Time:** 3-4 hours

---

### Phase 9: API Implementation - Stock Transactions

#### 9.1 Create Stock Transactions API Routes
- [ ] ⬜ Create `frontend/src/app/api/stock-transactions/route.ts` (GET, POST)
- [ ] ⬜ Implement GET with filters (date range, item, warehouse, transaction_type)
- [ ] ⬜ Implement POST with validation
- [ ] ⬜ Create `frontend/src/app/api/stock-transactions/ledger/route.ts` (item ledger)
- [ ] ⬜ Create `frontend/src/app/api/stock-transactions/transfer/route.ts` (warehouse transfer)

#### 9.2 Implement Business Logic
- [ ] ⬜ Validate transaction types
- [ ] ⬜ Verify warehouse and item exist before transaction
- [ ] ⬜ Check sufficient quantity for stock_out operations
- [ ] ⬜ Handle transfer logic (from/to warehouses)
- [ ] ⬜ Add proper error messages

#### 9.3 Update Frontend API Client
- [ ] ⬜ Update `frontend/src/lib/api/stock-transactions.ts`
- [ ] ⬜ Update hooks to use real data

#### 9.4 Test Stock Transactions
- [ ] ⬜ Disable MSW for stock-transactions endpoints
- [ ] ⬜ Test stock in transaction
- [ ] ⬜ Test stock out transaction
- [ ] ⬜ Test stock transfer between warehouses
- [ ] ⬜ Test stock adjustment
- [ ] ⬜ Verify quantity updates automatically via trigger
- [ ] ⬜ Test transaction ledger view

**Estimated Time:** 5-6 hours

---

### Phase 10: Testing & Documentation

#### 10.1 End-to-End Testing
- [ ] ⬜ Test scenario: Create item → Add to warehouse → Stock in → Verify quantity
- [ ] ⬜ Test scenario: Stock out → Verify quantity decreased
- [ ] ⬜ Test scenario: Transfer between warehouses → Verify both quantities updated
- [ ] ⬜ Test with multiple warehouses and items
- [ ] ⬜ Test error cases (insufficient stock, invalid data, etc.)

#### 10.2 Documentation
- [ ] ⬜ Document backend setup in `backend/README.md`
- [ ] ⬜ Document API endpoints (request/response formats)
- [ ] ⬜ Document database schema and relationships
- [ ] ⬜ Document trigger logic
- [ ] ⬜ Update main README.md with backend setup instructions

#### 10.3 Cleanup
- [ ] ⬜ Remove MSW handlers for inventory module
- [ ] ⬜ Remove mock data files for inventory
- [ ] ⬜ Clean up unused imports and code
- [ ] ⬜ Add comments to complex logic

**Estimated Time:** 3-4 hours

---

**TOTAL ESTIMATED TIME: 30-40 hours (1 week)**

---

## PHASE 1: CORE INVENTORY & SALES MODULES

### 1. INVENTORY DOMAIN

#### 1.1 Item Master

- [ ] ⬜ **Backend: Database Schema**
  - Create `items` table with fields:
    - item_id (UUID, PK)
    - item_code (unique, required)
    - item_name (required)
    - description
    - unit_of_measure (pcs, kg, liter, etc.)
    - category_id (FK)
    - purchase_price
    - sales_price
    - is_active
    - created_by, updated_by
    - created_at, updated_at
  - Create `item_categories` table
  - Create indexes on item_code, category_id, is_active
  - Enable RLS policies

- [ ] ⬜ **Backend: API Endpoints**
  - `GET /api/items` - List items with filters (category, search, active status)
  - `POST /api/items` - Create new item (validate unique item_code)
  - `PUT /api/items/{id}` - Update item
  - `DELETE /api/items/{id}` - Soft delete / deactivate item
  - `GET /api/items/{id}` - Get item details
  - `GET /api/item-categories` - List categories

- [ ] ⬜ **Frontend: Item Management UI**
  - Create item list page (`/inventory/items`)
  - Create item form (create/edit)
  - Add search and filter functionality
  - Add category management
  - Implement duplicate item code validation
  - Add active/inactive toggle

**Dependencies:** None (foundation)
**Estimated Time:** 16 hours

#### 1.2 Warehouse Management

- [ ] ⬜ **Backend: Database Schema**
  - Create `warehouses` table with fields:
    - warehouse_id (UUID, PK)
    - warehouse_code (unique)
    - warehouse_name
    - address (standardized Philippines Mindanao format)
    - city
    - region_state
    - contact_person
    - phone
    - is_active
    - created_at, updated_at
  - Create `item_warehouses` junction table (item_id, warehouse_id, current_quantity)
  - Create indexes

- [ ] ⬜ **Backend: API Endpoints**
  - `GET /api/warehouses` - List warehouses
  - `POST /api/warehouses` - Create warehouse
  - `PUT /api/warehouses/{id}` - Update warehouse
  - `GET /api/warehouses/{id}/stock` - Get stock levels per warehouse
  - `GET /api/items/{id}/warehouses` - Get item availability across warehouses

- [ ] ⬜ **Frontend: Warehouse Management UI**
  - Create warehouse list page (`/inventory/warehouses`)
  - Create warehouse form
  - Add stock view per warehouse
  - Implement warehouse selector in stock transactions

**Dependencies:** Item Master
**Estimated Time:** 12 hours

#### 1.3 Stock Transactions

- [ ] ⬜ **Backend: Database Schema**
  - Create `stock_transactions` table:
    - transaction_id (UUID, PK)
    - transaction_type (stock_in, stock_out, transfer, adjustment)
    - transaction_date
    - reference_number (PO, SO, Adjustment #)
    - item_id (FK)
    - warehouse_id (FK)
    - from_warehouse_id (FK, for transfers)
    - quantity
    - unit_cost
    - reason_code
    - remarks
    - created_by
    - created_at
  - Create trigger to update item_warehouses.current_quantity
  - Create indexes on transaction_date, item_id, warehouse_id

- [ ] ⬜ **Backend: API Endpoints**
  - `POST /api/stock-transactions` - Record transaction (with auto quantity update)
  - `GET /api/stock-transactions` - List transactions with filters
  - `GET /api/stock-transactions/ledger` - Item transaction ledger
  - `POST /api/stock-transactions/transfer` - Transfer between warehouses

- [ ] ⬜ **Frontend: Stock Transaction UI**
  - Create stock in form
  - Create stock out form
  - Create stock transfer form
  - Create stock adjustment form
  - Create transaction ledger view
  - Add filtering by date, item, warehouse

**Dependencies:** Item Master, Warehouse Management
**Estimated Time:** 20 hours

#### 1.4 Reorder Management

- [ ] ⬜ **Backend: Database Schema**
  - Add columns to `item_warehouses` table:
    - reorder_level
    - reorder_quantity
  - Create `reorder_alerts` table:
    - alert_id
    - item_id
    - warehouse_id
    - current_quantity
    - reorder_level
    - alert_status (pending, acknowledged, ordered)
    - created_at

- [ ] ⬜ **Backend: Business Logic**
  - Create function to check reorder levels
  - Create trigger on stock transaction to generate alerts
  - Create API endpoint: `GET /api/reorder-alerts`

- [ ] ⬜ **Frontend: Reorder Management UI**
  - Create reorder alerts dashboard
  - Add reorder level configuration in item/warehouse form
  - Create reorder report (exportable)
  - Add notification badge for pending alerts

**Dependencies:** Stock Transactions
**Estimated Time:** 10 hours

#### 1.5 Inventory Valuation

- [ ] ⬜ **Backend: Database Schema**
  - Create `valuation_settings` table (method: FIFO/LIFO/Average)
  - Create `stock_valuation_history` table:
    - valuation_id
    - item_id
    - warehouse_id
    - valuation_date
    - quantity
    - unit_cost
    - total_value
    - valuation_method

- [ ] ⬜ **Backend: Business Logic**
  - Implement FIFO valuation calculation
  - Implement Average Cost valuation
  - Create valuation report generation function
  - API: `GET /api/inventory/valuation`

- [ ] ⬜ **Frontend: Valuation Reports**
  - Create valuation report page
  - Add date range selector
  - Add warehouse filter
  - Add export to Excel/PDF

**Dependencies:** Stock Transactions
**Estimated Time:** 14 hours

#### 1.6 Batch / Serial Tracking (Optional - Future Phase)

- [ ] ⬜ Backend: Batch tracking tables
- [ ] ⬜ Backend: Serial number tracking
- [ ] ⬜ Frontend: Batch/serial UI

**Dependencies:** Stock Transactions
**Estimated Time:** TBD (Future Phase)

#### 1.7 Recipe / BOM (Optional - Future Phase)

- [ ] ⬜ Backend: BOM tables
- [ ] ⬜ Backend: Component deduction logic
- [ ] ⬜ Frontend: BOM management UI

**Dependencies:** Stock Transactions
**Estimated Time:** TBD (Future Phase)

---

### 2. SALES DOMAIN

#### 2.1 Customer Master

- [ ] ⬜ **Backend: Database Schema**
  - Create `customers` table:
    - customer_id (UUID, PK)
    - customer_code (unique)
    - customer_name
    - tax_id
    - billing_address (Philippines Mindanao format)
    - billing_city
    - billing_region_state
    - shipping_address
    - shipping_city
    - shipping_region_state
    - contact_person
    - phone
    - email
    - payment_terms (net_30, net_60, cod, etc.)
    - credit_limit
    - is_active
    - created_at, updated_at
  - Create indexes

- [ ] ⬜ **Backend: API Endpoints**
  - `GET /api/customers` - List customers with filters
  - `POST /api/customers` - Create customer (validate unique code)
  - `PUT /api/customers/{id}` - Update customer
  - `GET /api/customers/{id}` - Get customer details
  - `GET /api/customers/{id}/balance` - Get outstanding balance

- [ ] ⬜ **Frontend: Customer Management UI**
  - Create customer list page (`/sales/customers`)
  - Create customer form (create/edit)
  - Add search and filter
  - Add customer detail view
  - Show outstanding balance

**Dependencies:** None (foundation)
**Estimated Time:** 14 hours

#### 2.2 Price List & Discounts

- [ ] ⬜ **Backend: Database Schema**
  - Create `price_lists` table:
    - price_list_id
    - price_list_name
    - valid_from
    - valid_to
    - is_default
  - Create `price_list_items` table:
    - price_list_id (FK)
    - item_id (FK)
    - unit_price
  - Create `customer_price_lists` table (assign price list to customer/group)
  - Create `discount_rules` table

- [ ] ⬜ **Backend: API Endpoints**
  - `GET /api/price-lists` - List price lists
  - `POST /api/price-lists` - Create price list
  - `GET /api/price-lists/{id}/items` - Get items in price list
  - `POST /api/price-lists/{id}/items` - Add items to price list
  - `GET /api/customers/{id}/price` - Get effective price for customer

- [ ] ⬜ **Frontend: Price List Management UI**
  - Create price list page
  - Create price list form
  - Add bulk price import
  - Add customer price list assignment

**Dependencies:** Item Master, Customer Master
**Estimated Time:** 12 hours

#### 2.3 Sales Quotation

- [ ] ⬜ **Backend: Database Schema**
  - Create `sales_quotations` table:
    - quotation_id (UUID, PK)
    - quotation_number (auto-generated)
    - customer_id (FK)
    - quotation_date
    - valid_until
    - status (draft, sent, accepted, rejected)
    - subtotal
    - discount_amount
    - tax_amount
    - total_amount
    - remarks
    - created_by, updated_by
    - created_at, updated_at
  - Create `sales_quotation_items` table

- [ ] ⬜ **Backend: API Endpoints**
  - `GET /api/quotations` - List quotations
  - `POST /api/quotations` - Create quotation
  - `PUT /api/quotations/{id}` - Update quotation
  - `POST /api/quotations/{id}/convert-to-order` - Convert to sales order
  - `GET /api/quotations/{id}/pdf` - Generate PDF

- [ ] ⬜ **Frontend: Quotation Management UI**
  - Create quotation list page (`/sales/quotations`)
  - Create quotation form
  - Add item line entry
  - Add print/email functionality
  - Add convert to order button
  - Add status tracking

**Dependencies:** Customer Master, Item Master, Price List
**Estimated Time:** 16 hours

#### 2.4 Sales Order

- [ ] ⬜ **Backend: Database Schema**
  - Create `sales_orders` table:
    - order_id (UUID, PK)
    - order_number (auto-generated)
    - quotation_id (FK, nullable)
    - customer_id (FK)
    - order_date
    - delivery_date
    - status (draft, confirmed, delivered, invoiced, closed)
    - warehouse_id (fulfillment warehouse)
    - subtotal
    - discount_amount
    - tax_amount
    - total_amount
    - remarks
    - created_by, updated_by
    - created_at, updated_at
  - Create `sales_order_items` table:
    - order_item_id
    - order_id (FK)
    - item_id (FK)
    - quantity
    - unit_price
    - discount_percent
    - line_total
    - delivered_quantity
    - invoiced_quantity

- [ ] ⬜ **Backend: Business Logic**
  - Implement stock reservation on order confirmation
  - Implement partial delivery tracking
  - Implement partial invoicing tracking
  - Auto-update order status based on delivery/invoice status

- [ ] ⬜ **Backend: API Endpoints**
  - `GET /api/orders` - List orders with filters
  - `POST /api/orders` - Create order
  - `PUT /api/orders/{id}` - Update order
  - `POST /api/orders/{id}/confirm` - Confirm order (reserve stock)
  - `GET /api/orders/{id}/delivery-status` - Check delivery progress
  - `POST /api/orders/from-quotation/{quotationId}` - Create from quotation

- [ ] ⬜ **Frontend: Sales Order UI**
  - Create order list page (`/sales/orders`)
  - Create order form
  - Add item line entry with stock availability check
  - Add order confirmation flow
  - Add status indicators
  - Add partial fulfillment tracking

**Dependencies:** Customer Master, Item Master, Warehouse Management
**Estimated Time:** 20 hours

#### 2.5 Delivery Note

- [ ] ⬜ **Backend: Database Schema**
  - Create `delivery_notes` table:
    - delivery_id (UUID, PK)
    - delivery_number (auto-generated)
    - order_id (FK)
    - customer_id (FK)
    - warehouse_id (FK)
    - delivery_date
    - status (draft, delivered, verified)
    - delivered_by
    - received_by
    - signature_data
    - remarks
    - created_at, updated_at
  - Create `delivery_note_items` table:
    - delivery_item_id
    - delivery_id (FK)
    - order_item_id (FK)
    - item_id (FK)
    - quantity_ordered
    - quantity_delivered
    - unit_price

- [ ] ⬜ **Backend: Business Logic**
  - Create stock transaction (stock out) on delivery confirmation
  - Update sales_order_items.delivered_quantity
  - Auto-update order status if fully delivered
  - Trigger to update item_warehouses quantity

- [ ] ⬜ **Backend: API Endpoints**
  - `GET /api/deliveries` - List deliveries
  - `POST /api/deliveries` - Create delivery from order
  - `PUT /api/deliveries/{id}` - Update delivery
  - `POST /api/deliveries/{id}/confirm` - Confirm delivery (stock out)
  - `GET /api/deliveries/{id}/pdf` - Print delivery note

- [ ] ⬜ **Frontend: Delivery Note UI**
  - Create delivery list page (`/sales/deliveries`)
  - Create delivery form from order
  - Add partial delivery support
  - Add print delivery note
  - Add customer signature capture
  - Add delivery confirmation flow

**Dependencies:** Sales Order, Stock Transactions
**Estimated Time:** 18 hours

#### 2.6 Sales Invoice

- [ ] ⬜ **Backend: Database Schema**
  - Create `sales_invoices` table:
    - invoice_id (UUID, PK)
    - invoice_number (auto-generated series)
    - order_id (FK)
    - delivery_id (FK, nullable)
    - customer_id (FK)
    - invoice_date
    - due_date
    - status (draft, confirmed, paid, cancelled)
    - subtotal
    - discount_amount
    - tax_amount
    - shipping_charges
    - total_amount
    - paid_amount
    - balance_due
    - payment_status (unpaid, partial, paid)
    - primary_employee_id (FK to employees) - for Phase 2
    - commission_total - for Phase 2
    - commission_split_count - for Phase 2
    - remarks
    - created_by, updated_by
    - created_at, updated_at
  - Create `sales_invoice_items` table

- [ ] ⬜ **Backend: Business Logic**
  - Auto-generate invoice number from series
  - Calculate taxes based on configuration
  - Apply discounts and shipping charges
  - Update sales_order_items.invoiced_quantity
  - Auto-update order status if fully invoiced

- [ ] ⬜ **Backend: API Endpoints**
  - `GET /api/invoices` - List invoices with filters
  - `POST /api/invoices` - Create invoice from order/delivery
  - `PUT /api/invoices/{id}` - Update invoice
  - `POST /api/invoices/{id}/confirm` - Confirm invoice
  - `GET /api/invoices/{id}/pdf` - Generate PDF
  - `GET /api/invoices/{id}/email` - Email invoice

- [ ] ⬜ **Frontend: Sales Invoice UI**
  - Create invoice list page (`/sales/invoices`)
  - Create invoice form from order/delivery
  - Add tax and discount calculations
  - Add print invoice
  - Add email invoice
  - Add payment status indicator

**Dependencies:** Sales Order, Delivery Note
**Estimated Time:** 18 hours

#### 2.7 Payment Collection

- [ ] ⬜ **Backend: Database Schema**
  - Create `payments` table:
    - payment_id (UUID, PK)
    - payment_number (auto-generated)
    - customer_id (FK)
    - payment_date
    - payment_mode (cash, bank_transfer, cheque, online, etc.)
    - amount
    - reference_number
    - remarks
    - created_by
    - created_at
  - Create `payment_allocations` table:
    - allocation_id
    - payment_id (FK)
    - invoice_id (FK)
    - allocated_amount

- [ ] ⬜ **Backend: Business Logic**
  - Update invoice paid_amount and balance_due
  - Update invoice payment_status (unpaid/partial/paid)
  - Handle over-payment (customer credit)
  - Calculate customer outstanding balance

- [ ] ⬜ **Backend: API Endpoints**
  - `GET /api/payments` - List payments
  - `POST /api/payments` - Record payment
  - `GET /api/customers/{id}/outstanding` - Get outstanding balance
  - `GET /api/invoices/{id}/payments` - Get payments for invoice

- [ ] ⬜ **Frontend: Payment Collection UI**
  - Create payment list page (`/sales/payments`)
  - Create payment form
  - Add invoice allocation
  - Add payment mode selector
  - Show customer outstanding balance
  - Add payment receipt print

**Dependencies:** Sales Invoice
**Estimated Time:** 14 hours

#### 2.8 Sales Returns / Credit Notes

- [ ] ⬜ **Backend: Database Schema**
  - Create `sales_returns` table:
    - return_id (UUID, PK)
    - return_number (auto-generated)
    - invoice_id (FK)
    - delivery_id (FK, nullable)
    - customer_id (FK)
    - return_date
    - status (draft, approved, rejected)
    - reason
    - approved_by
    - remarks
    - created_at, updated_at
  - Create `sales_return_items` table
  - Create `credit_notes` table

- [ ] ⬜ **Backend: Business Logic**
  - Create stock transaction (stock in) on return approval
  - Generate credit note automatically
  - Update customer balance
  - Reverse invoice allocation

- [ ] ⬜ **Backend: API Endpoints**
  - `GET /api/returns` - List returns
  - `POST /api/returns` - Create return
  - `POST /api/returns/{id}/approve` - Approve return (stock in + credit note)
  - `GET /api/credit-notes` - List credit notes

- [ ] ⬜ **Frontend: Sales Returns UI**
  - Create returns list page (`/sales/returns`)
  - Create return form
  - Add approval workflow
  - Add reason codes
  - Show credit note generation

**Dependencies:** Sales Invoice, Delivery Note, Stock Transactions
**Estimated Time:** 16 hours

---

### 3. CROSS-MODULE & ADMIN

#### 3.1 User Management

- [ ] ⬜ **Backend: Database Schema**
  - Create `users` table (if not using Supabase Auth):
    - user_id (UUID, PK)
    - email (unique)
    - full_name
    - role (admin, sales_officer, inventory_officer, approver, viewer)
    - is_active
    - last_login
    - created_at, updated_at
  - Create `role_permissions` table
  - Create `user_sessions` table

- [ ] ⬜ **Backend: Authentication & Authorization**
  - Implement login/logout
  - Implement JWT token handling
  - Implement role-based middleware
  - Implement permission checking

- [ ] ⬜ **Backend: API Endpoints**
  - `POST /api/auth/login` - User login
  - `POST /api/auth/logout` - User logout
  - `GET /api/users` - List users (admin only)
  - `POST /api/users` - Create user (admin only)
  - `PUT /api/users/{id}` - Update user
  - `PUT /api/users/{id}/role` - Change user role

- [ ] ⬜ **Frontend: User Management UI**
  - Create login page
  - Create user list page (`/settings/users`)
  - Create user form
  - Add role selector
  - Add password reset
  - Implement protected routes

**Dependencies:** None (foundation)
**Estimated Time:** 16 hours

#### 3.2 Audit Logs

- [ ] ⬜ **Backend: Database Schema**
  - Create `audit_logs` table:
    - log_id (UUID, PK)
    - user_id (FK)
    - module (inventory, sales, admin)
    - action (create, update, delete)
    - entity_type (item, order, invoice, etc.)
    - entity_id
    - old_values (JSONB)
    - new_values (JSONB)
    - ip_address
    - created_at
  - Create indexes on user_id, module, created_at

- [ ] ⬜ **Backend: Audit Trigger Functions**
  - Create trigger for items table
  - Create trigger for orders table
  - Create trigger for invoices table
  - Create trigger for all critical tables

- [ ] ⬜ **Backend: API Endpoints**
  - `GET /api/audit-logs` - List logs with filters
  - `GET /api/audit-logs/entity/{type}/{id}` - Get logs for specific entity

- [ ] ⬜ **Frontend: Audit Logs UI**
  - Create audit log viewer page (`/settings/audit-logs`)
  - Add filters (user, module, date range)
  - Add entity detail view
  - Show old vs new values comparison

**Dependencies:** User Management
**Estimated Time:** 12 hours

#### 3.3 Alerts & Notifications

- [ ] ⬜ **Backend: Database Schema**
  - Create `notifications` table:
    - notification_id (UUID, PK)
    - user_id (FK)
    - notification_type (low_stock, overdue_payment, pending_approval)
    - title
    - message
    - entity_type
    - entity_id
    - is_read
    - created_at
  - Create `notification_preferences` table

- [ ] ⬜ **Backend: Notification Triggers**
  - Low stock alert trigger
  - Overdue payment alert (scheduled job)
  - Pending approval alert
  - Reorder level alert

- [ ] ⬜ **Backend: API Endpoints**
  - `GET /api/notifications` - Get user notifications
  - `PUT /api/notifications/{id}/read` - Mark as read
  - `PUT /api/notifications/read-all` - Mark all as read
  - `GET /api/notifications/preferences` - Get notification settings

- [ ] ⬜ **Frontend: Notifications UI**
  - Add notification bell icon in header
  - Add notification dropdown
  - Add notification settings page
  - Add real-time notification updates (optional: WebSocket)

**Dependencies:** User Management, Reorder Management
**Estimated Time:** 12 hours

---

### 4. REPORTING & ANALYTICS (BASIC - PHASE 1)

#### 4.1 Inventory Reports

- [ ] ⬜ **Backend: Report API Endpoints**
  - `GET /api/reports/inventory/stock-on-hand` - Current stock by warehouse
  - `GET /api/reports/inventory/reorder-list` - Items below reorder level
  - `GET /api/reports/inventory/valuation` - Stock valuation report
  - `GET /api/reports/inventory/movements` - Stock movement history

- [ ] ⬜ **Frontend: Inventory Reports UI**
  - Create stock on hand report page
  - Create reorder report page
  - Create valuation report page
  - Create stock movement report page
  - Add export to Excel/PDF

**Dependencies:** Stock Transactions, Inventory Valuation
**Estimated Time:** 10 hours

#### 4.2 Sales Reports

- [ ] ⬜ **Backend: Report API Endpoints**
  - `GET /api/reports/sales/summary` - Sales summary by date/product/customer
  - `GET /api/reports/sales/unpaid-invoices` - Outstanding invoices
  - `GET /api/reports/sales/overdue-payments` - Overdue payments
  - `GET /api/reports/sales/performance` - Sales performance dashboard data

- [ ] ⬜ **Frontend: Sales Reports UI**
  - Create sales summary report page
  - Create unpaid invoices report
  - Create overdue payments report
  - Create sales performance dashboard
  - Add charts (revenue trend, top items, top customers)
  - Add export to Excel/PDF

**Dependencies:** Sales Invoice, Payment Collection
**Estimated Time:** 12 hours

---

## PHASE 2: SALES ANALYTICS MODULE

### Phase 2.1: Foundation & Data Cleanup (Week 1)

#### Backend - Database Schema

- [ ] ⬜ Create `employees` table with all fields
  - employee_id (UUID)
  - employee_code (unique)
  - full_name
  - email
  - phone
  - role (admin, manager, sales_agent)
  - commission_rate (default 5%)
  - is_active
  - created_at, updated_at

- [ ] ⬜ Create `employee_distribution_locations` table
  - id (UUID)
  - employee_id (FK)
  - city
  - region_state
  - is_primary
  - created_at

- [ ] ⬜ Create `invoice_employees` table (commission split)
  - id (UUID)
  - invoice_id (FK)
  - employee_id (FK)
  - split_percentage (default 100%)
  - commission_amount
  - is_primary
  - created_at

- [ ] ⬜ Create `sales_distribution` table (aggregated analytics)
  - id (UUID)
  - date
  - employee_id (FK, nullable)
  - city (nullable)
  - region_state (nullable)
  - total_sales
  - total_commission
  - transaction_count
  - unique_customers
  - created_at, updated_at

- [ ] ⬜ Add columns to `sales_invoices` table:
  - `primary_employee_id` (FK to employees)
  - `commission_total`
  - `commission_split_count`

- [ ] ⬜ Create indexes for all new tables
  - employees: employee_code, email, role, is_active
  - employee_distribution_locations: employee_id, city, region_state
  - invoice_employees: invoice_id, employee_id
  - sales_distribution: date, employee_id, city, region_state

- [ ] ⬜ Enable RLS policies for new tables

- [ ] ⬜ Create analytics views:
  - `vw_sales_by_employee`
  - `vw_sales_by_location`
  - `vw_employee_commission_summary`

**Estimated Time:** 8 hours

#### Data Migration & Cleanup

- [ ] ⬜ Create Philippines address reference data (Mindanao cities/regions)
  - Davao Region: Davao City, Tagum, Panabo, Digos, Mati
  - Northern Mindanao: Cagayan de Oro, Iligan, Valencia, Malaybalay
  - SOCCSKSARGEN: General Santos, Koronadal, Tacurong, Kidapawan
  - Zamboanga Peninsula: Zamboanga City, Pagadian, Dipolog
  - Caraga: Butuan, Surigao City, Tandag, Bislig
  - BARMM: Cotabato City, Marawi

- [ ] ⬜ Update `companies` table addresses
  - Standardize to Philippines Mindanao format
  - Set city and region_state fields

- [ ] ⬜ Update `warehouses` table addresses
  - Standardize to Philippines Mindanao format
  - Set city and region_state fields

- [ ] ⬜ Update `customers` table addresses (billing & shipping)
  - Standardize to Philippines Mindanao format
  - Set city and region_state fields for both billing and shipping

- [ ] ⬜ Create sample employees (5-10 sales agents)
  - Mix of roles: 1 admin, 2 managers, 7 sales agents
  - Assign realistic commission rates (3%-7%)
  - Set up contact information

- [ ] ⬜ Assign territories to employees
  - Each sales agent gets 1-3 cities
  - Managers get full regions
  - Mark primary territories

- [ ] ⬜ Historical backfill: Assign employees to existing invoices
  - Match invoices to territories based on customer location
  - Set primary employee for each invoice
  - Calculate split percentages if multiple agents

- [ ] ⬜ Calculate historical commissions
  - Apply commission rates to historical invoices
  - Populate invoice_employees table
  - Calculate commission_total for each invoice

- [ ] ⬜ Populate `sales_distribution` table with historical data
  - Aggregate by date, employee, and location
  - Calculate daily totals, transaction counts, unique customers
  - Backfill last 90 days of data

**Estimated Time:** 12 hours

#### Backend - Business Logic

- [ ] ⬜ Implement commission calculation function
  - Input: invoice_id, employee_id[], split_percentages[]
  - Calculate commission based on invoice total and employee rates
  - Handle equal split vs custom percentage split
  - Validate split percentages sum to 100%

- [ ] ⬜ Implement invoice-employee association logic
  - Triggered on invoice confirmation
  - Auto-assign employee based on customer territory
  - Support manual employee assignment/override
  - Create invoice_employees records

- [ ] ⬜ Implement `sales_distribution` aggregation trigger/function
  - Triggered on invoice confirmation/update/cancellation
  - Update daily aggregates for affected date/employee/location
  - Recalculate totals, counts, averages
  - Handle timezone considerations

- [ ] ⬜ Add validation for commission split percentages (must sum to 100%)
  - Server-side validation
  - Return clear error messages
  - Support edge cases (single employee = 100%)

- [ ] ⬜ Implement location resolution logic
  - Priority: employee territory → customer address → default
  - Handle multiple territory assignments (use primary)
  - Fallback to company default location if no match

**Estimated Time:** 10 hours

---

### Phase 2.2: Core Analytics API & UI (Week 2-3)

#### Backend - API Endpoints

- [ ] ⬜ `GET /api/employees` - List employees with filters
  - Query params: role, is_active, search
  - Return: employees with territory count, total sales
  - Pagination support

- [ ] ⬜ `POST /api/employees` - Create new employee
  - Validate email uniqueness
  - Auto-generate employee_code
  - Set default commission rate

- [ ] ⬜ `PUT /api/employees/{id}` - Update employee
  - Allow updating commission rate (admin/manager only)
  - Update profile information
  - Activate/deactivate employee

- [ ] ⬜ `GET /api/employees/{id}/territories` - Get assigned territories
  - Return list of cities/regions
  - Include sales statistics per territory

- [ ] ⬜ `POST /api/employees/{id}/territories` - Assign territory
  - Validate city/region exists
  - Handle primary territory flag
  - Prevent duplicate assignments

- [ ] ⬜ `DELETE /api/employees/{id}/territories/{territoryId}` - Remove territory
  - Soft delete or hard delete
  - Prevent removing last territory

- [ ] ⬜ `GET /api/analytics/sales/overview` - Summary KPIs
  - Query params: date_from, date_to, employee_id, city, region
  - Return: total_sales, total_commission, active_agents, avg_order_value
  - Include period comparison (vs previous period)
  - Include trend data (last 30 days)

- [ ] ⬜ `GET /api/analytics/sales/by-day` - Daily breakdown
  - Query params: date_from, date_to, employee_id, city, region, granularity (daily/weekly/monthly)
  - Return: array of {date, sales, transactions, avg_order, commission}
  - Support sorting and pagination

- [ ] ⬜ `GET /api/analytics/sales/by-employee` - Employee performance
  - Query params: date_from, date_to, city, region, limit
  - Return: array of employees with sales, commission, transactions, avg_order
  - Include rank calculation
  - Include territory information

- [ ] ⬜ `GET /api/analytics/sales/by-location` - Location breakdown
  - Query params: date_from, date_to, employee_id, group_by (city/region)
  - Return: array of locations with sales, transactions, unique_customers
  - Include top employee per location

- [ ] ⬜ `GET /api/analytics/sales/employee/{id}` - Employee details
  - Return: employee profile, total sales, commission, transactions
  - Include daily/monthly breakdown
  - Include customer list

- [ ] ⬜ `GET /api/analytics/sales/trends` - Time series with comparison
  - Query params: date_from, date_to, compare_to (previous_period/previous_year)
  - Return: current period data + comparison period data
  - Calculate growth percentages

**Estimated Time:** 20 hours

#### Frontend - Dashboard Widgets

- [x] ✅ Create "Today's Sales" KPI card
  - **Status:** Removed per user request (redundant)

- [x] ✅ Create "My Sales" KPI card (for sales agents)
  - **Status:** Removed per user request

- [x] ✅ Create "Top Agent" KPI card
  - Shows #1 performer for current month
  - **Status:** Completed

- [x] ✅ Create "Recent Sales Activity" widget
  - Last 10 transactions
  - **Status:** Completed

- [ ] ⬜ Implement role-based rendering
  - Show "My Sales" only for sales agents
  - Show full analytics for managers/admin
  - Hide sensitive data based on role

**Estimated Time:** 12 hours | **Actual:** ~6 hours

#### Frontend - Analytics Page

- [x] ✅ Create main analytics page structure (`/reports/sales-analytics`)
  - Layout with header, filters, tabs
  - **Status:** Completed

- [x] ✅ Implement date range picker with presets
  - 7 presets + dual-month calendar
  - **Status:** Completed

- [x] ✅ Add employee/city/region filters
  - Dropdown selects with reset functionality
  - **Status:** Completed

- [x] ✅ Create tab navigation (4 tabs)
  - **Status:** Completed

- [x] ✅ **Overview Tab**
  - 4 KPI cards, trend chart, top agents/locations
  - **Status:** Completed with Recharts

- [x] ✅ **By Time Tab**
  - Time series chart, data table with pagination (10/page)
  - **Status:** Completed

- [x] ✅ **By Employee Tab**
  - Leaderboard with rank badges, bar + pie charts, pagination (10/page)
  - **Status:** Completed

- [x] ✅ **By Location Tab**
  - Location table, bar + pie charts, pagination (10/page)
  - **Status:** Completed

**Estimated Time:** 50 hours | **Actual:** ~8 hours (using mock data)

---

### Phase 2.3: Advanced Features (Week 4)

#### Commission Dashboard for Agents

- [ ] ⬜ Create commission dashboard page (`/sales/my-commission`)
  - Monthly commission summary
  - Commission breakdown by invoice
  - YTD commission total
  - Pending vs paid status (future: payroll integration)

- [ ] ⬜ Add commission details modal
  - Show invoice details
  - Show commission calculation breakdown
  - Show split percentages if multiple agents

**Estimated Time:** 8 hours

#### Commission Display on Invoice Forms

- [ ] ⬜ Add employee assignment field to invoice form
  - Dropdown to select primary employee
  - Auto-populate based on customer territory
  - Allow manual override

- [ ] ⬜ Add commission split section
  - Multi-select employees
  - Input split percentages
  - Real-time validation (must sum to 100%)
  - Show commission amount preview per employee

- [ ] ⬜ Display commission on invoice view
  - Show assigned employees
  - Show commission breakdown
  - Show split percentages

**Estimated Time:** 10 hours

#### Employee Management Page

- [ ] ⬜ Create employee list page (`/settings/employees`)
  - Data table with search and filters
  - Columns: Name, Code, Role, Commission Rate, Territories, Status
  - Actions: View, Edit, Activate/Deactivate

- [ ] ⬜ Create employee form (create/edit)
  - Employee information fields
  - Commission rate input
  - Role selector
  - Active status toggle
  - Form validation

- [ ] ⬜ Create employee detail page
  - Employee profile
  - Assigned territories list
  - Sales performance summary
  - Commission history

**Estimated Time:** 12 hours

#### Territory Assignment UI

- [ ] ⬜ Add territory management section to employee form
  - City/region selector
  - Add/remove territories
  - Set primary territory
  - Bulk territory assignment

- [ ] ⬜ Create territory overview page (`/settings/territories`)
  - List view: Territory → Assigned Employees
  - Unassigned territories highlight
  - Territory performance metrics

**Estimated Time:** 8 hours

#### Export Functionality

- [ ] ⬜ Implement Excel export
  - Multi-sheet workbook (Summary, Detailed data, Charts)
  - Apply current filters
  - Format cells (currency, dates, percentages)

- [ ] ⬜ Implement PDF export
  - Formatted report with header/footer
  - Include charts and data tables
  - Print-friendly layout

**Estimated Time:** 12 hours

#### Role-Based Access Control Implementation

- [ ] ⬜ Implement role-based page access
  - Admin: Full access
  - Manager: Team analytics and management
  - Sales Agent: Personal dashboard only

- [ ] ⬜ Implement role-based data filtering
  - Apply filters at API level

- [ ] ⬜ Implement role-based UI elements
  - Hide/show buttons based on permissions

**Estimated Time:** 8 hours

#### Manager vs Agent View Differentiation

- [ ] ⬜ Create agent personal dashboard
  - My daily/weekly/monthly sales
  - My commission summary
  - My recent transactions

- [ ] ⬜ Create manager team dashboard
  - Team performance overview
  - Team leaderboard
  - Territory coverage view

- [ ] ⬜ Implement dashboard routing
  - Auto-redirect based on role

**Estimated Time:** 10 hours

---

## TESTING & DOCUMENTATION

### Backend Testing

- [ ] ⬜ Unit tests for inventory logic (valuation, stock transactions)
- [ ] ⬜ Unit tests for sales logic (order status, invoice calculations)
- [ ] ⬜ Unit tests for commission calculation
- [ ] ⬜ Integration tests for all API endpoints
- [ ] ⬜ Performance tests (large datasets)

**Estimated Time:** 20 hours

### Frontend Testing

- [ ] ⬜ Component tests for all forms
- [ ] ⬜ Component tests for all reports/dashboards
- [ ] ⬜ Integration tests for user flows
- [ ] ⬜ E2E tests for critical paths

**Estimated Time:** 16 hours

### Documentation

- [ ] ⬜ API documentation (all endpoints)
- [ ] ⬜ User guides (by role)
- [ ] ⬜ Database schema documentation
- [ ] ⬜ Deployment guide

**Estimated Time:** 12 hours

---

## FUTURE PHASES (Out of Current Scope)

### Procurement Module

- [ ] ⬜ Supplier Master
- [ ] ⬜ Purchase Requisition
- [ ] ⬜ Purchase Order
- [ ] ⬜ Goods Receipt
- [ ] ⬜ Purchase Invoice
- [ ] ⬜ Supplier Payments

### Accounting / Finance Module

- [ ] ⬜ Chart of Accounts
- [ ] ⬜ Journal Entries
- [ ] ⬜ General Ledger
- [ ] ⬜ Accounts Payable
- [ ] ⬜ Accounts Receivable
- [ ] ⬜ Financial Reports

### Manufacturing Module

- [ ] ⬜ Production Planning
- [ ] ⬜ Work Orders
- [ ] ⬜ BOM Management
- [ ] ⬜ Production Tracking

### HR & Payroll Module

- [ ] ⬜ Employee Management
- [ ] ⬜ Attendance & Timekeeping
- [ ] ⬜ Payroll Processing
- [ ] ⬜ Commission Payment Integration

### CRM Module

- [ ] ⬜ Lead Management
- [ ] ⬜ Opportunity Tracking
- [ ] ⬜ Customer Communication
- [ ] ⬜ Sales Pipeline

---

## TOTAL ESTIMATED TIME

**Phase 1: Core Inventory & Sales**
- Inventory Domain: ~72 hours
- Sales Domain: ~116 hours
- Cross-Module & Admin: ~40 hours
- Basic Reporting: ~22 hours
- **Subtotal: ~250 hours (~6-7 weeks)**

**Phase 2: Sales Analytics Module**
- Phase 2.1: 30 hours (1 week)
- Phase 2.2: 82 hours (2 weeks)
- Phase 2.3: 58 hours (1.5 weeks)
- **Subtotal: ~170 hours (~4-5 weeks)**

**Testing & Documentation:** ~48 hours (1 week)

**GRAND TOTAL: ~468 hours (~12 weeks / 3 months)**

---

## NOTES

- All currency amounts use **Philippine Peso (₱)** symbol
- All addresses standardized to **Philippines Mindanao** locations
- All tables use **pagination (10 items per page)**
- Tables do **not use Card wrappers** (clean layout)
- Charts use **Recharts** library
- Date pickers have **7 presets**
- Frontend currently uses **mock data** until backend is implemented
- **Next.js 15** with App Router
- **Supabase** for backend (PostgreSQL + Auth)
- **TypeScript** for type safety
