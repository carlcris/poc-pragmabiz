# ERP System - Project Overview

## Executive Summary

This is a comprehensive **Enterprise Resource Planning (ERP)** system built as a modern full-stack web application with mobile support. The system manages sales, inventory, purchasing, accounting, and manufacturing operations for businesses with multi-warehouse, multi-business-unit requirements.

## Project Information

- **Project Name**: ERP Frontend (poc-pragmabiz)
- **Version**: 0.1.0
- **Status**: Active Development
- **Type**: Full-Stack ERP Application
- **License**: Private - All rights reserved

## Technology Stack

### Frontend
- **Framework**: Next.js 15 (App Router)
- **UI Library**: React 19
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 3
- **Components**: shadcn/ui (Radix UI primitives)
- **Icons**: Lucide React
- **State Management**: Zustand 5
- **Server State**: React Query (@tanstack/react-query 5)
- **Forms**: React Hook Form 7 + Zod 4
- **Charts**: Recharts 3

### Backend & Database
- **Database**: PostgreSQL 17 (via Supabase)
- **Authentication**: Supabase Auth (JWT-based)
- **API**: Next.js API Routes (REST)
- **Real-time**: Supabase Realtime subscriptions

### Additional Tools
- **PDF Generation**: html2canvas + jsPDF
- **Email**: Nodemailer
- **QR/Barcode**: html5-qrcode, qrcode
- **Notifications**: Sonner
- **Internationalization**: next-intl

### Mobile
- **Framework**: React Native with Expo
- **Location**: `apps/mobile/`

## System Architecture

### Application Layers

```
┌─────────────────────────────────────────────────────────┐
│                    Presentation Layer                    │
│  Next.js Pages (App Router) + React Components          │
│  Mobile App (React Native Expo)                         │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│                   Application Layer                      │
│  API Routes + Middleware + Services                     │
│  Permission Resolver + Business Logic                   │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│                      Data Layer                          │
│  Supabase Client + RPC Functions                        │
│  Row-Level Security (RLS) Policies                      │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│                    Database Layer                        │
│  PostgreSQL 17 with 208 migrations                      │
│  Functions, Triggers, Views                             │
└─────────────────────────────────────────────────────────┘
```

### Multi-Tenancy Architecture
- **Company-level** scoping for primary business entities
- **Business Unit** scoping for departmental/location isolation
- **User access** controlled per business unit
- **RLS policies** enforce data isolation at database level

## Core Modules

The system is organized into 8 core functional modules:

### 1. Authentication & Authorization
Role-based access control with granular permissions, JWT authentication, and session management.
**See**: `docs/kb/01-AUTHENTICATION-AUTHORIZATION.md`

### 2. Inventory Management
Multi-warehouse inventory with location tracking, stock transactions, adjustments, transfers, and reorder management.
**See**: `docs/kb/02-INVENTORY-MANAGEMENT.md`

### 3. Sales Management
Complete sales workflow from quotations to invoices, delivery notes, and customer management.
**See**: `docs/kb/03-SALES-MANAGEMENT.md`

### 4. Purchasing Management
Vendor management, purchase orders, goods receipt, load lists, and requisition workflows.
**See**: `docs/kb/04-PURCHASING-MANAGEMENT.md`

### 5. Accounting Integration
Chart of accounts, journal entries, automatic GL posting for AR/AP/COGS/POS transactions.
**See**: `docs/kb/05-ACCOUNTING.md`

### 6. Manufacturing
BOM templates, transformation orders, custom assembly/framing jobs, and workstation management.
**See**: `docs/kb/06-MANUFACTURING.md`

### 7. Reporting & Analytics
Real-time dashboards, inventory reports, sales analytics, purchasing analytics, and efficiency metrics.
**See**: `docs/kb/07-REPORTING-ANALYTICS.md`

### 8. Point of Sale (POS) & Mobile
Mobile app for warehouse operations and POS transactions.
**See**: `docs/kb/08-POS-MOBILE.md`

## Project Structure

