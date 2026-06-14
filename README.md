# ERP Frontend - Sales & Inventory Management System

Modern ERP system built with Next.js 15, TypeScript, Tailwind CSS, and shadcn/ui.

## Quick Links

- **[📚 Documentation Index](docs/DOCUMENTATION-INDEX.md)** - Navigate all documentation
- **[🚀 Developer Onboarding Guide](docs/guides/DEVELOPER-ONBOARDING.md)** - Complete setup guide for new developers
- **[📖 Module Documentation](docs/kb/)** - Detailed guides for each system module
- **[📋 Engineering Rules](docs/rules/engineering-rule.md)** - Mandatory development standards

## For New Developers

**Start here**: [Developer Onboarding Guide](docs/guides/DEVELOPER-ONBOARDING.md)

This guide covers:
- Complete environment setup (Node.js, Supabase, dependencies)
- Database setup and migrations
- Development workflow
- Making your first change
- Common tasks and troubleshooting

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript 5
- **Database**: PostgreSQL 17 (via Supabase)
- **Styling**: Tailwind CSS 3
- **UI Components**: shadcn/ui (Radix UI + Tailwind)
- **State Management**: Zustand 5
- **Server State**: React Query (@tanstack/react-query 5)
- **Forms**: React Hook Form 7 + Zod 4
- **Authentication**: Supabase Auth (JWT-based)
- **i18n**: next-intl
- **Icons**: Lucide React
- **Charts**: Recharts 3

## Quick Start

### Prerequisites

