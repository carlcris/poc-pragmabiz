# PRODUCT REQUIREMENTS DOCUMENT (PRD)

**System:** Sales & Inventory System (ERP-Ready) 
**Version:** v1.0 


## 1. OVERVIEW & OBJECTIVES

### Goal

To design and implement a modular Sales and Inventory Management System that serves as the foundation for a full Enterprise Resource Planning (ERP) platform.

### Objectives

- Manage and track product inventory across warehouses in real-time.
- Handle the complete sales process from quotation to payment.
- Maintain data integrity across items, customers, and transactions.
- Ensure modularity for seamless future integration (Procurement, Finance, CRM, HR, etc.).
- Provide insightful business analytics for decision-making.

## 2. SCOPE

### In-scope (Phase 1)

- Inventory Management
- Sales Management
- Master Data Management (shared module)
- Basic Reporting
- Role-based access control

### Out-of-scope (future phases)

- Procurement
- Accounting / Finance
- Manufacturing
- HR, Payroll, CRM

## 3. MODULES & SUBMODULES

### 3.1 Inventory Module

| Submodule | Description | Core Objective |
|-----------|-------------|----------------|
| Item Master | Centralized list of all products, ingredients, or materials | Single source of truth for all items |
| Warehouse Management | Define storage locations, bins, and stock per location | Multi-location stock control |
| Stock Transactions | Record all movements (in/out/transfer/adjustments) | Maintain real-time stock levels |
| Reorder Management | Define reorder levels and alerts | Avoid stockouts |
| Inventory Valuation | Compute inventory cost (FIFO, LIFO, Avg.) | Accurate costing |
| Batch/Serial Tracking (optional) | Track unique identifiers or expiry | For regulated goods |
| Recipe / BOM (optional) | Define items composed of other items | Supports manufacturing or restaurants |

### 3.2 Sales Module

| Submodule | Description | Core Objective |
|-----------|-------------|----------------|
| Customer Master | Manage customer profiles and payment terms | Centralized customer info |
| Price Lists & Discounts | Set tiered pricing and promotions | Pricing flexibility |
| Sales Quotation | Draft pre-sale offers | Supports customer negotiation |
| Sales Order | Confirmed sales commitment | Drives fulfillment workflow |
| Delivery Note | Records physical delivery | Triggers stock movement |
| Sales Invoice | Billing document linked to order and delivery | Revenue recognition |
| Payment Collection | Records payment receipts | Links to finance later |
| Sales Returns & Credit Notes | Manage returned goods | Adjust stock and customer balance |

## 4. CORE FEATURES & FUNCTIONAL REQUIREMENTS

### 4.1 Inventory Features

- Create, edit, and categorize items (multiple categories, units).
- Record stock in/out transactions with reason codes.
- Support transfers between warehouses.
- Set and monitor reorder levels; trigger notifications.
- Track item costs and stock valuation in real-time.
- Support bulk import/export (CSV/Excel).
- Generate stock reports (by item, warehouse, date range).

### 4.2 Sales Features

- Manage customer information and payment terms.
- Create quotations, convert to orders, deliveries, and invoices.
- Handle partial deliveries and partial payments.
- Automatically adjust inventory upon delivery confirmation.
- Manage taxes, discounts, and additional charges.
- Generate invoices and receipts with sequential numbering.
- Handle sales returns and credit memos.
- Provide sales performance dashboards.

### 4.3 Shared Features

- Role-based access control (admin, sales, inventory, viewer).
- Audit trail for all transactions.
- Configurable document numbering series.
- Search and filter across modules.
- Notification system (e.g., low stock, overdue payment).

## 5. BUSINESS RULES

### Inventory Rules

- Stock cannot go below zero unless "allow negative stock" is enabled.
- Each stock transaction must reference a document (e.g., PO, delivery).
- Only authorized users can make adjustments.
- Reorder alerts trigger once stock <= reorder level.
- Valuation method must be consistent for reporting periods.

### Sales Rules

- Stock deduction occurs only after delivery confirmation.
- Sales Order status changes dynamically: Draft -> Confirmed -> Delivered -> Invoiced -> Paid.
- Tax and discount configurations must be centralized.
- Returns require approval before reversing stock.
- Credit limits and payment terms must be respected (future link to finance).