```
/
├── src/                          # Main application source
│   ├── app/                      # Next.js App Router
│   │   ├── (auth)/               # Auth routes (login, logout)
│   │   ├── (dashboard)/          # Protected dashboard routes
│   │   ├── api/                  # API route handlers (207 routes)
│   │   ├── mobile/               # Mobile-optimized pages
│   │   ├── pos/                  # Point of Sale interface
│   │   └── tablet/               # Tablet-optimized interface
│   ├── components/               # React components (181 total)
│   │   ├── ui/                   # shadcn/ui base components
│   │   ├── layout/               # Layout components
│   │   ├── inventory/            # Inventory feature components
│   │   ├── sales/                # Sales feature components
│   │   ├── purchasing/           # Purchasing feature components
│   │   ├── accounting/           # Accounting feature components
│   │   └── ...                   # Other module components
│   ├── hooks/                    # Custom React hooks (61 total)
│   ├── services/                 # Business logic services
│   │   ├── inventory/            # Inventory services
│   │   ├── accounting/           # Accounting posting services
│   │   └── permissions/          # Permission resolver
│   ├── stores/                   # Zustand state stores
│   │   ├── authStore.ts          # Auth state
│   │   ├── businessUnitStore.ts  # BU context
│   │   └── permissionStore.ts    # Permission cache
│   ├── types/                    # TypeScript definitions
│   │   ├── database.types.ts     # Generated Supabase types
│   │   └── supabase.ts           # Supabase client types
│   ├── lib/                      # Utilities and helpers
│   │   ├── supabase/             # Supabase clients
│   │   ├── i18n/                 # Translations
│   │   └── utils.ts              # Utility functions
│   ├── constants/                # App constants
│   ├── config/                   # Feature configuration
│   └── contexts/                 # React contexts
├── supabase/                     # Database & backend
│   ├── migrations/               # 208 SQL migrations
│   ├── functions/                # Edge functions
│   ├── seed.sql                  # Database seed data
│   └── config.toml               # Supabase local config
├── apps/                         # Sub-applications
│   └── mobile/                   # React Native Expo app
├── public/                       # Static assets
├── docs/                         # Project documentation
│   ├── kb/                  # Module-specific docs (this folder)
│   ├── api/                      # API reference docs
│   ├── database/                 # Database schema docs
│   ├── plans/                    # Implementation plans
│   ├── rules/                    # Development rules
│   └── workflow/                 # Process workflows
└── Configuration files           # Next.js, TypeScript, Tailwind configs
```

## Key Features

### Multi-Tenant Support
- Company and business unit scoping
- User access per business unit
- Data isolation via RLS policies

### Granular Permissions
- 73+ system resources with CRUD permissions
- 40+ UI-level capabilities
- Permission caching (5-second TTL)
- Role-based access control

### Real-time Inventory
- Multi-warehouse stock tracking
- Location-level inventory
- Reserved vs available stock
- Automatic reorder alerts
- Stock aging and valuation

### Complete Sales Workflow
- Quotation → Sales Order → Invoice
- Delivery note picking and receiving
- Partial fulfillment tracking
- Commission calculations
- Multi-currency support

### Purchasing Workflow
- Purchase Requisition → PO → Receipt
- Load list consolidation
- Multi-box GRN receiving
- Damaged item tracking
- Supplier management

### Accounting Integration
- Automatic GL posting for:
  - AR invoices and payments
  - AP invoices
  - COGS consumption
  - POS transactions
- Chart of accounts
- Trial balance reporting

### Manufacturing Support
- Bill of Materials (BOM) templates
- Transformation orders
- Cost allocation
- Lineage tracking
- Custom assembly jobs

### Analytics & Reporting
- Real-time dashboard widgets
- Sales analytics (by employee, location, time)
- Inventory reports (valuation, aging, movement)
- Purchasing analytics
- Efficiency metrics

### Mobile & POS
- React Native mobile app
- Warehouse picking operations
- GRN receiving on mobile
- Barcode/QR scanning
- POS transactions

## Database Statistics

- **Migrations**: 194 total
- **Tables**: 50+ core tables
- **RPC Functions**: 30+ transactional operations
- **Database Type Definitions**: 11,095 lines (generated)

## Development Standards

### Code Organization
- **Feature-based** folder structure
- **Colocation** of related components
- **Clear separation** of concerns (UI, business logic, data)

