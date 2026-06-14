# ERP System - Documentation Index

## Quick Start

### New Developers
1. **Start Here**: [Project Overview](kb/00-PROJECT-OVERVIEW.md)
2. **Setup Environment**: [Developer Onboarding Guide](guides/DEVELOPER-ONBOARDING.md)
3. **Learn the Basics**: Review module documentation for your assigned area
4. **Development Rules**: [Engineering Rules](rules/engineering-rule.md)

### Bug Fixes
1. Identify the affected module in [Module Documentation](#module-documentation)
2. Check [API Reference](#api-reference) for endpoint details
3. Review [Database Schema](#database-schema) for data relationships
4. Search [Migration History](#migrations) before making DB changes

### New Features
1. Review [Product Requirements](product-requirements.md)
2. Check [Implementation Plans](#implementation-plans)
3. Review similar existing features in [Module Documentation](#module-documentation)
4. Follow [Development Rules](rules/)
5. Create implementation plan before coding

## Core Documentation

### Module Documentation
Comprehensive guides for each functional module of the system.

| Module | Description | Location |
|--------|-------------|----------|
| **Project Overview** | System architecture, tech stack, project structure | [kb/00-PROJECT-OVERVIEW.md](kb/00-PROJECT-OVERVIEW.md) |
| **Authentication & Authorization** | User auth, permissions, RBAC, business units | [kb/01-AUTHENTICATION-AUTHORIZATION.md](kb/01-AUTHENTICATION-AUTHORIZATION.md) |
| **Inventory Management** | Items, warehouses, stock tracking, transactions | [kb/02-INVENTORY-MANAGEMENT.md](kb/02-INVENTORY-MANAGEMENT.md) |
| **Sales Management** | Customers, quotations, sales orders, invoices | [kb/03-SALES-MANAGEMENT.md](kb/03-SALES-MANAGEMENT.md) |
| **Purchasing Management** | Suppliers, purchase orders, GRNs, requisitions | [kb/04-PURCHASING-MANAGEMENT.md](kb/04-PURCHASING-MANAGEMENT.md) |
| **Accounting** | Chart of accounts, GL posting, journal entries | [kb/05-ACCOUNTING.md](kb/05-ACCOUNTING.md) |
| **Manufacturing** | BOM, transformation orders, workstations | [kb/06-MANUFACTURING.md](kb/06-MANUFACTURING.md) |
| **Reporting & Analytics** | Dashboards, reports, KPIs | [kb/07-REPORTING-ANALYTICS.md](kb/07-REPORTING-ANALYTICS.md) |
| **Point of Sale** | Cash sales, receipts, payment processing | [kb/08-POINT-OF-SALE.md](kb/08-POINT-OF-SALE.md) |
| **Mobile App** | Native mobile app for warehouse picking and receiving | [kb/09-MOBILE-APP.md](kb/09-MOBILE-APP.md) |
| **Notifications** | Workflow notifications, business unit broadcasting | [kb/10-NOTIFICATIONS.md](kb/10-NOTIFICATIONS.md) |

### Developer Guides

| Guide | Description | Location |
|-------|-------------|----------|
| **Developer Onboarding** | Complete setup guide for new developers | [guides/DEVELOPER-ONBOARDING.md](guides/DEVELOPER-ONBOARDING.md) *(To be created)* |
| **API Development Guide** | How to create new API endpoints | [guides/API-DEVELOPMENT.md](guides/API-DEVELOPMENT.md) *(To be created)* |
| **Database Migration Guide** | Creating and managing migrations | [guides/MIGRATION-GUIDE.md](guides/MIGRATION-GUIDE.md) *(To be created)* |
| **UI Component Guide** | Creating consistent UI components | [guides/UI-COMPONENT-GUIDE.md](guides/UI-COMPONENT-GUIDE.md) *(To be created)* |
| **Testing Guide** | Unit, integration, and E2E testing | [guides/TESTING-GUIDE.md](guides/TESTING-GUIDE.md) *(To be created)* |
| **Deployment Guide** | Production deployment process | [guides/DEPLOYMENT-GUIDE.md](guides/DEPLOYMENT-GUIDE.md) *(To be created)* |

### Development Rules

Critical rules that MUST be followed during development.

| Rule | Description | Location |
|------|-------------|----------|
| **Engineering Rule** | Senior engineer mindset, mandatory standards | [rules/engineering-rule.md](rules/engineering-rule.md) |
| **Scalable API Design** | List, search, pagination patterns | [rules/scalable-api-design-rule.md](rules/scalable-api-design-rule.md) |
| **Granular Permissions** | Permission system implementation | [rules/granular-permissions-rule.md](rules/granular-permissions-rule.md) |

## API Reference

### API Endpoint Catalog

Organized by module. Each endpoint includes:
- HTTP method and path
- Required permissions
- Request/response schemas
- Example usage

| Module | Documentation |
|--------|---------------|
| **Authentication** | [kb/01-AUTHENTICATION-AUTHORIZATION.md#api-reference](kb/01-AUTHENTICATION-AUTHORIZATION.md#api-reference) |
| **Inventory** | [kb/02-INVENTORY-MANAGEMENT.md#api-reference](kb/02-INVENTORY-MANAGEMENT.md#api-reference) |
| **Sales** | [kb/03-SALES-MANAGEMENT.md#api-reference](kb/03-SALES-MANAGEMENT.md#api-reference) |
| **Purchasing** | [kb/04-PURCHASING-MANAGEMENT.md#api-reference](kb/04-PURCHASING-MANAGEMENT.md#api-reference) |
| **Accounting** | [kb/05-ACCOUNTING.md#api-reference](kb/05-ACCOUNTING.md#api-reference) |
| **Manufacturing** | [kb/06-MANUFACTURING.md#api-reference](kb/06-MANUFACTURING.md#api-reference) |
| **Reporting** | [kb/07-REPORTING-ANALYTICS.md#api-reference](kb/07-REPORTING-ANALYTICS.md#api-reference) |
| **Point of Sale** | [kb/08-POINT-OF-SALE.md#api-reference](kb/08-POINT-OF-SALE.md#api-reference) |
| **Mobile App** | [kb/09-MOBILE-APP.md#api-reference](kb/09-MOBILE-APP.md#api-reference) |
| **Notifications** | [kb/10-NOTIFICATIONS.md#api-reference](kb/10-NOTIFICATIONS.md#api-reference) |

### Common API Patterns

#### Pagination
```typescript
GET /api/resource?page=1&limit=20

Response:
{
  "data": [...],
  "total": 150,
  "page": 1,
  "limit": 20
}
```

#### Filtering
```typescript
GET /api/resource?search=term&category_id=uuid&is_active=true
```

#### Permission Checks
```typescript
import { requirePermission } from '@/lib/permissions'

export async function GET(request: NextRequest) {
  const user = await getUser(request)
  await requirePermission(user.id, 'resource_name', 'view')
  // ... business logic
}
```

## Database Schema

### Schema Documentation

| Resource | Description | Module |
|----------|-------------|--------|
| **Users & Roles** | User accounts, roles, permissions | [kb/01-AUTHENTICATION-AUTHORIZATION.md#database-schema](kb/01-AUTHENTICATION-AUTHORIZATION.md#database-schema) |
| **Inventory** | Items, warehouses, stock transactions | [kb/02-INVENTORY-MANAGEMENT.md#database-schema](kb/02-INVENTORY-MANAGEMENT.md#database-schema) |
| **Sales** | Customers, quotations, sales orders, invoices | [kb/03-SALES-MANAGEMENT.md#database-schema](kb/03-SALES-MANAGEMENT.md#database-schema) |
| **Purchasing** | Suppliers, purchase orders, GRNs | [kb/04-PURCHASING-MANAGEMENT.md#database-schema](kb/04-PURCHASING-MANAGEMENT.md#database-schema) |
| **Accounting** | Accounts, journal entries, GL postings | [kb/05-ACCOUNTING.md#database-schema](kb/05-ACCOUNTING.md#database-schema) |
| **Manufacturing** | Transformation templates and orders | [kb/06-MANUFACTURING.md#database-schema](kb/06-MANUFACTURING.md#database-schema) |

### ERD Diagrams

*(To be created)*

- Overall system ERD
- Module-specific ERDs
- Relationship diagrams

### Migrations

**Location**: `supabase/migrations/`

**Format**: `YYYYMMDDHHMMSS_description.sql`

**Key Migrations**:
- **Latest**: `20260611100000_make_suppliers_company_scoped.sql`
- **Recent**: `20260610101000_drop_items_cost_price.sql`
- **Recent**: `20260610100000_use_purchase_price_for_item_cost_runtime.sql`

**Migration Guide**: [guides/MIGRATION-GUIDE.md](guides/MIGRATION-GUIDE.md) *(To be created)*

**IMPORTANT**: Always search ALL migrations for existing definitions before modifying database objects. See [Engineering Rule](rules/engineering-rule.md#mandatory-database-migration-rule).

## Implementation Plans

Detailed plans for major features and refactors.

### Active Plans

| Plan | Status | Location |
|------|--------|----------|
| Tablet Warehouse Implementation | Active | [plans/TABLET_WAREHOUSE_IMPLEMENTATION_PLAN.md](plans/TABLET_WAREHOUSE_IMPLEMENTATION_PLAN.md) |
| Mobile Expo Migration | Active | [plans/mobile-expo-migration-plan.md](plans/mobile-expo-migration-plan.md) |

### Completed Plans

| Plan | Completed | Location |
|------|-----------|----------|
| Quotation Partial Fulfillment Refactor | June 2025 | [plans/quotation-partial-fulfillment-refactor-plan.md](plans/quotation-partial-fulfillment-refactor-plan.md) |
| Delivery Note Scan Receiving | June 2025 | [plans/delivery-note-receiving-implementation-plan.md](plans/delivery-note-receiving-implementation-plan.md) |
| Granular Permissions Rollout | 2025 | [plans/granular-permissions-rollout-plan.md](plans/granular-permissions-rollout-plan.md) |
| Multi-Business Unit Implementation | 2025 | [plans/multi-business-unit-implementation-plan.md](plans/multi-business-unit-implementation-plan.md) |
| RBAC Implementation | 2024 | [plans/rbac-implementation-plan.md](plans/rbac-implementation-plan.md) |
| Transformation System | 2024 | [plans/transformation-final-summary.md](plans/transformation-final-summary.md) |

### Archived Plans

| Plan | Location |
|------|----------|
| Inventory Enhancement Implementation | [inv-enhancement-impl-plan.md](inv-enhancement-impl-plan.md) |
| Inventory Normalization | [inv-normalization-implementation-plan.md](inv-normalization-implementation-plan.md) |
| Item-Specific UOM Plan | [item-specific-uom-plan.md](item-specific-uom-plan.md) |
| Location Plan | [plans/inv-location-plan.md](plans/inv-location-plan.md) |
| POS Accounting Integration | [plans/pos-accounting-integration.md](plans/pos-accounting-integration.md) |

## Product Requirements

| Document | Description | Location |
|----------|-------------|----------|
| **Product Requirements** | Overall product vision and requirements | [product-requirements.md](product-requirements.md) |
| **Accounting PRD** | Accounting module requirements | [accounting-product-requirements.md](accounting-product-requirements.md) |
| **Inventory Enhancement PRD** | Inventory module enhancements | [inv-enhancement-prd.md](inv-enhancement-prd.md) |
| **Multi-Business Unit PRD** | Multi-tenant requirements | [plans/multi-business-unit-prd.md](plans/multi-business-unit-prd.md) |

## Workflows

Process workflows and standard operating procedures.

| Workflow | Description | Location |
|----------|-------------|----------|
| **Language Translation Workflow** | i18n translation process | [workflow/language-translation-workflow.md](workflow/language-translation-workflow.md) |
| **Lookup Data Permission Pattern** | Permission for dropdown data | [plans/lookup-data-permission-pattern.md](plans/lookup-data-permission-pattern.md) |

## Architecture Documents

| Document | Description | Location |
|----------|-------------|----------|
| **Domain Architecture** | Domain model and boundaries | [domain-architecture.md](domain-architecture.md) |
| **Database Design** | Database architecture | [database-design.md](database-design.md) |
| **Tech Stack** | Technology choices | [tech-stack.md](tech-stack.md) |
| **ERP System Analysis** | System analysis and design | [ERP-System-Analysis.md](ERP-System-Analysis.md) |

## Status & Progress Documents

| Document | Description | Location |
|----------|-------------|----------|
| **Epics** | High-level feature tracking | [epics.md](epics.md) |
| **Accounting Integration Status** | Accounting progress | [pos-accounting-integration-status.md](pos-accounting-integration-status.md) |
| **Purchasing Module Implementation** | Purchasing progress | [purchasing-module-implementation.md](purchasing-module-implementation.md) |
| **Transformation Progress** | Manufacturing progress | [plans/transformation-progress.md](plans/transformation-progress.md) |

## Troubleshooting

### Common Issues

Each module documentation includes a "Troubleshooting" section with common issues and solutions.

### Debug Tools

- **Authentication Debug**: `GET /api/auth/debug`
- **Permission Cache Clear**: API available in RBAC endpoints
- **Database Diagnostics**: Via Supabase Studio (http://localhost:54323)

### Support Resources

- Module documentation (troubleshooting sections)
- Implementation plans (lessons learned)
- Similar existing code as reference
- Development rules

## Project Statistics

- **API Routes**: 207 files
- **React Components**: 181 components
- **Custom Hooks**: 61 hooks
- **Database Migrations**: 194 total
- **Database Tables**: 50+ core tables
- **RPC Functions**: 30+ transactional operations
- **System Resources**: 73 for RBAC
- **Granular Capabilities**: 40+ UI-level permissions
- **Lines of Generated Types**: 11,095 (database.types.ts)

## Recent Changes

### June 2025
- Purchase price used as runtime item cost
- Suppliers made company-scoped
- Delivery note scan receiving with variance workflow
- Pick list completion refactored to atomic transaction
- Quotation partial fulfillment tracking

### Earlier 2025
- Native mobile app with React Native Expo
- Granular permission system rollout
- Multi-business unit support
- Accounting integration for AR/AP/COGS/POS

## Contributing

### Before Starting Work

1. Read the [Engineering Rule](rules/engineering-rule.md)
2. Review relevant module documentation
3. Check existing implementation plans
4. Search for similar existing code
5. Verify you have required permissions

### Development Checklist

- [ ] Read module documentation
- [ ] Check API design rules
- [ ] Search migration history (if DB changes)
- [ ] Implement with proper permissions
- [ ] Add/update translations (mandatory)
- [ ] Write tests
- [ ] Update documentation if needed

### Mandatory Rules

1. **Translation Rule**: All user-facing text must go through i18n system
2. **Migration Rule**: Search ALL migrations before modifying DB objects
3. **Permission Rule**: Every API route must check permissions
4. **Type Safety**: Use strict TypeScript, avoid `any`
5. **Atomic Transactions**: Use RPC for multi-table operations

## Documentation Maintenance

### Adding New Documentation

1. Create in appropriate folder (`kb/`, `guides/`, `plans/`)
2. Follow existing document structure
3. Update this index
4. Link from related documents

### Updating Documentation

1. Update the specific document
2. Update "Recent Changes" if significant
3. Check for related documents that need updates
4. Update this index if structure changes

## Need Help?

### For Technical Questions
1. Search module documentation
2. Check implementation plans
3. Review similar existing code
4. Check development rules

### For Architecture Questions
1. Review domain architecture
2. Check database design docs
3. Review module boundaries
4. Consult tech stack decisions

### For Process Questions
1. Check workflow documentation
2. Review development rules
3. Check implementation plans
4. Look at recent similar work

---

**Last Updated**: June 14, 2025

**Maintained By**: Development Team

**Documentation Version**: 1.0