## 6. USER ROLES & PERMISSIONS

| Role | Responsibilities | Access Scope |
|------|------------------|--------------|
| Admin | Manage settings, users, and all data | Full access |
| Sales Officer | Create orders, invoices, collect payments | Sales module only |
| Inventory Officer | Manage stock, adjustments, transfers | Inventory module only |
| Approver / Manager | Approve discounts, adjustments, returns | Restricted approval access |
| Viewer / Auditor | View-only reports and logs | Read-only access |

## 7. DEPENDENCIES & INTEGRATIONS

### Current Integrations

None (standalone modules communicating through shared data models).

### Future Integrations (ERP expansion plan)

| Module | Integration Purpose |
|--------|-------------------|
| Procurement | Auto-update inventory from supplier receipts |
| Accounting | Map invoices to journal entries |
| CRM | Sync customer records and leads |
| Manufacturing | Consume BOM and finished goods |
| HR | Link sales commissions to payroll |

## 8. REPORTS & ANALYTICS

| Report | Description |
|--------|-------------|
| Sales Summary Report | Sales by date, product, customer, region |
| Pending Orders Report | Orders not yet delivered or invoiced |
| Stock Movement Report | Detailed ledger of stock ins/outs |
| Reorder Report | Items below reorder point |
| Item Valuation Report | Current value per item using selected costing method |
| Sales Performance Dashboard | Visual charts: revenue trends, top products, top customers |

## 9. SCALABILITY NOTES (ERP-Ready Design)

| Area | Scalability Strategy |
|------|---------------------|
| Data Model | Modular tables with shared master data |
| APIs | Each module exposes standard CRUD endpoints |
| Workflows | Each transaction supports approval status |
| Multi-company / Branch | Add Company/Branch ID on all records |
| Multi-currency / Localization | Configurable currency and tax logic |
| Extensibility | Custom fields, tags, and metadata supported |
| Reporting Layer | Compatible with BI tools (Power BI, Metabase, etc.) |

## 10. SALES ANALYTICS MODULE (Phase 2)

### 10.1 Overview

Sales Analytics provides comprehensive insights into sales performance across employees, locations, products, and time periods. This module supports data-driven decision-making and commission management for sales teams.

### 10.2 Key Features

#### Employee/Sales Agent Management
- Employee master data with role-based assignment (admin, manager, sales_agent, etc.)
- Configurable commission rates per employee (default 5%, customizable by admin/manager)
- Distribution territory assignment (city and region/state based on Philippines Mindanao locations)
- Support for multiple territory assignments per employee
- Commission calculation and tracking (calculation only - payroll integration in future phase)

#### Sales Distribution Tracking
- Track sales by employee/sales agent
- Track sales by location (city and region/state)
- Track sales by time period (daily, weekly, monthly, quarterly, yearly)
- Support for split commissions (multiple agents per transaction)
- Real-time aggregation of sales metrics

#### Analytics Dashboard
- **Main Dashboard Widgets:**
  - Today's Sales (real-time)
  - My Sales (for sales agents - own performance)
  - Top Agent (highest sales)
  - Recent Sales Activity (last 10 transactions)

- **Dedicated Analytics Page (`/reports/sales-analytics`):**
  - **Overview Tab:**
    - Total Sales, Total Commissions, Active Agents, Average Order Value
    - Sales trend chart (last 30 days line chart)
    - Top 5 Agents (bar chart)
    - Top 5 Locations (bar chart)

  - **By Time Tab:**
    - Configurable granularity (daily, weekly, monthly)
    - Time series chart with period comparison
    - Sortable data table with date, sales, transactions, average

  - **By Employee Tab:**
    - Employee performance leaderboard
    - Sales by agent (bar chart)
    - Commission distribution (pie chart)
    - Detailed employee breakdown view

  - **By Location Tab:**
    - View by City or Region/State
    - Location performance table
    - Sales by city (bar chart)
    - Sales by region (pie chart)

#### Commission Management
- Automatic commission calculation on invoice confirmation
- Support for equal split or custom percentage split
- Commission dashboard for agents (own earnings)
- Commission breakdown by invoice
- Pending vs paid commission tracking (for future payroll integration)