### TypeScript Standards
- **Strict mode** enabled
- **Type safety** enforced
- **Generated types** from database schema
- **Zod schemas** for runtime validation

### API Standards
- **REST** endpoints via Next.js API routes
- **Permission checks** on every route
- **RPC functions** for complex transactions
- **Error handling** with safe client messages

### UI/UX Standards
- **Responsive design** (desktop, tablet, mobile)
- **Accessibility** (WCAG 2.1)
- **Dark mode** support
- **Consistent design** via shadcn/ui

### Database Standards
- **Timestamped migrations** (format: `YYYYMMDDHHMMSS_description.sql`)
- **RLS policies** for data security
- **Transactional operations** via RPC
- **Migration chain** verification before changes

## Development Workflow

### Local Development Setup
```bash
# Install dependencies
npm install

# Start Supabase (local)
supabase start

# Run migrations
supabase db reset

# Start Next.js dev server
npm run dev
```

### Git Workflow
- **Main branch**: `main`
- **Feature branches**: `feature/description`
- **Commit message format**: Conventional commits preferred

### Translation Workflow
All user-facing text must be:
1. Defined in translation files (`src/lib/i18n/translations.ts`)
2. Used via `useTranslations()` hook in components
3. Never hardcoded in UI/API responses

### Migration Workflow
1. **Search** existing migrations for the object
2. **Identify** the latest effective definition
3. **Create** a new timestamped migration
4. **Test** locally with `supabase db reset`
5. **Never modify** existing migrations after deployment

## Documentation Structure

This documentation is organized by module for easy navigation:

### Module Documentation (`docs/kb/`)
- `00-PROJECT-OVERVIEW.md` (this file) - System overview
- `01-AUTHENTICATION-AUTHORIZATION.md` - Auth & permissions
- `02-INVENTORY-MANAGEMENT.md` - Inventory module
- `03-SALES-MANAGEMENT.md` - Sales module
- `04-PURCHASING-MANAGEMENT.md` - Purchasing module
- `05-ACCOUNTING.md` - Accounting module
- `06-MANUFACTURING.md` - Manufacturing module
- `07-REPORTING-ANALYTICS.md` - Reports & analytics
- `08-POS-MOBILE.md` - POS & mobile app

### API Documentation (`docs/api/`)
- API route reference
- Request/response schemas
- Permission requirements

### Database Documentation (`docs/database/`)
- Schema diagrams
- Table relationships
- RPC function reference
- Migration guidelines

### Developer Guides (`docs/guides/`)
- Onboarding guide
- Development setup
- Testing guide
- Deployment guide

## Getting Help

### For New Developers
1. Start with this overview document
2. Read the **Developer Onboarding Guide** (`docs/guides/DEVELOPER-ONBOARDING.md`)
3. Review module documentation for your assigned feature
4. Check existing code in similar modules as examples

### For Bug Fixes
1. Identify the affected module
2. Review module documentation
3. Check API documentation for endpoint details
4. Review database schema for data relationships
5. Search migration history before making DB changes

### For New Features
1. Review product requirements documents in `docs/plans/`
2. Identify affected modules
3. Review similar existing features
4. Follow development rules in `docs/rules/`
5. Create implementation plan before coding

## Recent Major Changes

### June 2025
- Purchase price used as runtime item cost
- Suppliers made company-scoped
- Delivery note scan receiving with variance workflow
- Pick list completion refactored to atomic transaction
- Quotation partial fulfillment tracking

### Earlier in 2025
- Native mobile app with React Native Expo
- Granular permission system rollout
- Multi-business unit support
- Accounting integration for AR/AP/COGS/POS

## Related Documentation

- **Engineering Rules**: `docs/rules/engineering-rule.md`
- **Scalable API Design**: `docs/rules/scalable-api-design-rule.md`
- **Granular Permissions**: `docs/rules/granular-permissions-rule.md`
- **Product Requirements**: `docs/product-requirements.md`
- **ERP System Analysis**: `docs/ERP-System-Analysis.md`

## Contact & Support

This is an internal project. For questions or issues, refer to:
- Module documentation (this folder)
- Implementation plans (`docs/plans/`)
- Existing similar code as reference
- Development rules (`docs/rules/`)
