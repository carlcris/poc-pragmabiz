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

## Development Guidelines

### TypeScript

•⁠  ⁠*ALWAYS ⁠ type ⁠* (never ⁠ interface ⁠)
•⁠  ⁠*NEVER ⁠ any ⁠* (use ⁠ unknown ⁠)
•⁠  ⁠Strict generics: ⁠ <T extends SomeType> ⁠
•⁠  ⁠Unions over enums: ⁠ type Status = 'pending' | 'completed' ⁠

### React Components

•⁠  ⁠Arrow functions for non-page components/hooks
•⁠  ⁠Named exports (except pages use default export)
•⁠  ⁠Destructure props, TypeScript all props

⁠ typescript
type ButtonProps = {
  children: React.ReactNode;
  variant?: "primary" | "secondary";
};

export const Button = ({ children, variant = "primary" }: ButtonProps) => (
  <button className={variant === "primary" ? "btn-primary" : "btn-secondary"}>
    {children}
  </button>
);

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

## Database Schema Verification Rule

**CRITICAL: Always refer to the database schema in migration files when creating APIs that involve database calls.**

### Why This Rule Exists
- Prevents errors from incorrect column names, table names, or relationships
- Ensures type safety and correct data handling
- Avoids multiple debugging iterations
- Saves time by verifying schema upfront rather than through trial-and-error

### How to Follow This Rule

1. **Before writing any API endpoint that queries or modifies the database:**
   - Locate the relevant migration files in the `app/supabase/migrations/` directory
   - Read the table schema to verify:
     - Exact table names (e.g., `item_warehouse` not `item_warehouse_stock`)
     - Exact column names (e.g., `sales_price` not `sell_price`)
     - Column data types (e.g., `DECIMAL`, `VARCHAR`, `UUID`)
     - Foreign key relationships and their names
     - Constraints and defaults
     - NULL vs NOT NULL columns

2. **When working with Supabase queries:**
   - Verify foreign key relationship names for nested queries
   - Check for multiple foreign keys that might cause PostgREST suffix issues (`_2`, `_3`)
   - Use the exact column names from the schema in SELECT queries
   - Match the data types when inserting or updating

3. **Common pitfalls to avoid:**
   - ❌ Assuming column names without verification
   - ❌ Using incorrect plural/singular forms (e.g., `unit_of_measures` vs `units_of_measure`)
   - ❌ Mixing up similar field names (e.g., `sell_price` vs `sales_price`)
   - ❌ Guessing relationship names for nested Supabase queries
   - ❌ Not checking if a table uses snake_case or camelCase

### Example Workflow

**BAD - Guessing field names:**
```typescript
// ❌ WRONG - Writing code without checking schema
const { data } = await supabase
  .from('items')
  .select('sell_price, uom_name')  // These might not exist!
```

**GOOD - Verifying schema first:**
```typescript
// 1. First, check app/supabase/migrations/00001_db_schema_up.sql
// 2. Find the items table definition:
//    CREATE TABLE items (
//      id UUID PRIMARY KEY,
//      item_code VARCHAR(50),
//      sales_price DECIMAL(15,2),  -- ✅ It's sales_price not sell_price
//      uom_id UUID,                 -- ✅ It's uom_id not uom_name
//      ...
//    );
//
// 3. Then write the correct query:
const { data } = await supabase
  .from('items')
  .select('sales_price, uom_id')  // ✅ CORRECT - verified from schema
```

### Migration File Location

Database migrations are located in: `app/supabase/migrations/`

Common tables to reference:
- `items` - Product/inventory items
- `item_warehouse` - Stock levels per warehouse
- `warehouses` - Warehouse locations
- `units_of_measure` - Units of measurement
- `stock_transfers` - Warehouse transfers
- `stock_transfer_items` - Transfer line items
- `customers` - Customer records
- `sales_orders` - Sales order headers
- `sales_order_items` - Sales order line items

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

## TypeScript Type Verification Rule - CRITICAL

**CRITICAL: Always verify TypeScript types and return values before writing code. STOP GUESSING!**

This is a repetitive mistake that wastes time. You must follow this protocol strictly:

### The Problem

You frequently:
- ❌ Assume data structure without checking the actual return type
- ❌ Guess whether data is wrapped in `{ data: T }` or returned as `T` directly
- ❌ Write code based on assumptions instead of reading the actual types
- ❌ Access properties that don't exist on the TypeScript interface
- ❌ Miss implicit `any` type errors on parameters

### The Solution - MANDATORY CHECKS

**Before writing ANY code that uses a hook, API call, or function:**

1. **READ THE SOURCE - Don't Guess**
   ```typescript
   // ❌ WRONG - Guessing the structure
   const { data } = useMyHook()
   return data?.items  // Is it data.items or data.data.items?

   // ✅ CORRECT - Read the hook first to see what it returns
   // Check: Does the hook return response.data or response.data.data?
   // Check: What is the TypeScript interface?
   ```

2. **Check the Hook/Function Implementation**
   - Open the hook file (e.g., `src/hooks/useVanInventory.ts`)
   - Look at the return statement: `return response.data` or `return response.data.data`?
   - Look at the TypeScript generic: `apiClient.get<{ data: T }>` means response has structure `{ data: T }`
   - Verify what the function actually returns, not what you think it returns