#### Export Functionality
- Export to Excel (.xlsx) - multi-sheet workbooks with summary and detailed data
- Export to PDF - formatted reports with charts and tables
- Filters apply to exports (date range, employee, location)

### 10.3 User Access Control

| Role | Access Level | Permissions |
|------|-------------|-------------|
| Admin | Full Access | View all analytics, manage employees, configure commission rates, export reports |
| Manager | Management View | View all analytics, view team performance, export reports, assign territories |
| Sales Agent | Personal View | View own sales, own commission, own performance metrics |

### 10.4 Location Strategy

**Philippines Mindanao Focus:**
- All addresses standardized to Philippines (Mindanao region)
- Sales location determined by employee's assigned territory (primary approach)
- Fallback to customer address if employee has no assigned territory
- Reporting aggregated by:
  - **City level:** Davao City, Cagayan de Oro City, General Santos City, etc.
  - **Region/State level:** Davao Region, Northern Mindanao, SOCCSKSARGEN, etc.

### 10.5 Technical Implementation

**Data Model:**
- `employees` - Employee master data with commission rates
- `employee_distribution_locations` - Territory assignments
- `invoice_employees` - Invoice-employee association (split commissions)
- `sales_distribution` - Pre-aggregated daily statistics (performance optimization)

**API Endpoints:**
- `GET /api/analytics/sales/overview` - Summary KPIs
- `GET /api/analytics/sales/by-day` - Daily breakdown
- `GET /api/analytics/sales/by-employee` - Employee performance
- `GET /api/analytics/sales/by-location` - Location breakdown
- `GET /api/analytics/sales/employee/{id}` - Employee details
- `GET /api/analytics/sales/export` - Export functionality
- `GET /api/employees` - Employee management
- `POST /api/employees/{id}/territories` - Territory assignment

**Charts & Visualization:**
- Library: Recharts
- Chart Types: Line charts, bar charts, pie/donut charts, KPI cards

**Real-time Updates:**
- Analytics update in real-time on invoice confirmation
- React Query with optimized caching (5 min staleTime)
- Background aggregation to `sales_distribution` table

### 10.6 Implementation Phases

**Phase 2.1: Foundation (Week 1)**
- Create employee, territory, and analytics tables
- Data cleanup: Standardize all addresses to Philippines (Mindanao)
- Historical data backfill: Assign employees to existing invoices
- Implement commission calculation logic

**Phase 2.2: Core Analytics (Week 2-3)**
- Build analytics API endpoints
- Create dashboard widgets (today's sales, top agent)
- Implement main analytics page with 4 tabs
- Add date range and filter controls

**Phase 2.3: Advanced Features (Week 4)**
- Export to Excel and PDF
- Commission dashboard for agents
- Employee territory management UI
- Manager view vs agent view implementation

**Future Phases (Not in Current Scope):**
- Van/vehicle tracking per transaction
- Payroll integration with commission payment tracking
- Advanced territory hierarchy (regions → cities → barangays)
- Geolocation-based sales tracking

### 10.7 Success Metrics

- Sales agents can view their daily/monthly sales and commission
- Managers can identify top performers and underperforming territories
- Admin can track overall sales trends and make data-driven decisions
- Commission calculations are accurate and auditable
- Reports load within 2 seconds for typical date ranges

### 10.8 Future Integrations

| Module | Integration Purpose |
|--------|-------------------|
| HR & Payroll | Link commission calculations to payroll processing |
| Accounting | Journal entries for commission expenses |
| CRM | Link sales performance to lead conversion rates |
| Procurement | Correlate sales trends with inventory reordering |

## 11. NEXT PHASE RECOMMENDATIONS

After Sales, Inventory, and Analytics go live:

- Complete **HR & Payroll Module** - for full employee lifecycle and commission payment processing.
- Add **Procurement Module** - to automate stock replenishment.
- Integrate **Basic Accounting Layer** - to track journals and balances.
- Add **Workflow Engine** - for approval routing and audit compliance.
- Develop **CRM Integration** - for customer lifecycle management.
- Enhance **Analytics** - add predictive analytics and forecasting.
