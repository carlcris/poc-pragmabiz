# Module Documentation

This folder contains comprehensive documentation for each functional module of the ERP system.

## Available Modules

### [00-PROJECT-OVERVIEW.md](00-PROJECT-OVERVIEW.md)
**System Overview & Architecture**

Start here! This document provides:
- Executive summary of the ERP system
- Technology stack details
- System architecture diagrams
- List of all modules and their purposes
- Project structure and organization
- Development standards and workflows
- Recent major changes

**Audience**: All developers (required reading)

---

### [01-AUTHENTICATION-AUTHORIZATION.md](01-AUTHENTICATION-AUTHORIZATION.md)
**Authentication & Authorization Module**

Complete guide to user authentication and permission system:
- JWT-based authentication flow
- Session management
- Role-Based Access Control (RBAC)
- 73+ resources and 40+ capabilities
- Permission resolution and caching
- Business unit multi-tenancy
- API route protection patterns
- UI component permission checks
- Database schema for users, roles, permissions

**Use this when**:
- Implementing login/logout
- Adding permission checks
- Creating new roles
- Managing user access
- Implementing multi-tenant features

**Key APIs**: `/api/auth/*`, `/api/rbac/*`

---

### [02-INVENTORY-MANAGEMENT.md](02-INVENTORY-MANAGEMENT.md)
**Inventory Management Module**

Comprehensive inventory tracking and warehouse management:
- Item master data management
- Multi-warehouse inventory
- Location-level stock tracking
- Multiple units of measure per item
- Stock transactions and ledger
- Stock adjustments and transfers
- Stock requisitions and requests
- Reorder point management
- Real-time stock calculations (on hand, reserved, available)
- Stock valuation using moving average cost

**Use this when**:
- Managing products and items
- Tracking warehouse inventory
- Handling stock movements
- Implementing stock adjustments
- Creating reorder alerts
- Building inventory reports

**Key APIs**: `/api/items/*`, `/api/warehouses/*`, `/api/stock-adjustments/*`, `/api/stock-transfers/*`, `/api/reorder/*`

**Key Services**: `stockTransactionService.ts`, `locationService.ts`

---

### [03-SALES-MANAGEMENT.md](03-SALES-MANAGEMENT.md)
**Sales Management Module**

Complete sales workflow from quotation to payment:
- Customer master data
- Quotations with partial fulfillment tracking
- Sales orders linked to quotations
- Delivery notes with picking and scan receiving
- Invoicing with automatic GL posting
- Payment tracking
- Commission calculations
- Sales analytics

**Sales Workflow**:
```
Quotation → Sales Order → Delivery Note → Invoice → Payment
```

**Use this when**:
- Managing customers
- Creating sales quotations
- Processing sales orders
- Handling deliveries
- Generating invoices
- Recording payments
- Calculating commissions

**Key APIs**: `/api/customers/*`, `/api/quotations/*`, `/api/sales-orders/*`, `/api/delivery-notes/*`, `/api/invoices/*`

**Key Services**: `arPosting.ts` (Accounts Receivable posting)

---

### [04-PURCHASING-MANAGEMENT.md](04-PURCHASING-MANAGEMENT.md)
**Purchasing Management Module**

Vendor management and procurement workflow:
- Supplier master data (company-scoped as of June 2025)
- Purchase orders with approval workflow
- Purchase receipts (tablet-optimized)
- Goods Receipt Notes (GRN) with multi-box receiving
- Stock requisitions for internal requests
- Load lists (consolidating multiple requisitions)
- Damaged item tracking and reporting
- Purchase price tracking for inventory costing

**Purchasing Workflow**:
```
Stock Requisition → Load List → Purchase Order → GRN → Purchase Receipt
```

**Use this when**:
- Managing suppliers and vendors
- Creating purchase orders
- Receiving goods from suppliers
- Processing GRNs with multi-box tracking
- Handling damaged items
- Managing stock requisitions and load lists

**Key APIs**: `/api/suppliers/*`, `/api/purchase-orders/*`, `/api/purchase-receipts/*`, `/api/grns/*`, `/api/load-lists/*`, `/api/stock-requisitions/*`