3. **Check the TypeScript Interface**
   ```typescript
   // If the interface is:
   interface VanInventoryData {
     warehouse: {...}
     inventory: []
     summary: {...}
   }

   // And hook returns: response.data.data
   // Then: inventoryData is VanInventoryData (NOT { data: VanInventoryData })
   // Access as: inventoryData.summary (NOT inventoryData.data.summary)
   ```

4. **Verify Parameter Types**
   - Always add explicit types to callback parameters
   - ❌ `.filter(item => ...)` - implicit any
   - ✅ `.filter((item: MyType) => ...)` - explicit type

5. **Check API Response Structure**
   - Read the API route to see the response format
   - Example: `NextResponse.json({ data: { warehouse, inventory, summary } })`
   - This means: axios gets `{ data: { warehouse, inventory, summary } }`
   - So: `response.data` = `{ data: { warehouse, inventory, summary } }`
   - And: `response.data.data` = `{ warehouse, inventory, summary }`

### Common Patterns to Check

| Pattern | What to Check |
|---------|---------------|
| `useQuery()` hook | What does `queryFn` return? |
| `apiClient.get<T>()` | Is T the full response or wrapped in `{ data: T }`? |
| `response.data` | Is this the final data or is there another `.data`? |
| `.map(item => ...)` | Add type: `.map((item: Type) => ...)` |
| `.filter(x => ...)` | Add type: `.filter((x: Type) => ...)` |

### Example of Correct Verification Process

```typescript
// Task: Use data from useVanInventory hook

// STEP 1: Read the hook file
// File: src/hooks/useVanInventory.ts
// Line 42: apiClient.get<{ data: VanInventoryData }>
// Line 45: return response.data.data
// Conclusion: Returns VanInventoryData directly

// STEP 2: Read the interface
// Lines 23-32: interface VanInventoryData { warehouse, inventory, summary }
// Conclusion: Has summary property at root level

// STEP 3: Write correct code
const { data: inventoryData } = useVanInventory(id)
const itemsInStock = inventoryData?.summary?.itemsInStock  // ✅ CORRECT
// NOT: inventoryData?.data?.summary?.itemsInStock  // ❌ WRONG
```

### Red Flags - Stop and Verify

- 🚩 TypeScript error: "Property 'data' does not exist"
- 🚩 TypeScript error: "Parameter implicitly has 'any' type"
- 🚩 Runtime error: "Cannot read property of undefined"
- 🚩 You're writing `?.data?.data` (double data access)
- 🚩 You're accessing a property without checking the interface first
- 🚩 You haven't opened the hook/function file to read the implementation

### Mandatory Checklist

Before writing code that uses external data:

- [ ] I have READ the hook/function source code
- [ ] I have READ the TypeScript interface definition
- [ ] I know exactly what the return type is (not guessing)
- [ ] I have verified the data structure (wrapped or unwrapped)
- [ ] I have added explicit types to all callback parameters
- [ ] I have checked for TypeScript errors before declaring it fixed

**If you cannot check all boxes above, you MUST NOT write the code. Read the source files first.**

## Bug Fix and Architecture Rule

**CRITICAL: When implementing bug fixes, always provide proper architectural solutions that address the root cause!**

### The Problem

Quick fixes and "band-aid" solutions that only address symptoms often lead to:
- ❌ Recurring issues when edge cases are encountered
- ❌ Technical debt that compounds over time
- ❌ Inconsistent code patterns across the codebase
- ❌ Security vulnerabilities from incomplete solutions
- ❌ Poor maintainability and scalability

### The Solution - Architectural Thinking

**When fixing bugs, always:**

1. **Identify the Root Cause**
   - Don't just fix the symptom - trace back to WHY the issue exists
   - Ask: "What fundamental assumption or design is causing this?"
   - Example: Cached permissions showing stale data → Root cause: caching strategy doesn't account for security-critical data

2. **Design a Production-Ready Solution**
   - Consider security implications
   - Consider performance implications
   - Consider scalability and maintainability
   - Follow established architectural patterns
   - Document the reasoning and trade-offs

3. **Implement Comprehensively**
   - Fix ALL occurrences of the problem, not just the reported one
   - Update all related code paths
   - Add proper error handling and edge case coverage
   - Include migration scripts if database changes are needed

4. **Document the Solution**
   - Explain the root cause analysis
   - Document the architectural decision
   - Provide examples and use cases
   - Include testing and troubleshooting guides

### Examples of Good vs Bad Fixes

#### ❌ BAD - Band-Aid Fix
```typescript
// User reports: "Permissions still show after removal"
// Band-aid: Clear cache on logout only
logout: async () => {
  queryClient.clear();  // Only fixes it on logout, not on permission changes
}
```