- **Node.js 18+** ([Download](https://nodejs.org/))
- **Docker Desktop** (for Supabase local development)
- **Supabase CLI** ([Install Guide](https://supabase.com/docs/guides/cli))

### Installation

```bash
# 1. Install dependencies
npm install

# 2. Start Supabase (PostgreSQL, API, Studio)
supabase start

# 3. Run database migrations
supabase db reset

# 4. Start Next.js development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

Open [http://localhost:54323](http://localhost:54323) for Supabase Studio (database GUI).

**For detailed setup instructions**, see the [Developer Onboarding Guide](docs/guides/DEVELOPER-ONBOARDING.md).

## Project Structure

```
/
├── src/
│   ├── app/                 # Next.js App Router pages
│   │   ├── (auth)/          # Authentication routes
│   │   ├── (dashboard)/     # Main application routes
│   │   ├── layout.tsx       # Root layout
│   │   └── globals.css      # Global styles
│   ├── components/          # Reusable components
│   │   ├── ui/              # shadcn/ui components
│   │   ├── layout/          # Layout components
│   │   └── shared/          # Shared components
│   ├── hooks/               # Custom React hooks
│   ├── stores/              # Zustand stores
│   ├── lib/                 # Utilities and helpers
│   ├── i18n/                # Internationalization
│   └── types/               # TypeScript type definitions
├── public/                  # Static assets
├── supabase/                # Migrations, config, edge functions
├── docs/                    # Project documentation
└── ...config files
```

## System Modules

The ERP system is organized into 10 functional modules:

| Module | Description | Documentation |
|--------|-------------|---------------|
| **Authentication & Authorization** | User auth, permissions, RBAC, multi-tenant | [📖 Docs](docs/kb/01-AUTHENTICATION-AUTHORIZATION.md) |
| **Inventory Management** | Items, warehouses, stock tracking, transactions | [📖 Docs](docs/kb/02-INVENTORY-MANAGEMENT.md) |
| **Sales Management** | Customers, quotations, orders, invoices | [📖 Docs](docs/kb/03-SALES-MANAGEMENT.md) |
| **Purchasing Management** | Suppliers, purchase orders, GRNs | [📖 Docs](docs/kb/04-PURCHASING-MANAGEMENT.md) |
| **Accounting** | Chart of accounts, GL posting, journal entries | [📖 Docs](docs/kb/05-ACCOUNTING.md) |
| **Manufacturing** | BOM, transformation orders, workstations | [📖 Docs](docs/kb/06-MANUFACTURING.md) |
| **Reporting & Analytics** | Dashboards, reports, KPIs | [📖 Docs](docs/kb/07-REPORTING-ANALYTICS.md) |
| **Point of Sale** | Cash sales, receipts, payment processing | [📖 Docs](docs/kb/08-POINT-OF-SALE.md) |
| **Mobile App** | Native mobile app for warehouse picking and receiving | [📖 Docs](docs/kb/09-MOBILE-APP.md) |
| **Notifications** | Workflow notifications, business unit broadcasting | [📖 Docs](docs/kb/10-NOTIFICATIONS.md) |

**See**: [Module Documentation Index](docs/kb/README.md) for full details.

## Key Features

- ✅ **Multi-warehouse** inventory tracking with location-level stock
- ✅ **Multi-tenant** architecture (company and business unit scoping)
- ✅ **Role-based access control** (RBAC) with 73+ resources and 40+ capabilities
- ✅ **Complete sales workflow**: Quotation → Sales Order → Delivery → Invoice → Payment
- ✅ **Purchasing workflow**: Requisition → PO → GRN → Receipt
- ✅ **Manufacturing support**: BOM templates, transformation orders, cost allocation
- ✅ **Accounting integration**: Automatic GL posting for AR/AP/COGS/POS
- ✅ **Mobile app**: React Native Expo for warehouse operations
- ✅ **Real-time analytics**: Dashboard widgets and reports
- ✅ **Multi-language support**: i18n with next-intl
- ✅ **Multi-currency support**
- ✅ **Dark mode**
- ✅ **Responsive design** (desktop, tablet, mobile)
- ✅ **Accessibility** (WCAG 2.1)

## Project Statistics

- **API Routes**: 207 endpoints
- **React Components**: 181 components
- **Custom Hooks**: 61 hooks
- **Database Migrations**: 194 total
- **Database Tables**: 50+ core tables
- **RPC Functions**: 30+ for complex transactions
- **RBAC Resources**: 73 system resources
- **Capabilities**: 40+ granular UI permissions

## Documentation

### Essential Reading

- **[Documentation Index](docs/DOCUMENTATION-INDEX.md)** - Central navigation hub
- **[Developer Onboarding](docs/guides/DEVELOPER-ONBOARDING.md)** - Setup and getting started
- **[Project Overview](docs/kb/00-PROJECT-OVERVIEW.md)** - System architecture and design
- **[Engineering Rules](docs/rules/engineering-rule.md)** - Mandatory development standards

### Module Documentation

Each module has comprehensive documentation covering:
- Architecture and core concepts
- Database schema
- API reference with examples
- Common workflows
- UI components
- Troubleshooting

Browse all modules: [docs/kb/](docs/kb/)

### Development Guides

- **API Development Guide** *(To be created)*
- **Database Migration Guide** *(To be created)*
- **UI Component Guide** *(To be created)*
- **Testing Guide** *(To be created)*
- **Deployment Guide** *(To be created)*

## Development Commands

```bash
# Development
npm run dev              # Start Next.js dev server (with Turbopack)
npm run build            # Build for production
npm start                # Run production build
npm run lint             # Lint code
npm run format           # Format code with Prettier

# Database (Supabase)
supabase start           # Start all services (PostgreSQL, API, Studio)
supabase stop            # Stop all services
supabase db reset        # Reset DB and run all migrations
supabase db push         # Push local migrations to remote
supabase migration new   # Create new migration file

# Type Generation
supabase gen types typescript --local > src/types/database.types.ts
```

## Contributing

### Before Starting

1. Read [Engineering Rules](docs/rules/engineering-rule.md)
2. Review [Developer Onboarding Guide](docs/guides/DEVELOPER-ONBOARDING.md)
3. Check relevant module documentation
4. Search for similar existing code

### Development Workflow (Trunk-Based)

This project uses **trunk-based development** - commit directly to `main`:

1. Pull latest: `git pull origin main`
2. Make changes following project standards
3. Add/update translations for all user-facing text
4. **Test thoroughly** (you are the quality gate)
5. Commit: `git commit -m "feat(module): description"`
6. Push: `git push origin main`

**Optional branches** only for experimental/risky work that may be abandoned.

### Mandatory Rules

- ✅ **Every API route** must check permissions
- ✅ **All user-facing text** must go through i18n system
- ✅ **Search all migrations** before modifying database objects
- ✅ **Use strict TypeScript** (avoid `any`)
- ✅ **Follow existing patterns** in similar code

See [Engineering Rules](docs/rules/engineering-rule.md) for complete standards.

## Recent Changes

### June 2025
- Purchase price used as runtime item cost (migration `20260610100000`)
- Suppliers made company-scoped (migration `20260611100000`)
- Delivery note scan receiving with variance workflow
- Pick list completion refactored to atomic transaction
- Quotation partial fulfillment tracking

### Earlier 2025
- Native mobile app with React Native Expo
- Granular permission system rollout
- Multi-business unit support
- Accounting integration for AR/AP/COGS/POS

## Support

For questions or issues:
- Check [Documentation Index](docs/DOCUMENTATION-INDEX.md)
- Review module documentation in [docs/kb/](docs/kb/)
- Search existing implementation plans in [docs/plans/](docs/plans/)
- Look at similar existing code

## License

Private - All rights reserved
