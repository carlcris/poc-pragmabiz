# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an ERP (Enterprise Resource Planning) system built with **Next.js 15** and **Supabase**. The application uses Next.js App Router for both frontend and backend (API routes), with Supabase providing the PostgreSQL database, authentication, and real-time features.

### Documentation

All documentation is in the `/docs` folder:

- `docs/tech-stack.md` - Technology stack decisions
- `docs/domain-architecture.md` - Domain-driven design architecture
- `docs/database-design.md` - Database schema and design
- `docs/product-requirements.md` - Product requirements and specifications

## Project Structure

```
/erpplus
├── /app                        # Next.js application
│   ├── /src
│   │   ├── /app                # Next.js App Router (pages + API routes)
│   │   ├── /components         # React components
│   │   ├── /lib                # Utilities and clients
│   │   │   ├── /supabase       # Supabase client (browser & server)
│   │   │   └── /api            # API client functions
│   │   └── /types              # TypeScript type definitions
│   │
│   ├── /supabase               # Database migrations & config
│   │   ├── /migrations         # SQL migration files
│   │   ├── config.toml         # Supabase configuration
│   │   └── seed.sql            # Development seed data
│   │
│   ├── package.json
│   └── .env.local              # Environment variables
│
├── /docs                       # All project documentation
├── todo.md                     # Project task tracking
└── README.md
```

## Development Commands

### Frontend (Next.js)

From the `app/` directory:

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Run production build
npm start
```

### Database (Supabase)

From the `app/` directory:

```bash
# Start Supabase local services
supabase start

# Stop Supabase services
supabase stop

# Check service status
supabase status

# Reset database (drop, migrate, seed)
supabase db reset

# Generate TypeScript types from database
supabase gen types typescript --local > src/types/database.types.ts

# Create new migration
supabase migration new <migration_name>
```

### Access Points

- **Next.js App**: http://localhost:3000
- **Supabase Studio**: http://localhost:54323
- **Supabase API**: http://localhost:54321
- **Database**: postgresql://postgres:postgres@localhost:54322/postgres

## Database Migration Conventions

When working with database migrations in the `app/supabase/migrations/` directory, follow these rules:

### Migration File Naming

- **Format:** `[VVVVV]_db_schema_up.sql` and `[VVVVV]_db_schema_down.sql`
- **Version:** Use 5-digit version numbers (e.g., `00001`, `00002`, `00003`)
- **Example:**
  - `00001_db_schema_up.sql` - Apply changes
  - `00001_db_schema_down.sql` - Rollback changes

### Migration Organization

1. **Co-locate Related Scripts:** Group related table definitions together in a single migration file
   - Example: Item categories and items tables should be in one migration (not separate files)

2. **Single Migration File:** During active development, do NOT create new migration files for schema updates
   - Add new tables/changes to the existing migration file
   - Only create a new migration file when explicitly instructed or when starting a new major feature

3. **Up and Down Migrations:** Always maintain both up and down migration scripts
   - `up` script: Creates/modifies database objects
   - `down` script: Reverses the changes (for rollback)

### Migration Content Structure

Each migration file should include:
- Clear header comments (version, description, author, date)
- Tables with proper constraints and indexes
- RLS (Row Level Security) policies
- Triggers for automatic timestamp updates
- Comments on tables and columns
- Organized sections with clear separators

### Example Structure

```sql
-- Migration: Create Inventory Tables
-- Version: 00001
-- Description: Creates item_categories and items tables
-- Author: System
-- Date: YYYY-MM-DD

-- ============================================================================
-- TABLE: item_categories
-- ============================================================================
-- ... SQL here ...

-- ============================================================================
-- TABLE: items
-- ============================================================================
-- ... SQL here ...
```
gipabuhat nako prompt si claude para malikayan ning iyang mali2.  pero testingan pa pud nako ni.

```
Prompt to Prevent These Mistakes

  # Code Modification Safety Protocol

  Before making ANY code changes:

  1. **Understand First, Act Second**
     - Read ALL related code paths completely
     - Trace through the FULL execution flow
     - Check for edge cases and special handling
     - Verify assumptions against actual code behavior

  2. **Question Your Assumptions**
     - List every assumption you're making
     - Find evidence in the code for each assumption
     - If you can't find evidence, ASK the user
     - Never assume you understand the user's use case

  3. **Impact Analysis Required**
     - What other features does this change affect?
     - What file types/formats are supported?
     - Are there multiple code paths (app upload vs direct upload)?
     - Could this break existing data or workflows?

  4. **When In Doubt**
     - Present options with tradeoffs instead of making changes
     - Ask clarifying questions about how the system is actually used
     - Admit uncertainty rather than guessing
     - Use Task/Explore agents to verify understanding

  5. **Red Flags That Mean STOP**
     - Hardcoding values that were previously dynamic
     - Removing support for formats in allowedTypes
     - "Always" or "never" assumptions about user behavior
     - Changes that limit flexibility without confirmed requirements

  If you cannot verify your understanding through code analysis, you MUST ask the user before proceeding.
```