#### ✅ GOOD - Architectural Solution
```typescript
// Root cause: Permissions are security-critical and should NEVER be cached
// Solution: Zero-caching strategy across all layers

// 1. Server-side: Disable cache
const CACHE_TTL = 0; // No caching for security

// 2. HTTP layer: Prevent browser caching
response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');

// 3. Client-side: React Query configuration
useQuery({
  staleTime: 0,           // Immediately stale
  gcTime: 0,              // Clear from cache
  refetchOnMount: true,   // Always refetch
  refetchOnWindowFocus: true,
});

// 4. Invalidation: On permission changes
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['permissions'] });
}

// 5. Documentation: /docs/PERMISSION_CACHING_STRATEGY.md
```

### Real-World Example: Permission-Based Routing

**Problem**: User with no permissions redirected to default page they can't access

**Bad Fix (Band-Aid)**:
- Check permission only for the default page
- Redirect to 403 if no access
- Doesn't handle other pages, doesn't consider priority

**Good Fix (Architectural)**:
- Created `PAGE_RESOURCE_MAP` - maps all routes to required permissions
- Created `PAGE_PRIORITY` - ordered list for finding accessible pages
- Created `getFirstAccessiblePage()` - finds first accessible page or 403
- Updated login flow to fetch permissions and check accessibility
- Parallel fetching for performance
- Fail-safe error handling
- Comprehensive documentation in `/docs/PERMISSION_BASED_ROUTING.md`

### Checklist for Proper Bug Fixes

Before submitting a bug fix, verify:

- [ ] I have identified the root cause, not just the symptom
- [ ] The solution addresses the fundamental issue
- [ ] The fix is production-ready (security, performance, scalability)
- [ ] All related code paths have been updated
- [ ] Edge cases and error scenarios are handled
- [ ] The solution follows established architectural patterns
- [ ] I have documented the root cause and solution
- [ ] Testing procedures are documented
- [ ] The fix prevents the issue from recurring

### Red Flags - Stop and Redesign

- 🚩 Your fix only works for the specific reported case
- 🚩 You're adding special case handling without addressing the root cause
- 🚩 The fix introduces inconsistency with other parts of the codebase
- 🚩 You can't explain WHY the bug happened in the first place
- 🚩 The fix requires "remembering" to do something manually in the future
- 🚩 You're thinking "this is temporary, we'll fix it properly later"

**If you see these red flags, STOP and design a proper architectural solution instead.**

## API Client Response Handling Rule

**CRITICAL: The `apiClient` already unwraps one level of `.data` - do NOT double-unwrap!**

### The Pattern

Our `apiClient` (in `src/lib/api.ts`) returns `response.json()` directly, which gives you the API response body.

```typescript
// In apiClient.get():
async get<T>(endpoint: string): Promise<T> {
  const response = await fetch(url, { ... });
  return response.json();  // Returns the parsed JSON body directly
}
```

### The Rule

**In React Query hooks:**
- ✅ `return response` - Correct (response is already the parsed JSON)
- ❌ `return response.data` - Wrong (unless the API response has a `.data` wrapper)
- ❌ `return response.data.data` - Wrong (double unwrapping)

### Examples

```typescript
// ✅ CORRECT - API returns { data: T[], pagination: {...} }
export function useItems() {
  return useQuery({
    queryKey: ['items'],
    queryFn: async () => {
      const response = await apiClient.get<ItemsResponse>('/api/items');
      return response;  // ✅ Returns ItemsResponse directly
    },
  });
}

// Then in component:
const { data } = useItems();  // data is ItemsResponse
const items = data?.data;     // Access the items array

// ✅ CORRECT - API returns { data: T }
export function useItem(id: string) {
  return useQuery({
    queryKey: ['item', id],
    queryFn: async () => {
      const response = await apiClient.get<{ data: Item }>(`/api/items/${id}`);
      return response.data;  // ✅ Unwrap once to get the Item
    },
  });
}

// Then in component:
const { data: item } = useItem(id);  // data is Item directly

// ❌ WRONG - Double unwrapping
export function useItems() {
  return useQuery({
    queryKey: ['items'],
    queryFn: async () => {
      const response = await apiClient.get<ItemsResponse>('/api/items');
      return response.data;  // ❌ Error: response is already ItemsResponse
    },
  });
}
```

### How to Verify

1. Check the API route's response format:
   ```typescript
   // In /api/items/route.ts
   return NextResponse.json({
     data: items,
     pagination: { ... }
   });
   ```

2. Check the hook's generic type:
   ```typescript
   apiClient.get<ItemsResponse>('/api/items')
   // ItemsResponse should match the API response structure
   ```

3. Return the appropriate level:
   - If API returns `{ data: T, pagination }`: return `response` (full response)
   - If API returns `{ data: T }`: return `response.data` (unwrap to T)
   - NEVER return `response.data.data` (double unwrap)

### Common Mistakes

| Mistake | Why It's Wrong | Fix |
|---------|----------------|-----|
| `return response.data` when API returns `{ data: T[] }` | `response` is already `{ data: T[] }`, accessing `.data` again breaks the structure | `return response` |
| `return response.data.data` | Double unwrapping - `apiClient` already returns parsed JSON | `return response.data` or `return response` |
| Inconsistent unwrapping across hooks | Some hooks return `response`, others `response.data` for same API pattern | Standardize based on API response structure |