---

### [05-ACCOUNTING.md](05-ACCOUNTING.md)
**Accounting Integration Module**

Financial management and GL integration:
- Chart of accounts with hierarchical structure
- Journal entries with validation
- General ledger transaction tracking
- Trial balance reporting
- Automatic GL posting for:
  - Accounts Receivable (invoices, payments)
  - Accounts Payable (purchase invoices)
  - Cost of Goods Sold (inventory consumption)
  - Point of Sale transactions

**Use this when**:
- Managing chart of accounts
- Creating manual journal entries
- Reviewing general ledger
- Understanding automatic GL posting
- Generating trial balance
- Implementing accounting integration

**Key APIs**: `/api/accounting/*`, `/api/journal-entries/*`

**Key Services**: `arPosting.ts`, `apPosting.ts`, `cogsPosting.ts`, `posPosting.ts`, `journalValidation.ts`

---

### [06-MANUFACTURING.md](06-MANUFACTURING.md)
**Manufacturing Module**

Production and transformation management:
- Bill of Materials (BOM) templates
- Transformation orders (stock transformations/production)
- Cost allocation and redistribution
- Lineage tracking for transformed items
- Frame job orders (custom assembly/framing)
- Workstation management
- Atomic transactional operations

**Use this when**:
- Creating BOM templates
- Executing production runs
- Performing stock transformations
- Tracking product lineage
- Managing custom assembly jobs
- Calculating production costs
- Handling quality recalls

**Key APIs**: `/api/transformations/*`, `/api/frame-jobs/*`, `/api/workstations/*`

**Key Services**: `transformationService.ts`

---

### [07-REPORTING-ANALYTICS.md](07-REPORTING-ANALYTICS.md)
**Reporting & Analytics Module**

Business intelligence and reporting:
- Real-time dashboard widgets with KPIs
- Inventory reports (valuation, aging, movement, location/batch details)
- Sales analytics (by employee, location, time period, customer)
- Purchasing analytics (supplier spend, outstanding requisitions, capacity)
- Financial reports (A/R aging, ledger summaries)
- Transformation efficiency metrics
- Permission-based report access
- Export capabilities (Excel, PDF, CSV)

**Use this when**:
- Building dashboard widgets
- Generating operational reports
- Creating analytical insights
- Exporting data
- Implementing KPI tracking
- Developing custom reports

**Key APIs**: `/api/reports/*`, `/api/analytics/*`, `/api/dashboard/*`

---

### [08-POINT-OF-SALE.md](08-POINT-OF-SALE.md)
**Point of Sale Module**

Retail transaction system for cash sales:
- Cash sales transactions with multi-payment methods
- Receipt generation (print and email)
- Real-time inventory integration
- Automatic accounting integration (GL posting)
- Customer lookup and sales history
- Barcode scanning for product entry
- Discount application
- Transaction voiding with reversal
- Multi-station support

**Use this when**:
- Implementing POS sales
- Processing cash transactions
- Generating receipts
- Integrating payment methods
- Building cashier interface
- Setting up POS stations

**Key APIs**: `/api/pos/*`

**Key Services**: `posPosting.ts`, `posStockService.ts`

---

### [09-MOBILE-APP.md](09-MOBILE-APP.md)
**Mobile App Module**

Native React Native Expo mobile app for warehouse operations:
- React Native Expo mobile app (iOS/Android)
- Warehouse picking workflows
- GRN receiving on mobile devices
- Barcode/QR code scanning
- Photo capture for damaged items
- Digital signatures for deliveries
- Location-based warehouse operations
- GPS tracking for deliveries

**Use this when**:
- Building mobile warehouse features
- Creating picking workflows
- Developing mobile receiving
- Integrating barcode scanning
- Capturing photos on mobile

**Key APIs**: `/api/mobile/*`

**Mobile App**: `apps/mobile/` (React Native Expo)

---

### [10-NOTIFICATIONS.md](10-NOTIFICATIONS.md)
**Notification System Module**

Real-time workflow notifications and user alerts:
- Event-driven workflow notifications
- Business unit broadcasting
- Read/unread status tracking
- User-specific and group notifications
- Notification metadata for contextual information
- Integration with all major workflows
- Pick lists, stock requests, delivery notes
- Approval and status change notifications

