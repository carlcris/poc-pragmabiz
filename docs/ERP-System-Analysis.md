# ERP System Analysis

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Modules & Features](#modules--features)
3. [Database Schema & Entities](#database-schema--entities)
4. [Existing Reports & Analytics](#existing-reports--analytics)
5. [Technology Stack](#technology-stack)
6. [Business Logic & Workflows](#business-logic--workflows)
7. [Key Architectural Features](#key-architectural-features)
8. [Configuration & Extensibility](#configuration--extensibility)

---

## Executive Summary

This is a **comprehensive, production-grade ERP system** featuring:

- **Multi-module coverage** across inventory, sales, purchasing, logistics, manufacturing, and accounting
- **Advanced workflows** with multi-step document approval processes
- **Sophisticated analytics** covering sales performance, commissions, and stock management
- **Enterprise-level architecture** with RBAC, multi-company/BU support, and security
- **Real-time capabilities** for live inventory and logistics tracking
- **Modern tech stack** using Next.js 15, React Query, TypeScript, and PostgreSQL
- **~45 database entities** with comprehensive relationships and business logic

The system is particularly strong in:
- **Warehouse operations** (multi-phase picking, dispatch, receiving)
- **Sales analytics** (employee/location/time analysis with commissions)
- **Inventory management** (transformations, transfers, adjustments)

The architecture supports **horizontal scaling** through business unit isolation and follows **database best practices** with proper indexing, constraints, and soft deletes.

---

## Modules & Features

### 1. Core Inventory Module

#### Item Master
- Complete CRUD operations with full lifecycle management
- Item categories with hierarchical organization
- Unit of Measure (UOM) management (standard and custom)
- Multi-tier pricing structure:
  - Purchase price
  - Sales price
  - Cost price
- SKU management with unique identifiers
- Image upload and management capabilities
- Custom fields support via JSONB

#### Warehouse Management
- Multi-warehouse support with company-level isolation
- Location tracking within warehouses
- Warehouse-specific inventory levels
- Current stock tracking with generated available_stock column
- Reorder point and reorder quantity management per warehouse

#### Stock Transactions
- Detailed stock movement tracking
- Transaction types: Receipt, Issue, Transfer, Adjustment, Sale, Purchase, Return, Transformation
- Batch and serial number tracking
- Expiry date management
- Source and destination warehouse tracking
- Reference document linking

#### Stock Adjustments
- Inventory adjustment creation with reasons
- Draft and posted status workflow
- Approval mechanism
- Stock ledger integration on posting

#### Stock Transfers
- Warehouse-to-warehouse transfer capability
- Transfer request and approval workflow
- Real-time stock update on completion

#### Stock Requests
- Inter-warehouse transfer request system
- Complete workflow: Draft → Submitted → Approved → Ready for Pick → Picking → Completed
- Priority levels: Low, Normal, High, Urgent
- Department-based routing
- Source and destination warehouse specification
- Requested vs fulfilled quantity tracking

#### Stock Ledger
- Denormalized transaction ledger for performance
- Running balance calculation
- Transaction history per item and warehouse
- Batch/serial/expiry tracking
- Traceability and audit trail

#### Reorder Management
- Configurable reorder points per item-warehouse combination
- Reorder quantity specifications
- Automatic alert generation
- Dashboard widget integration

---

### 2. Purchasing Module

#### Suppliers Master
- Comprehensive supplier information management
- Contact details and communication tracking
- Supplier categorization
- Custom fields via JSONB
- Soft delete capability

#### Purchase Orders
- Full PO lifecycle management
- Workflow states: Draft → Submitted → Approved → In Transit → Partially Received → Received → Cancelled
- Approval tracking with user and timestamp
- Expected delivery date validation
- Quantity received tracking per line item
- Multi-line item support with pricing
- Supplier linking and reference tracking

#### Purchase Receipts
- Goods Receipt Note (GRN) creation against POs
- Approval workflow (Draft → Approved → Posted)
- Box-level receiving capability
- Damaged item segregation and tracking
- Location assignment during putaway
- Variance tracking (ordered vs received)

#### Putaway Management
- Received goods location assignment
- Warehouse and location tracking
- Integration with stock ledger

#### Load Lists
- Inbound shipment tracking
- Load list items with quantity management
- Expected delivery tracking
- Multiple load lists per shipment

#### Stock Requisitions
- Internal stock requisition request system
- Department-based requisition routing
- Approval workflow
- Warehouse fulfillment tracking

---

### 3. Sales Module

#### Customers Master
- Customer information and account management
- Territory and location tracking
- Contact details and communication history
- Customer categorization
- Custom fields support
- Credit limit and payment term tracking

#### Sales Quotations
- Quote creation and management
- Line item pricing and discounting
- Validity period tracking
- Conversion to sales orders
- Quote status tracking

#### Sales Orders
- Complete order lifecycle management
- Order workflow tracking
- Multiple order sources support:
  - POS (Point of Sale)
  - Retail
  - Online
  - Wholesale
- Customer linking
- Multi-line item support
- Order fulfillment tracking

#### Sales Invoices
- Comprehensive invoice creation and management
- Invoice workflow: Draft → Sent → Paid/Partially Paid/Overdue → Cancelled
- Auto-generation of invoice codes
- Payment tracking with multiple payment methods:
  - Cash
  - Check
  - Credit Card
  - Bank Transfer
  - Maya (e-wallet)
  - GCash (e-wallet)
- Due date calculation
- Overdue tracking and alerts

#### Invoice Payments
- Multi-payment method tracking
- Partial payment support
- Payment allocation to invoices
- Payment reconciliation
- Receipt generation

#### Delivery Notes
- Complete delivery workflow: Draft → Confirmed → Picking Started → Picking Completed → Dispatched → Received → Voided
- Driver information and signature capture
- Multi-phase picking operations
- Warehouse source/destination tracking
- Picking quantity vs allocated quantity management
- Real-time status updates
- Delivery confirmation with timestamps

---

### 4. Warehouse & Logistics

#### Delivery Notes Module
- Complex multi-phase workflow management
- Status progression tracking
- Pick list generation and management
- Outbound logistics tracking
- Integration with stock requests and sales orders
- Real-time updates via Supabase Realtime

#### Pick Lists
- Tablet-optimized picking interface
- Real-time status updates
- Pick line item tracking
- Allocated vs picked quantity management
- Short pick tracking and handling
- Picker assignment
- Picking efficiency metrics

#### Dispatch/Receiving
- Inbound receiving queue management
- Outbound dispatch tracking
- Delivery confirmation
- Driver assignment and tracking
- Signature capture capability

#### Warehouse Operational Queues
- Dashboard widgets for real-time queue monitoring
- Active requisitions tracking
- Incoming deliveries tracking
- Delayed shipments alerts
- Reorder point alerts

---

### 5. Transformations (Manufacturing/Processing)

#### Transformation Templates
- Recipe definition for manufacturing/processing operations
- Input items specification with quantities
- Output items specification with expected yields
- Scrap item tracking
- Template versioning
- Image upload for documentation
- Custom fields support

#### Transformation Orders
- Execution of transformation templates
- Source and destination warehouse specification
- Actual input consumption tracking
- Actual output production tracking
- Variance analysis (expected vs actual)
- Cost allocation
- Status workflow: Draft → In Progress → Completed → Cancelled

#### Transformation Lineage
- Complete traceability of transformed items
- Forward and backward tracing capability
- Parent-child relationship tracking
- Batch and serial number propagation
- Critical for quality control and recalls

---

### 6. Accounting Module

#### Chart of Accounts
- Hierarchical account structure with multiple levels
- Account types:
  - Asset
  - Liability
  - Equity
  - Revenue
  - Expense
  - Cost of Goods Sold (COGS)
- System accounts vs user-defined accounts
- Account code structure with hierarchy levels
- Account balancing and reconciliation
- Custom account creation

#### General Ledger
- Double-entry bookkeeping system
- Journal entry management
- Account transaction history
- Running balance calculation
- Period-based reporting
- Drill-down capability to source documents

#### Journal Entries
- Manual journal entry creation
- Automated journal posting from source documents
- Source module tracking:
  - AR (Accounts Receivable)
  - AP (Accounts Payable)
  - Inventory
  - Manual
  - COGS
- Reference tracking to source documents (invoices, receipts, etc.)
- Debit/credit validation (must balance before posting)
- Workflow: Draft → Posted → Cancelled
- Entry reversal capability

#### Ledger Reports
- Account ledgers with running balances
- Period filtering
- Transaction drill-down
- Multi-currency support

#### Trial Balance
- Account balance summary
- Debit and credit column presentation
- Period comparison capability
- Balance verification for financial reporting

---

### 7. Sales & Operations Analytics

#### Sales Analytics Dashboard
Comprehensive multi-tab analytics system:

**Overview Tab:**
- Total Sales (with period comparison and trend indicator)
- Total Commissions
- Active Agents count
- Average Order Value (AOV)

**Sales by Time:**
- Daily trend analysis
- 30-day historical data
- Line chart visualization with Recharts
- Period-over-period comparison

**Sales by Employee:**
- Agent performance rankings
- Individual sales totals
- Commission rate tracking
- Performance comparison charts

**Sales by Location:**
- Geographic sales breakdown
- City and region analysis
- Customer count by location
- Sales distribution visualizations

#### Commission Reports
- Employee commission summaries
- Commission breakdown by invoice
- Period-based reporting with monthly grouping
- Commission status tracking (pending vs paid)
- Split commission tracking across multiple agents
- Commission percentage-based calculations

#### Stock Reports
- Stock movement reports with transaction history
- Stock valuation analysis
- Inventory aging analysis
- Reorder point alerts

#### Dashboard Widgets
Real-time operational dashboards:

- **Today's Sales Overview**: Current day revenue and transaction count
- **My Sales (Agent View)**: Individual agent performance
- **Top Agent Rankings**: Leaderboard with rankings
- **Recent Activity Feed**: Real-time transaction feed
- **Reorder Alerts**: Items below reorder point
- **Warehouse Operational Queues**: Active operations tracking
- **Active Requisitions**: Pending stock requests
- **Incoming Deliveries**: Expected delivery schedule
- **Delayed Shipments**: Late delivery alerts

---

### 8. Admin & User Management

#### Users Management
- User account creation and management
- Integration with Supabase Auth (JWT-based authentication)
- User profile management
- Role assignment per user
- Business unit access control
- Active/inactive user status
- Email verification and password reset

#### Role-Based Access Control (RBAC)
- **Roles**: System-defined and custom roles per company
- **Permissions**: Granular permission control
  - View (Read access)
  - Create (Insert access)
  - Edit (Update access)
  - Delete (Delete access)
- **Business Unit Scoping**: Role assignments specific to business units
- **Permission Inheritance**: Role-based permission assignment
- **Permission Checking**: Middleware-based authorization in API routes

#### Business Units
- Multi-business unit support
- Context isolation between units
- BU-specific data segregation
- Cross-BU transfer capabilities
- Hierarchical organization structure

#### User Preferences
- User-level settings and customization
- Theme preferences (light/dark mode)
- Language selection
- Dashboard layout preferences
- Notification settings
- Display preferences (date format, currency, etc.)

---

### 9. Point of Sale (POS)

#### POS Transactions
Complete point-of-sale system with:

- **Customer Tracking**: Optional customer linking for loyalty
- **Item Line Items**: Multi-item transactions with:
  - Quantity selection
  - Unit price
  - Discount support (amount and percentage)
  - Line total calculation
- **Tax Calculations**: Automatic tax computation
- **Payment Methods**: Multiple payment options
  - Maya (e-wallet)
  - GCash (e-wallet)
  - Cash (with change calculation)
  - Check
  - Credit Card
  - Bank Transfer
- **Change Calculation**: Automatic change computation for cash payments
- **Receipt Generation**: Print and email receipts
- **Accounting Integration**: Automatic journal entry posting

#### Tablet Interface
- Dedicated tablet-optimized POS interface
- Touch-friendly UI with large buttons
- Fast product search and selection
- Cart management
- Quick checkout process
- Offline capability consideration

#### Mobile Interface
- Mobile-friendly responsive POS support
- Smartphone-optimized layouts
- Quick access for mobile sales staff
- Field sales capability

---

## Database Schema & Entities

### Overview
**Total Tables**: 45+ entities across multiple domains

### Entity Categories

#### 1. Core Administrative Tables

**companies**
- Multi-company support with complete isolation
- Company profile information
- Configuration settings
- Subscription and billing information

**users**
- User accounts linked to Supabase auth
- Profile information
- Contact details
- System access tracking

**business_units**
- Organizational divisions within companies
- Hierarchical structure support
- BU-specific configuration
- Parent-child relationships

**roles, permissions, user_roles**
- Complete RBAC system implementation
- Role definitions (system and custom)
- Permission granularity (view, create, edit, delete)
- User-role assignments with BU scoping

**user_business_unit_access**
- BU-scoped access control
- User access rights per business unit
- Access level specification

---

#### 2. Master Data Tables

**items**
- Central product/service master
- Fields: code, name, description, category, UOM, barcode, SKU
- Pricing: purchase_price, sales_price, cost_price
- Status: active/inactive
- Images and attachments
- Custom fields (JSONB)
- Company-level isolation

**item_categories**
- Hierarchical product categorization
- Parent-child category relationships
- Category descriptions and metadata
- Custom fields support

**units_of_measure**
- Standard UOM (pcs, kg, liter, etc.)
- Custom UOM definitions
- Conversion factors between UOMs
- Company-specific UOMs

**item_warehouse**
- Stock levels per item-warehouse combination
- Current stock quantity
- Available stock (calculated/generated column)
- Reorder point and reorder quantity
- Location within warehouse
- Stock valuation

**suppliers**
- Supplier master data
- Contact information (name, email, phone, address)
- Payment terms
- Credit limit
- Supplier rating/performance tracking
- Custom fields (JSONB)

**customers**
- Customer master data
- Contact details
- Territory assignment
- Credit limit and payment terms
- Customer type/category
- Sales history aggregates
- Custom fields (JSONB)

**warehouses**
- Physical and logical storage locations
- Warehouse types (main, branch, virtual, etc.)
- Address and contact information
- Operational status
- Capacity information
- Business unit assignment

**employees**
- Sales agents and staff information
- Employee code and personal details
- Department and position
- Commission rates
- Territory assignments
- Active/inactive status

---

#### 3. Inventory Management Tables

**stock_transactions**
- Transaction header for all stock movements
- Fields: transaction_date, type, reference_no, source_warehouse, destination_warehouse
- Types: Receipt, Issue, Transfer, Adjustment, Sale, Purchase, Return, Transformation
- Status workflow
- Source document references
- Approval tracking

**stock_transaction_items**
- Line items for stock transactions
- Item, quantity, unit price, UOM
- Batch number, serial number, expiry date
- Location tracking
- Cost allocation

**stock_adjustments**
- Stock adjustment header
- Adjustment date, reason, warehouse
- Status: Draft, Posted
- Approval workflow
- Reference to stock transaction created

**stock_requests**
- Inter-warehouse transfer request header
- Workflow: Draft → Submitted → Approved → Ready for Pick → Picking → Completed → Cancelled
- Source and destination warehouses
- Priority levels (low, normal, high, urgent)
- Department routing
- Request date and required date

**stock_request_items**
- Line items for stock requests
- Requested quantity vs fulfilled quantity
- Item specifications
- Allocation status

**stock_ledger**
- Denormalized transaction ledger for query performance
- One record per transaction line item
- Running balance calculation
- Indexed for fast queries
- Batch, serial, expiry tracking
- Complete audit trail

**damaged_items**
- Tracking of damaged inventory
- Damage reason and description
- Quantity and value
- Warehouse and location
- Disposition status (repair, scrap, return to supplier)

---

#### 4. Purchasing Tables

**purchase_orders**
- PO header document
- Workflow: Draft → Submitted → Approved → In Transit → Partially Received → Received → Cancelled
- Supplier reference
- Order date, expected delivery date
- Terms and conditions
- Approval tracking with user and timestamp
- Total amounts

**purchase_order_items**
- PO line items
- Item, quantity, unit price, total
- Quantity received tracking
- Delivery schedule
- Item specifications

**purchase_receipts**
- Receipt header (GRN)
- Workflow: Draft → Approved → Posted
- Link to PO(s)
- Receipt date
- Warehouse destination
- Approval workflow

**purchase_receipt_items**
- Receipt line items
- Received quantity, damaged quantity
- Batch/serial/expiry assignment
- Location assignment
- Quality inspection results

**grns** (Goods Receipt Notes)
- Detailed GRN records
- Box-level receiving capability
- Warehouse and location assignment
- Receipt confirmation

**grn_items**
- GRN line items
- Item-level receipt details
- Quality metrics

**grn_boxes**
- Box-level tracking for received goods
- Box number, contents, location
- Receiving status

**load_lists**
- Inbound shipment tracking header
- Carrier information
- Expected arrival date and time
- Load status tracking

**load_list_items**
- Shipment item details
- Expected quantities
- Receiving instructions

---

#### 5. Sales Tables

**sales_orders**
- Sales order header
- Customer reference
- Order date, delivery date
- Order source (POS, retail, online, wholesale)
- Status workflow
- Total amounts
- Payment status

**sales_order_items**
- Order line items
- Item, quantity, price, discount
- Delivery instructions
- Allocation status

**sales_invoices**
- Invoice header document
- Workflow: Draft → Sent → Paid/Partially Paid/Overdue → Cancelled
- Auto-generated invoice codes
- Customer reference
- Invoice date, due date
- Payment terms
- Total amounts
- Overdue tracking

**sales_invoice_items**
- Invoice line items
- Item, quantity, unit price, discount, tax
- Line total
- Link to sales order

**invoice_payments**
- Payment records against invoices
- Payment date, amount, method
- Payment reference number
- Bank/account information
- Reconciliation status

**invoice_employee_commissions**
- Commission tracking per invoice
- Primary employee commission
- Commission splits across multiple agents
- Commission percentage and amount
- Payment status (pending, paid)
- Payment date

**sales_quotations**
- Quote header
- Customer reference
- Quote date, validity period
- Status (draft, sent, accepted, rejected, expired)
- Conversion to order tracking

**sales_quotation_items**
- Quote line items
- Proposed pricing and terms
- Item specifications

---

#### 6. Logistics Tables

**delivery_notes**
- Delivery header document
- Multi-phase workflow: Draft → Confirmed → Picking Started → Picking Completed → Dispatched → Received → Voided
- Customer and delivery address
- Driver information and signature
- Delivery date/time (scheduled and actual)
- Source warehouse
- Supabase Realtime enabled for live updates

**delivery_note_items**
- Delivery line items
- Item, allocated quantity, picked quantity, dispatched quantity
- Short pick tracking
- Delivery status per line
- Receiving confirmation

**delivery_note_sources**
- Link delivery notes to source documents
- Source type (stock request, sales order)
- Source document reference
- Fulfillment tracking

**pick_lists**
- Picking operation header
- Picker assignment
- Picking date and time
- Status workflow
- Efficiency metrics
- Supabase Realtime enabled

**pick_list_items**
- Pick line item details
- Location information
- Quantity to pick, quantity picked
- Pick confirmation
- Short pick reasons

---

#### 7. Manufacturing/Transformation Tables

**transformation_templates**
- Recipe definitions for manufacturing/processing
- Template code, name, description
- Status (active, inactive, obsolete)
- Version tracking
- Images for documentation
- Custom fields

**transformation_template_inputs**
- Input items required for transformation
- Item reference and quantity
- Scrap percentage allowance
- Input type classification

**transformation_template_outputs**
- Expected output items from transformation
- Item reference and expected quantity
- Yield percentage
- Output type classification

**transformation_orders**
- Transformation execution records
- Template reference
- Source and destination warehouses
- Order date, completion date
- Status: Draft → In Progress → Completed → Cancelled
- Cost allocation

**transformation_order_inputs**
- Actual input consumption
- Batch/serial numbers consumed
- Variance from template (expected vs actual)

**transformation_order_outputs**
- Actual output production
- Batch/serial numbers generated
- Variance from template
- Quality metrics

**transformation_lineage**
- Traceability records
- Parent-child relationship tracking
- Forward and backward tracing capability
- Batch/serial propagation
- Critical for recalls and quality control

---

#### 8. Accounting Tables

**accounts**
- Chart of Accounts
- Account types: Asset, Liability, Equity, Revenue, Expense, COGS
- Hierarchical structure with levels
- Account code with parent-child relationships
- System accounts vs user-defined
- Active/inactive status
- Opening and current balances

**journal_entries**
- Journal header document
- Entry date, posting date
- Source module (AR, AP, Inventory, Manual, COGS)
- Reference to source document
- Description
- Status: Draft → Posted → Cancelled
- Auto-generation flag

**journal_lines**
- Journal detail lines
- Account reference
- Debit and credit amounts
- Description
- Balanced validation (sum of debits = sum of credits)

---

#### 9. POS Tables

**pos_transactions**
- POS transaction header
- Transaction date and time
- Customer reference (optional)
- Cashier/user reference
- Payment method
- Subtotal, tax, discount, total
- Amount tendered, change given
- Receipt number

**pos_transaction_items**
- POS line items
- Item, quantity, unit price
- Discount (amount and percentage)
- Line total
- Tax calculation

**pos_accounting_accounts**
- POS account mappings for journal posting
- Cash account, sales account, tax account mappings
- Payment method to account mappings
- Business unit specific configurations

---

#### 10. Other Supporting Tables

**user_preferences**
- User-specific settings
- Preference type and value (JSONB)
- Theme, language, display settings
- Notification preferences

**employee_distribution_locations**
- Territory assignments for employees
- Geographic territories
- Assignment date and status
- Performance tracking per territory

**return_to_suppliers, rts_items**
- Return management for quality issues
- Return reasons and descriptions
- Quantity and value returned
- Credit note tracking
- Resolution status

**sales_distribution**
- Sales allocation and distribution tracking
- Distribution by territory/channel
- Performance metrics

---

### Database Design Principles

#### Data Integrity
- **Constraints**: Check constraints on amounts, quantities, dates
- **Triggers**: Auto-timestamp updates on modified records
- **Unique Constraints**: Code uniqueness per company
- **Foreign Keys**: Referential integrity with cascade/restrict rules
- **Versioning**: Version numbers for optimistic concurrency control

#### Performance Optimization
- **Indexes**: Strategic indexing on:
  - Foreign keys (company_id, business_unit_id, etc.)
  - Status fields for workflow queries
  - Date fields for period-based reporting
  - Code fields for lookup
- **Generated Columns**: Calculated fields like available_stock (current_stock - reserved_stock)
- **Denormalization**: stock_ledger table for fast query performance
- **Materialized Views**: Considered for complex aggregations (can be implemented)

#### Security & Audit
- **Row-Level Security (RLS)**: Supabase RLS policies on all tables
- **Company Isolation**: All data scoped by company_id
- **Business Unit Scoping**: BU-level data access control
- **Soft Deletes**: deleted_at timestamp with RLS filtering (not shown in queries when deleted)
- **Audit Fields**: created_at, updated_at, created_by, updated_by on all entities
- **Version Control**: Version numbers for concurrent update detection

---

## Existing Reports & Analytics

### Implemented Reports

#### 1. Sales Analytics Reports
**Location**: `/reports/sales-analytics`

**Overview Tab**:
- **Total Sales**: Current period total with previous period comparison
- **Total Commissions**: Commission expense tracking
- **Active Agents**: Count of active sales employees
- **Average Order Value (AOV)**: Sales efficiency metric
- **Trend Indicators**: Up/down indicators with percentage change

**Sales by Time Tab**:
- Daily sales trend analysis
- 30-day historical data visualization
- Line chart using Recharts
- Period-over-period comparison
- Trend identification (growth/decline patterns)

**Sales by Employee Tab**:
- Agent performance rankings
- Individual sales totals
- Commission rate tracking
- Performance comparison bar charts
- Top performer identification

**Sales by Location Tab**:
- Geographic sales breakdown
- City and region analysis
- Customer count by location
- Sales distribution pie charts
- Territory performance metrics

---

#### 2. Commission Reports
**Location**: `/reports/commission`

**Features**:
- Employee commission summaries
- Commission breakdown by invoice
- Period-based reporting (monthly grouping)
- Commission status tracking (pending vs paid)
- Split commission visibility
- Filterable by:
  - Date range
  - Employee
  - Payment status
  - Business unit

**Metrics**:
- Total commission earned
- Paid commission
- Pending commission
- Commission rate by employee
- Commission trend analysis

---

#### 3. Stock Reports
**Location**: `/reports/stock`

**Current Features**:
- Stock movement reports
- Stock valuation analysis
- Transaction history
- Basic aging information

**Capabilities**:
- Filter by warehouse
- Filter by item/category
- Date range selection
- Export functionality

---

#### 4. Dashboard Widgets

**Today's Sales Overview**:
- Current day revenue
- Transaction count
- Comparison to previous day
- Real-time updates

**My Sales (Agent View)**:
- Individual agent performance
- Personal sales targets
- Commission tracking
- Daily/weekly/monthly views

**Top Agent Rankings**:
- Leaderboard display
- Top 10 agents by revenue
- Performance comparison
- Motivation and gamification

**Recent Activity Feed**:
- Real-time transaction feed
- Recent orders, invoices, payments
- System activity log
- User action tracking

**Reorder Alerts**:
- Items below reorder point
- Quantity needed to reorder
- Warehouse-specific alerts
- Action buttons for quick PO creation

**Warehouse Operational Queues**:
- Active stock requests
- Pending picking operations
- Items awaiting putaway
- Real-time status updates

**Active Requisitions**:
- Count of pending requisitions
- Requisition status summary
- Priority highlighting
- Quick access to requisition details

**Incoming Deliveries**:
- Expected delivery schedule
- Today's expected arrivals
- Delayed shipment alerts
- Carrier information

**Delayed Shipments**:
- Overdue delivery tracking
- Days delayed calculation
- Customer impact assessment
- Escalation indicators

---

#### 5. Accounting Reports

**Trial Balance**:
- Account balance summary
- Debit and credit columns
- Period-specific balancing
- Balance verification for closing
- Export to Excel

**General Ledger**:
- Account transaction history
- Running balance calculation
- Transaction drill-down to source documents
- Period filtering
- Multi-level account hierarchy

**Journal Entry Listing**:
- Journal entry browse and search
- Filter by date, status, source module
- Entry detail view
- Posting status tracking

**Chart of Accounts View**:
- Hierarchical account display
- Account type grouping
- Balance display
- Account management interface

---

### Analytics API Endpoints

#### Sales Analytics
```
GET /api/analytics/sales/overview
```
- KPI summary (sales, commissions, agents, AOV)
- Period comparison
- Trend calculation

```
GET /api/analytics/sales/by-employee
```
- Employee performance metrics
- Commission tracking
- Sales ranking
- Filterable by date range, business unit

```
GET /api/analytics/sales/by-location
```
- Geographic analysis
- City/region breakdown
- Customer distribution
- Sales concentration

```
GET /api/analytics/sales/by-time
```
- Time series data
- Daily aggregation
- Trend analysis
- Historical comparison (30 days default)

#### Dashboard Analytics
```
GET /api/analytics/dashboard/widgets
```
- Multi-widget data fetch
- Real-time metrics
- Today's sales, top agents, recent activity
- Cached for performance

```
GET /api/analytics/dashboard/reorder-alerts
```
- Inventory alerts
- Items below reorder point
- Warehouse-specific alerts
- Quantity calculations

#### Stock Reports
```
GET /api/reports/stock-movement
```
- Stock transaction reports
- Movement history by item/warehouse
- Period-based filtering
- Transaction type breakdown

```
GET /api/reports/stock-valuation
```
- Inventory valuation
- Stock value by item, category, warehouse
- Cost method application
- Period comparison

---

### Visualization Components

**Charting Library**: Recharts

**Chart Types in Use**:
- **Line Charts**: Sales trends over time
- **Bar Charts**: Employee performance, location comparison
- **Pie Charts**: Location distribution, sales composition
- **Area Charts**: Cumulative metrics

**KPI Cards**:
- Metric value display
- Period comparison
- Trend indicators (up/down arrows)
- Percentage change
- Color coding (green for positive, red for negative)

**Data Tables**:
- Sortable columns
- Filterable data
- Pagination
- Export functionality
- Drill-down capability

---

### Export Capabilities

**PDF Generation**:
- Invoice PDF generation using @react-pdf/renderer
- Report export to PDF using html2canvas and jsPDF
- Print-friendly layouts
- Custom styling for print media

**QR Code Generation**:
- QR codes for item tracking
- QR codes for documents (invoices, delivery notes)
- QR scanning capability using html5-qrcode

**Print Layouts**:
- Responsive print stylesheets
- Document templates for invoices, receipts, delivery notes
- Print optimization

---

### Time-Based Analysis Features

**Period Granularity**:
- Daily aggregation
- Weekly rollups
- Monthly grouping
- Quarterly and yearly analysis

**Period Comparison**:
- vs Previous period (day, week, month, quarter, year)
- vs Same period last year
- Trend percentage calculation
- Visual trend indicators

**Historical Trending**:
- 30-day default trend window
- Configurable date ranges
- Historical data retention
- Archive support for long-term analysis

**Date Range Filtering**:
- Custom date range selection
- Quick filters (today, this week, this month, this year)
- Period presets
- Date picker components

---

### Dimensional Analysis Capabilities

**By Employee**:
- Agent performance metrics
- Sales per employee
- Commission per employee
- Employee rankings
- Performance comparison

**By Location**:
- Geographic analysis (city, region, territory)
- Customer count by location
- Sales concentration mapping
- Territory performance

**By Time**:
- Daily trends
- Time series analysis
- Seasonal pattern identification
- Historical comparisons

**By Status**:
- Document state distribution
- Workflow stage analysis
- Bottleneck identification
- Completion rates

**By Customer**:
- Customer purchase patterns
- Customer profitability (basic)
- Top customers ranking
- Customer segmentation (basic)

**By Product**:
- Item sales performance
- Category analysis
- Top-selling items
- Product mix analysis

---

## Technology Stack

### Frontend Technologies

#### Core Framework
- **Next.js 15**: React framework with App Router
- **React 19**: UI library with latest features
- **TypeScript 5**: Static type checking
- **App Router**: Next.js routing with server components

#### UI & Styling
- **shadcn/ui**: Component library built on Radix UI
- **Radix UI**: Unstyled, accessible component primitives
- **Tailwind CSS**: Utility-first CSS framework
- **tailwind-merge**: Utility for merging Tailwind classes
- **clsx**: Utility for constructing className strings
- **next-themes**: Theme management with dark mode support
- **Lucide React**: Icon library

#### State Management & Data Fetching
- **Zustand**: Lightweight state management
- **React Query (TanStack Query)**: Data fetching and caching
- **SWR**: Alternative data fetching (if used)

#### Forms & Validation
- **React Hook Form**: Form state management
- **Zod**: TypeScript-first schema validation
- **@hookform/resolvers**: Integration between RHF and validation libraries

#### Data Visualization
- **Recharts**: Charting library for React
  - Line charts, bar charts, pie charts, area charts
  - Responsive design
  - Customizable styling

#### Date & Time
- **date-fns**: Date utility library
- **react-day-picker**: Date picker component

#### Document Generation
- **@react-pdf/renderer**: PDF generation in React
- **html2canvas**: HTML to canvas conversion
- **jsPDF**: Client-side PDF generation

#### Barcode & QR
- **qrcode**: QR code generation
- **html5-qrcode**: QR code scanning

#### Notifications & UI Feedback
- **Sonner**: Toast notification library
- **React Hot Toast**: Alternative toast library (if used)

#### Internationalization
- **next-i18next**: i18n for Next.js
- **next-intl**: Alternative i18n solution
- **react-i18next**: React bindings for i18next

#### File Handling
- **react-dropzone**: File upload with drag-and-drop

#### Other Frontend Libraries
- **cmdk**: Command menu component
- **react-resizable-panels**: Resizable panel layouts
- **vaul**: Drawer component
- **embla-carousel-react**: Carousel/slider component

---

### Backend Technologies

#### Database & ORM
- **PostgreSQL**: Primary database (via Supabase)
- **Supabase**: Backend-as-a-Service platform
  - **Supabase Client (@supabase/supabase-js)**: JavaScript client
  - **Supabase SSR**: Server-side rendering support
  - **Row-Level Security (RLS)**: Database-level security policies
  - **Real-time**: WebSocket-based real-time subscriptions

#### Authentication
- **Supabase Auth**: JWT-based authentication
  - Email/password authentication
  - OAuth providers support
  - JWT token management
  - Session handling
  - Role-based claims in JWT

#### API
- **Next.js API Routes**: RESTful API endpoints
- **Server Actions**: Next.js 13+ server-side mutations
- **Middleware**: Custom middleware for auth, permissions, BU context

#### Email
- **Nodemailer**: Email sending library
- **Email Templates**: HTML email templates

#### Edge Functions
- **Supabase Edge Functions**: Deno-based serverless functions (if used)

---

### Development Tools

#### Code Quality
- **ESLint**: JavaScript/TypeScript linting
  - next/core-web-vitals config
  - Custom rules
- **Prettier**: Code formatting
  - Tailwind plugin for class sorting
- **TypeScript Compiler**: Type checking

#### Build & Development
- **Turbopack**: Next.js 15 default bundler
- **Webpack**: Alternative bundler (fallback)
- **PostCSS**: CSS processing
- **Autoprefixer**: CSS vendor prefixing

#### Version Control
- **Git**: Version control system

---

### Infrastructure & Deployment

#### Hosting Platform
- Likely deployed on **Vercel** (optimized for Next.js)
- Alternative: **Netlify**, **AWS**, **Google Cloud**, etc.

#### Database Hosting
- **Supabase Cloud**: Managed PostgreSQL hosting
- Real-time WebSocket connections
- Automatic backups
- Connection pooling

#### CDN & Assets
- Vercel CDN for static assets
- Next.js Image Optimization
- Automatic caching

---

### Key Libraries Summary

**Package Dependencies (Key Highlights)**:
```json
{
  "next": "^15.x",
  "react": "^19.x",
  "typescript": "^5.x",
  "@supabase/supabase-js": "^2.x",
  "@tanstack/react-query": "^5.x",
  "zustand": "^4.x",
  "react-hook-form": "^7.x",
  "zod": "^3.x",
  "tailwindcss": "^3.x",
  "recharts": "^2.x",
  "date-fns": "^3.x",
  "@react-pdf/renderer": "^3.x",
  "sonner": "^1.x",
  "next-themes": "^0.x",
  "lucide-react": "^0.x"
}
```

---

## Business Logic & Workflows

### Document Lifecycle Workflows

#### Sales Invoice Workflow
```
Draft → Sent → Paid/Partially Paid/Overdue → Cancelled
```

**Draft Stage**:
- Invoice creation
- Line item entry
- Customer and terms selection
- Calculation of totals, taxes, discounts
- Validation of required fields

**Sent Stage**:
- Invoice finalization
- Auto-generation of invoice code
- Stock reservation (if applicable)
- Email sending to customer
- Journal entry creation (AR debit, Revenue credit)
- Commission calculation and allocation

**Payment Stages**:
- **Partially Paid**: Some payments received, balance outstanding
- **Paid**: Full payment received
- **Overdue**: Past due date without full payment
- Payment allocation to invoice
- Journal entry for payment (Cash/Bank debit, AR credit)

**Cancelled**:
- Invoice void
- Stock reservation release
- Journal entry reversal
- Reason tracking

**Business Rules**:
- Invoice code must be unique per company
- Due date validation (must be >= invoice date)
- Payment date validation (must be >= invoice date)
- Cannot modify invoice after "Sent" status (must cancel and recreate)
- Overdue calculation runs daily via cron job or trigger

---

#### Purchase Order Workflow
```
Draft → Submitted → Approved → In Transit → Partially Received → Received → Cancelled
```

**Draft Stage**:
- PO creation
- Supplier selection
- Line item entry with pricing
- Expected delivery date selection

**Submitted Stage**:
- PO finalization
- Routing to approver
- PO code auto-generation
- Notification to approver

**Approved Stage**:
- Approval tracking (user, timestamp)
- Notification to supplier
- Email/print PO to supplier
- Budget commitment (if applicable)

**In Transit Stage**:
- Goods shipped from supplier
- Shipment tracking
- Expected delivery date monitoring

**Partially Received**:
- Some items received
- Quantity received tracking per line
- Multiple receipts against single PO
- Outstanding quantity calculation

**Received**:
- All items fully received
- PO closure
- Journal entry creation (Inventory debit, AP credit)
- Supplier invoice matching

**Cancelled**:
- PO cancellation with reason
- Budget release
- Notification to supplier

**Business Rules**:
- Expected delivery date must be >= order date
- Cannot edit PO after "Approved" status
- Received quantity cannot exceed ordered quantity (or tolerance %)
- Approval required for POs above threshold amount

---

#### Delivery Note Workflow
```
Draft → Confirmed → Picking Started → Picking Completed → Dispatched → Received → Voided
```

**Draft Stage**:
- Delivery note creation
- Customer and address selection
- Line items from source (stock request or sales order)
- Warehouse source selection

**Confirmed Stage**:
- DN finalization
- Stock allocation to DN
- Picking list generation
- Notification to warehouse

**Picking Started**:
- Picker assignment
- Pick list printing/tablet assignment
- Picking timestamp recorded
- Real-time status visible on dashboard

**Picking Completed**:
- All items picked (or short picks recorded)
- Picked quantity confirmation
- Pick list sign-off
- Dispatch ready

**Dispatched**:
- Driver assignment
- Dispatch timestamp
- Vehicle information
- Estimated delivery time
- Stock ledger update (Issue transaction)

**Received**:
- Delivery confirmation
- Customer signature capture
- Actual delivery timestamp
- Delivery photo (optional)
- Completion of delivery cycle

**Voided**:
- DN cancellation
- Stock allocation release
- Reason tracking
- Stock ledger reversal

**Business Rules**:
- Cannot dispatch before picking completed
- Short picks must be documented with reason
- Dispatched quantity cannot exceed picked quantity
- Real-time updates via Supabase Realtime

---

#### Stock Request Workflow
```
Draft → Submitted → Approved → Ready for Pick → Picking → Completed → Cancelled
```

**Draft Stage**:
- Request creation
- Source and destination warehouse selection
- Line items with requested quantities
- Priority and department assignment

**Submitted Stage**:
- Request finalization
- Routing based on priority and department
- Notification to source warehouse manager
- Request code auto-generation

**Approved Stage**:
- Manager approval
- Stock availability check
- Delivery note creation (if applicable)
- Picking queue addition

**Ready for Pick**:
- Pick list generation
- Picker assignment
- Items added to picking queue
- Picking can commence

**Picking Stage**:
- Items being picked
- Real-time quantity updates
- Short pick handling
- Pick confirmation

**Completed**:
- All items picked and transferred
- Stock ledger updates (Issue from source, Receipt at destination)
- Delivery confirmation
- Request closure

**Cancelled**:
- Request cancellation with reason
- Stock allocation release
- Notification to requester

**Business Rules**:
- Source warehouse must have sufficient stock
- Approval required for inter-BU transfers
- Priority affects queue ordering
- Cannot modify after "Submitted" status

---

### Financial Processes

#### Journal Entry Logic

**Automatic Posting Scenarios**:

**From Sales Invoice (AR Module)**:
```
Debit: Accounts Receivable (Asset)
Credit: Sales Revenue (Revenue)
Credit: Tax Payable (Liability) [if applicable]
```

**From Invoice Payment**:
```
Debit: Cash/Bank (Asset)
Credit: Accounts Receivable (Asset)
```

**From Purchase Receipt (AP Module)**:
```
Debit: Inventory (Asset)
Credit: Accounts Payable (Liability)
```

**From Payment to Supplier**:
```
Debit: Accounts Payable (Liability)
Credit: Cash/Bank (Asset)
```

**From Sales Order (COGS)**:
```
Debit: Cost of Goods Sold (Expense)
Credit: Inventory (Asset)
```

**From Stock Adjustment**:
```
Debit: Inventory Loss/Gain (Expense/Revenue)
Credit: Inventory (Asset)
OR
Debit: Inventory (Asset)
Credit: Inventory Adjustment (Contra-Asset)
```

**Manual Journal Entries**:
- Created by users with accounting permissions
- Draft → Posted workflow
- Must balance (total debits = total credits)
- Posting validation
- Cannot modify after posting (must reverse and re-enter)

**Business Rules**:
- All entries must balance
- Posting date must be within open accounting period
- Source document reference required for auto-generated entries
- Approval required for manual entries above threshold
- Entry reversal creates new entry with reversed amounts

---

#### Commission Calculation

**Commission Structure**:
- **Primary Employee Commission**: Main agent gets base commission rate
- **Commission Splits**: Multiple agents can share commission on single invoice
- **Percentage-Based**: Commission calculated as % of invoice amount
- **Configurable Rates**: Different rates per employee, product category, or customer type

**Calculation Timing**:
- Calculated when invoice status changes to "Sent" or "Paid"
- Commission created in "Pending" status
- Changes to "Paid" when commission is disbursed

**Commission Record Creation**:
```
For each employee assigned to invoice:
  Commission Amount = Invoice Total × Employee Commission %
  Create invoice_employee_commission record
  Status = Pending
```

**Period-Based Aggregation**:
- Monthly commission reports
- Period totals by employee
- Pending vs paid tracking
- Payment batch processing

**Business Rules**:
- Commission only on paid or sent invoices (configurable)
- Voided/cancelled invoices: commission reversed
- Split commissions must total 100% (or be fixed amounts)
- Commission payment tracked separately from employee payroll

---

#### Inventory Valuation

**Valuation Methods** (system should support):
- **FIFO**: First In, First Out
- **Average Cost**: Weighted average
- **Standard Cost**: Predefined cost per item
- **Last Purchase Price**: Most recent purchase cost

**Stock Ledger Tracking**:
- Every transaction creates stock ledger entry
- Running balance maintained per item-warehouse
- Transaction includes:
  - Quantity in/out
  - Cost per unit
  - Total value
  - Running quantity
  - Running value
  - Average cost recalculation

**Batch and Serial Number Support**:
- Cost tracked per batch
- Serial number tracking for high-value items
- Expiry date management for perishables
- FEFO (First Expired, First Out) capability

**Cost Tracking Per Transaction**:
- Purchase: Cost = Purchase price
- Sale: Cost = Current average cost (or FIFO cost)
- Adjustment: Cost = Current average cost
- Transfer: Cost carried over from source warehouse
- Transformation: Cost = Sum of input costs / output quantity

---

### Operational Workflows

#### Picking & Dispatch Process

**Picking Queue Management**:
1. Delivery notes in "Confirmed" status enter picking queue
2. Priority sorting (urgent orders first)
3. Picker assignment (manual or automatic)
4. Pick list generation with:
   - Item, quantity, warehouse location
   - Pick sequence optimization (if locations mapped)

**Picking Execution**:
1. Picker scans/selects pick list on tablet
2. Status → "Picking Started"
3. For each line item:
   - Navigate to location
   - Pick quantity (scan or manual entry)
   - Confirm picked quantity
   - Record short picks if insufficient stock
4. Pick list completion
5. Status → "Picking Completed"

**Dispatch Process**:
1. Picked items moved to dispatch area
2. Driver assignment
3. Vehicle information entry
4. Dispatch confirmation
5. Status → "Dispatched"
6. Stock ledger update (Issue transaction)

**Short Pick Handling**:
- Short pick reason selection
- Automatic backorder creation (optional)
- Notification to sales/customer service
- Stock allocation adjustment

**Business Rules**:
- Allocated quantity set at DN confirmation
- Picked quantity ≤ allocated quantity
- Dispatched quantity = picked quantity (or less if partial dispatch)
- Real-time inventory update on dispatch

---

#### Goods Receipt Process

**Receipt Creation**:
1. Purchase receipt created against PO
2. Expected items pre-populated from PO
3. Receipt date and warehouse selection

**Box-Level Receiving**:
1. For each box received:
   - Box number/identifier
   - Expected items in box
   - Physical count of items
   - Damaged item segregation
2. Box-level tracking in grn_boxes table

**Quality Inspection**:
1. Items inspected upon receipt
2. Quality metrics recorded
3. Damaged items segregated
4. Damage reason documentation

**Location Assignment (Putaway)**:
1. Approved items assigned to warehouse locations
2. Location barcode scanning
3. Putaway confirmation
4. Stock ledger update (Receipt transaction)

**Business Rules**:
- Received quantity cannot exceed PO quantity (or tolerance %)
- Damaged items go to separate damage location
- Approval required before putaway
- Stock update only after approval

---

#### Manufacturing/Transformation Process

**Template Execution**:
1. Transformation order created from template
2. Source warehouse for inputs, destination for outputs
3. Order status → "In Progress"

**Input Consumption**:
1. Input items allocated from source warehouse
2. Batch/serial numbers recorded
3. Actual quantity consumed recorded
4. Variance from template calculated

**Processing**:
1. Manufacturing/transformation execution
2. Quality control
3. Scrap item tracking

**Output Production**:
1. Output items received at destination warehouse
2. New batch/serial numbers generated
3. Actual output quantity recorded
4. Yield calculation (actual vs expected)

**Lineage Tracking**:
1. Parent-child relationships recorded in transformation_lineage
2. Input batch/serial → output batch/serial mapping
3. Forward tracing (where did this batch go?)
4. Backward tracing (where did this batch come from?)

**Cost Allocation**:
1. Total input cost calculated
2. Cost allocated to outputs proportionally
3. Scrap cost allocated
4. Standard cost variance calculated

**Business Rules**:
- Source warehouse must have sufficient stock
- Output batch numbers must be unique
- Lineage tracking mandatory for regulated items
- Order completion triggers stock ledger updates

---

## Key Architectural Features

### Security & Access Control

#### Multi-Company Isolation
- **Company-Level Data Segregation**: All data tables include company_id
- **RLS Policy**: WHERE company_id = auth.jwt() ->> 'company_id'
- **Complete Isolation**: No cross-company data visibility
- **API Enforcement**: Middleware validates company_id in JWT
- **UI Context**: Company context set on login, persisted in session

#### Business Unit Scoping
- **BU-Level Access Control**: Users assigned to specific business units
- **Role Assignment Per BU**: Roles scoped to business units
- **Cross-BU Operations**: Restricted or require special permissions
- **Data Filtering**: Queries filtered by user's accessible BUs
- **API Middleware**: BU context extracted from JWT claims

#### Row-Level Security (Supabase RLS)
- **Database-Level Enforcement**: Security enforced at PostgreSQL level
- **JWT-Based Policies**: RLS policies check JWT claims
- **Policy Examples**:
  - Users can only see data for their company
  - Users can only see data for their assigned business units
  - Soft-deleted records are automatically filtered out
  - Users can only perform actions allowed by their permissions

#### Permission-Based Access
- **Granular Permissions**: View, Create, Edit, Delete per resource
- **Resource-Level Control**: Permissions per module/entity type
- **Role-Permission Mapping**: Permissions assigned to roles
- **User-Role Mapping**: Users assigned multiple roles
- **Permission Checking**:
  - Frontend: UI elements hidden based on permissions
  - Backend: API routes validate permissions before operations

#### Audit Trail
- **Created Metadata**: created_at, created_by on all entities
- **Updated Metadata**: updated_at, updated_by on all entities
- **Automatic Timestamps**: Database triggers maintain timestamps
- **User Tracking**: User ID captured from JWT
- **Change History**: Audit log for sensitive operations (can be enhanced)

#### Soft Deletes
- **Deletion Flag**: deleted_at timestamp instead of hard delete
- **RLS Filtering**: deleted_at IS NULL in all RLS policies
- **Recovery Capability**: Soft-deleted records can be restored
- **Audit Compliance**: Maintains record history for auditing
- **Cascading Consideration**: Related records handling on parent delete

---

### Data Integrity

#### Constraints
- **Check Constraints**:
  - Amounts and quantities must be >= 0
  - Dates must be logical (e.g., due_date >= invoice_date)
  - Status values must be from enum list
  - Debit/credit balance in journal entries

- **Not Null Constraints**: Required fields enforced at DB level

- **Default Values**: Reasonable defaults for status fields, dates, etc.

#### Triggers
- **Auto-Timestamp Triggers**: updated_at automatically updated on row modification
- **Cascading Triggers**: Stock ledger updates on transaction posting
- **Validation Triggers**: Complex validation logic enforced via triggers
- **Notification Triggers**: Real-time updates via Supabase Realtime

#### Unique Constraints
- **Code Uniqueness**: Document codes unique per company
  - Invoice codes
  - PO codes
  - Item codes
  - Customer codes
- **Composite Uniqueness**: Unique combinations (e.g., item + warehouse)

#### Foreign Keys
- **Referential Integrity**: FK constraints on all relationships
- **Cascade Rules**:
  - ON DELETE CASCADE: Delete child records when parent deleted (rare)
  - ON DELETE RESTRICT: Prevent parent deletion if children exist (common)
  - ON DELETE SET NULL: Nullify FK when parent deleted (specific cases)
- **ON UPDATE CASCADE**: Update FKs when parent ID changes

#### Versioning
- **Optimistic Concurrency Control**: Version number on sensitive entities
- **Version Check**: Update only if version matches
- **Conflict Detection**: Prevents lost updates in concurrent scenarios
- **Version Increment**: Automatic version++ on each update

---

### API Architecture

#### RESTful Design
- **Standard HTTP Methods**:
  - GET: Retrieve data
  - POST: Create new resources
  - PUT/PATCH: Update existing resources
  - DELETE: Delete resources
- **Resource-Based URLs**: `/api/{resource}/{id}`
- **Status Codes**: Proper HTTP status codes (200, 201, 400, 401, 403, 404, 500)
- **JSON Responses**: Consistent response format

#### Business Unit Context
- **JWT Claims**: BU information stored in JWT
- **Middleware Extraction**: API middleware extracts BU context
- **Query Filtering**: All queries filtered by user's accessible BUs
- **Context Isolation**: Data scoped to active BU

#### Permission Checking
- **Middleware-Based Authorization**:
  - Extract user permissions from JWT
  - Check required permission for operation
  - Return 403 if unauthorized
- **Resource-Level Permissions**: Different permissions per resource type
- **Operation-Level Permissions**: View, Create, Edit, Delete checked separately

#### Pagination
- **Page-Based Pagination**: `/api/items?page=1&limit=20`
- **Cursor-Based Pagination**: For large datasets (can be implemented)
- **Response Metadata**:
  ```json
  {
    "data": [...],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "totalPages": 8
    }
  }
  ```

#### Filtering
- **Date Range Filters**: `?start_date=2024-01-01&end_date=2024-12-31`
- **ID Filters**: `?customer_id=123&warehouse_id=456`
- **Status Filters**: `?status=active&type=sale`
- **Search Filters**: `?search=keyword` (searches across multiple fields)
- **Complex Filters**: Support for AND/OR logic (can be enhanced)

---

### Real-time Capabilities

#### Supabase Realtime
- **Enabled Tables**:
  - delivery_notes
  - pick_lists
  - (others can be enabled as needed)

- **Real-time Events**:
  - INSERT: New record created
  - UPDATE: Record modified
  - DELETE: Record deleted

#### Use Cases
- **Live Dashboard Updates**: Widgets update as transactions occur
- **Picking Status**: Pickers see real-time updates on tablets
- **Delivery Tracking**: Live delivery note status changes
- **Inventory Alerts**: Immediate reorder point breach notifications

#### Implementation
```typescript
// Subscribe to delivery note updates
supabase
  .channel('delivery_notes')
  .on('postgres_changes',
    { event: '*', schema: 'public', table: 'delivery_notes' },
    (payload) => {
      // Handle update
      invalidateQueries(['delivery_notes'])
    }
  )
  .subscribe()
```

#### Inventory Invalidation
- **React Query Integration**: Cache invalidation on real-time updates
- **Optimistic Updates**: UI updates immediately, then syncs with server
- **Conflict Resolution**: Handle concurrent updates gracefully

---

### Scalability Features

#### Database Optimization

**Strategic Indexing**:
- **Foreign Key Indexes**: All FK columns indexed
  - company_id, business_unit_id
  - item_id, warehouse_id, customer_id, supplier_id
- **Status Indexes**: Workflow status fields
  - invoice_status, po_status, dn_status
- **Date Indexes**: For period-based queries
  - invoice_date, transaction_date, created_at
- **Code Indexes**: For lookup operations
  - item_code, invoice_code, po_code
- **Composite Indexes**: For common query combinations
  - (company_id, status, date)
  - (item_id, warehouse_id)

**Denormalization for Performance**:
- **stock_ledger Table**: Denormalized for fast inventory queries
- **item_warehouse.current_stock**: Redundant but fast for availability checks
- **Generated Columns**: available_stock = current_stock - reserved_stock
- **Aggregate Tables**: Can add summary tables for reporting (future)

**Query Optimization**:
- **Select Only Needed Columns**: Avoid SELECT *
- **Joins**: Minimize joins in hot paths
- **Limit Results**: Always paginate large result sets
- **Explain Plans**: Monitor and optimize slow queries

#### Pagination for Large Data Sets
- **Default Limits**: All list endpoints have default page size
- **Max Limits**: Cap on maximum records per request
- **Cursor Pagination**: For infinite scroll scenarios (can be added)
- **Total Count**: Optional (can be expensive for very large tables)

#### Caching Strategy
- **React Query Caching**: Client-side caching with TTL
- **Stale-While-Revalidate**: Show cached data while fetching fresh
- **Cache Invalidation**: Invalidate on mutations
- **Server-Side Caching**: Can add Redis for API response caching (future)

#### Connection Pooling
- **Supabase Connection Pooler**: Manages database connections
- **Pool Size**: Configured based on usage
- **Connection Limits**: Prevents connection exhaustion

---

### Error Handling & Logging

#### API Error Responses
- **Consistent Format**:
  ```json
  {
    "error": "Error message",
    "code": "ERROR_CODE",
    "details": {...}
  }
  ```
- **Status Codes**: Appropriate HTTP status codes
- **Error Messages**: User-friendly messages
- **Validation Errors**: Detailed field-level errors from Zod

#### Client-Side Error Handling
- **Toast Notifications**: User-friendly error messages via Sonner
- **Form Validation**: Real-time validation with React Hook Form
- **Error Boundaries**: React error boundaries for component crashes

#### Logging
- **Console Logging**: Development environment
- **Structured Logging**: Can add production logging service (future)
- **Error Tracking**: Can integrate Sentry or similar (future)

---

## Configuration & Extensibility

### Custom Fields

**JSONB Columns on Key Entities**:
- items.custom_fields
- item_categories.custom_fields
- warehouses.custom_fields
- customers.custom_fields
- suppliers.custom_fields
- And more...

**Benefits**:
- **Schema Flexibility**: Add custom fields without migrations
- **Per-Company Customization**: Different companies can have different custom fields
- **Type Flexibility**: Store strings, numbers, booleans, arrays, objects
- **Queryable**: PostgreSQL JSONB supports indexing and querying

**Usage Examples**:
```sql
-- Store custom fields
UPDATE items
SET custom_fields = '{"warranty_period": "2 years", "vendor_code": "ABC123"}'
WHERE id = 123;

-- Query custom fields
SELECT * FROM items
WHERE custom_fields->>'warranty_period' = '2 years';
```

---

### Multi-Language Support

**Internationalization (i18n)**:
- **next-i18next**: i18n framework for Next.js
- **next-intl**: Alternative i18n solution
- **react-i18next**: React bindings

**Translation Files**:
- Organized by namespace (common, dashboard, reports, etc.)
- JSON format for easy management
- Language files stored in `/locales/{lang}/{namespace}.json`

**Language Switching**:
- User preference stored in user_preferences table
- Language selector in UI
- Persisted across sessions

**Supported Languages** (configurable):
- English (en)
- (Can add more languages as needed)

---

### Multi-Currency Support

**Currency in Invoices**:
- Currency field on sales_invoices table
- Exchange rate tracking
- Multi-currency reporting

**Currency in Analytics**:
- Currency conversion for consolidated reports
- Base currency for company
- Exchange rate tables (can be added)

**Implementation Status**:
- Partial support (fields exist)
- Full multi-currency reporting can be enhanced

---

### Theme Support

**next-themes Integration**:
- Dark mode and light mode support
- System preference detection
- Theme toggle in UI
- Persisted user preference

**Custom Themes**:
- Tailwind CSS custom color schemes
- CSS variables for theme customization
- Per-company branding (can be enhanced)

---

### Responsive Design

**Mobile-First Approach**:
- Tailwind CSS breakpoints (sm, md, lg, xl, 2xl)
- Mobile-optimized layouts
- Touch-friendly UI elements

**Tablet Support**:
- Dedicated tablet interfaces for:
  - POS transactions
  - Pick list operations
  - Warehouse operations

**Desktop Optimization**:
- Full-featured desktop layouts
- Multi-column displays
- Advanced data tables

---

### Extensibility Points

#### API Extensions
- **Custom API Routes**: Easy to add new endpoints
- **Middleware Hooks**: Custom middleware for business logic
- **Server Actions**: Next.js server actions for mutations

#### UI Extensions
- **Component Library**: shadcn/ui components easy to extend
- **Custom Components**: Add custom components as needed
- **Dashboard Widgets**: Pluggable widget system (can be enhanced)

#### Database Extensions
- **Supabase Functions**: Database functions for complex logic
- **Triggers**: Custom triggers for automation
- **Views**: Custom views for reporting

#### Business Logic Extensions
- **Workflow Customization**: Document workflows can be configured
- **Validation Rules**: Custom validation via Zod schemas
- **Calculation Logic**: Custom pricing, commission, tax logic

---

## Future Enhancement Opportunities

### Technical Debt & Improvements
1. **Comprehensive Test Suite**: Unit, integration, E2E tests
2. **API Documentation**: OpenAPI/Swagger documentation
3. **Error Tracking**: Sentry or similar integration
4. **Performance Monitoring**: APM tools integration
5. **Advanced Caching**: Redis integration for API caching
6. **Background Jobs**: Queue system for long-running tasks
7. **Audit Log**: Detailed change tracking for all entities
8. **Data Warehouse**: Separate OLAP database for analytics

### Feature Enhancements
1. **Advanced Reporting**: More comprehensive reports (see Report Recommendations document)
2. **Budget Management**: Budget creation and tracking
3. **Multi-Currency**: Full multi-currency support
4. **Advanced Pricing**: Price lists, volume discounts, customer-specific pricing
5. **CRM Features**: Lead management, opportunity tracking
6. **HR Module**: Payroll, attendance, leave management
7. **Asset Management**: Fixed asset tracking
8. **Project Management**: Project costing and tracking

---

## Conclusion

This ERP system represents a **mature, well-architected enterprise application** with:

✅ **Comprehensive Module Coverage** across all core business functions
✅ **Production-Ready Architecture** with security, scalability, and performance
✅ **Modern Technology Stack** with latest frameworks and best practices
✅ **Real-time Capabilities** for operational efficiency
✅ **Extensible Design** for future growth and customization

The system is ready for production use and can scale to support growing business needs. The architecture supports easy addition of new modules, reports, and features as requirements evolve.

---

**Document Version**: 1.0
**Last Updated**: 2024-02-24
**Author**: System Analysis & Architecture Review