**Use this when**:
- Implementing workflow notifications
- Notifying users of business events
- Broadcasting to business units
- Creating notification UI components
- Integrating new workflows with notifications

**Key APIs**: `/api/notifications/*`

**Key Services**: `workflow-notifications.ts`

---

## Module Documentation Structure

Each module document follows this consistent structure:

1. **Overview** - Module purpose and key features
2. **Architecture** - How the module is structured
3. **Core Concepts** - Key entities and workflows
4. **Database Schema** - Tables, relationships, and fields
5. **API Reference** - Available endpoints with examples
6. **Services** - Business logic services
7. **Common Workflows** - Step-by-step process flows
8. **UI Components** - Key React components
9. **Reports** - Available reports (if applicable)
10. **Troubleshooting** - Common issues and solutions
11. **Related Documentation** - Links to plans and specs
12. **Migration History** - Relevant database migrations

## How to Use This Documentation

### For New Developers
1. Start with [00-PROJECT-OVERVIEW.md](00-PROJECT-OVERVIEW.md)
2. Read [01-AUTHENTICATION-AUTHORIZATION.md](01-AUTHENTICATION-AUTHORIZATION.md)
3. Focus on the module(s) you'll be working on
4. Reference as needed during development

### For Bug Fixes
1. Identify which module the bug is in
2. Read that module's documentation
3. Check the **API Reference** for endpoint details
4. Review **Database Schema** for data relationships
5. Check **Troubleshooting** section

### For New Features
1. Identify which module(s) are affected
2. Read module documentation thoroughly
3. Review **Common Workflows** for similar processes
4. Check **Related Documentation** for implementation plans
5. Look at similar existing code as examples

### For Understanding Workflows
1. Find the module that owns the workflow
2. Read **Core Concepts** section
3. Follow **Common Workflows** step-by-step
4. Check **API Reference** for implementation details

## Documentation Standards

### When to Update Module Documentation

Update module documentation when:
- Adding new API endpoints
- Modifying database schema
- Changing workflows
- Adding new services
- Implementing new features
- Fixing significant bugs that affect understanding

### How to Update

1. Find the relevant module document
2. Update the appropriate section(s)
3. Maintain consistent formatting
4. Add examples where helpful
5. Update related documentation links
6. Update the main [DOCUMENTATION-INDEX.md](../DOCUMENTATION-INDEX.md)

## Related Documentation

- **[Documentation Index](../DOCUMENTATION-INDEX.md)** - Central navigation hub
- **[Developer Onboarding Guide](../guides/DEVELOPER-ONBOARDING.md)** - Setup and getting started
- **[Engineering Rules](../rules/)** - Mandatory development standards
- **[Implementation Plans](../plans/)** - Feature implementation details
- **[Product Requirements](../product-requirements.md)** - Business requirements

## Contributing to Documentation

### Adding New Module Documentation

When a new module is created:

1. Create new file: `0X-MODULE-NAME.md` (next number in sequence)
2. Follow the standard structure (see above)
3. Include all sections with detailed content
4. Add examples and code snippets
5. Link from this README
6. Update [DOCUMENTATION-INDEX.md](../DOCUMENTATION-INDEX.md)

### Documentation Review Checklist

Before finalizing module documentation:

- [ ] All sections present and complete
- [ ] Code examples tested and accurate
- [ ] API endpoints documented with request/response
- [ ] Database schema accurate and up-to-date
- [ ] Workflows clear and step-by-step
- [ ] Troubleshooting section includes common issues
- [ ] Links to related docs working
- [ ] Examples use realistic data
- [ ] Consistent formatting and style

## Need Help?

If you can't find what you're looking for:

1. Check the [Documentation Index](../DOCUMENTATION-INDEX.md)
2. Search across all documentation files
3. Look at similar code in the codebase
4. Review implementation plans in `docs/plans/`
5. Ask the team

---

**Last Updated**: June 14, 2025

**Total Modules Documented**: 10/10 ✅

**Status**: Complete - All core modules fully documented (includes Notification System)
