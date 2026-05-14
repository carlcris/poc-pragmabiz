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
├── /src
│   ├── /app                    # Next.js App Router (pages + API routes)
│   ├── /components             # React components
│   ├── /lib                    # Utilities and clients
│   │   ├── /supabase           # Supabase client (browser & server)
│   │   └── /api                # API client functions
│   └── /types                  # TypeScript type definitions
│
├── package.json
├── .env.local                  # Environment variables
│
├── /supabase                   # Database migrations & config
│   ├── /migrations             # SQL migration files
│   ├── /functions              # Edge functions (Deno)
│   ├── config.toml             # Supabase configuration
│   └── seed.sql                # Development seed data
│
├── /docs                       # All project documentation
├── todo.md                     # Project task tracking
└── README.md
```

## Development Commands

### Frontend (Next.js)

From the repo root:

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

•⁠ ⁠*ALWAYS ⁠ type ⁠* (never ⁠ interface ⁠)
•⁠ ⁠*NEVER ⁠ any ⁠* (use ⁠ unknown ⁠)
•⁠ ⁠Strict generics: ⁠ <T extends SomeType> ⁠
•⁠ ⁠Unions over enums: ⁠ type Status = 'pending' | 'completed' ⁠

### React Components

•⁠ ⁠Arrow functions for non-page components/hooks
•⁠ ⁠Named exports (except pages use default export)
•⁠ ⁠Destructure props, TypeScript all props

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

From the repo root:

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

When working with database migrations in the `supabase/migrations/` directory, follow these rules:

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

### Schema Drift Handling Rule

**CRITICAL: If code expects schema that is not present in the current database, stop and report the mismatch. Do not hide it with temporary fallbacks unless explicitly requested.**

When unapplied migrations or schema drift are discovered:

1. State what the code expects.
2. State what the current database actually has.
3. State the exact mismatch causing the failure.
4. State the required migration or environment action.

Do not add temporary compatibility reads, writes, or query fallbacks just to make the current environment work unless the user explicitly asks for that behavior.

**CRITICAL: Shared hooks should not own UI toasts by default.**

For hooks in `src/hooks/`:

1. Keep hook responsibilities focused on API calls, cache invalidation, and typed state/error propagation.
2. Prefer pages/components to own presentation side effects such as toast messages, banners, dialogs, and inline form errors.
3. If a shared hook must support custom UI behavior, prefer caller-provided callbacks or `mutateAsync` handling over hardcoded toast calls inside the hook.
4. Avoid hook-level toasts in reusable hooks because they create duplicate notifications and reduce screen-level control.

### Production-Grade Implementation Rule

**CRITICAL: Do not ship temporary fixes as the default implementation.**

When implementing changes:

1. Default to production-grade solutions instead of symptom-level patches.
2. Do not change code only to make the current issue appear resolved; fix the underlying contract, schema, data flow, or behavior correctly.
3. Do not add short-term workaround code that is knowingly meant to be cleaned up later unless the user explicitly asks for a temporary measure.
4. If the correct fix requires a migration, contract update, or broader implementation step, state that clearly and implement the proper path rather than masking it with a shortcut.

## Core Development Principles:

These rules apply to every task in this project unless explicitly overridden.
Bias: caution over speed on non-trivial work. Use judgment on trivial tasks.

## Rule 1 — Think Before Coding
State assumptions explicitly. If uncertain, ask rather than guess.
Present multiple interpretations when ambiguity exists.
Push back when a simpler approach exists.
Stop when confused. Name what's unclear.

## Rule 2 — Simplicity First
Minimum code that solves the problem. Nothing speculative.
No features beyond what was asked. No abstractions for single-use code.
Test: would a senior engineer say this is overcomplicated? If yes, simplify.

## Rule 3 — Surgical Changes
Touch only what you must. Clean up only your own mess.
Don't "improve" adjacent code, comments, or formatting.
Don't refactor what isn't broken. Match existing style.

## Rule 4 — Goal-Driven Execution
Define success criteria. Loop until verified.
Don't follow steps. Define success and iterate.
Strong success criteria let you loop independently.

## Rule 5 — Use the model only for judgment calls
Use me for: classification, drafting, summarization, extraction.
Do NOT use me for: routing, retries, deterministic transforms.
If code can answer, code answers.

## Rule 6 — Token budgets are not advisory
Per-task: 4,000 tokens. Per-session: 30,000 tokens.
If approaching budget, summarize and start fresh.
Surface the breach. Do not silently overrun.

## Rule 7 — Surface conflicts, don't average them
If two patterns contradict, pick one (more recent / more tested).
Explain why. Flag the other for cleanup.
Don't blend conflicting patterns.

## Rule 8 — Read before you write
Before adding code, read exports, immediate callers, shared utilities.
"Looks orthogonal" is dangerous. If unsure why code is structured a way, ask.

## Rule 9 — Tests verify intent, not just behavior
Tests must encode WHY behavior matters, not just WHAT it does.
A test that can't fail when business logic changes is wrong.

## Rule 10 — Checkpoint after every significant step
Summarize what was done, what's verified, what's left.
Don't continue from a state you can't describe back.
If you lose track, stop and restate.

## Rule 11 — Match the codebase's conventions, even if you disagree
Conformance > taste inside the codebase.
If you genuinely think a convention is harmful, surface it. Don't fork silently.

## Rule 12 — Fail loud
"Completed" is wrong if anything was skipped silently.
"Tests pass" is wrong if any were skipped.
Default to surfacing uncertainty, not hiding it.


### Server-Backed Select Rule

**CRITICAL: Do not fake searchable selects by preloading large option lists and filtering them in the client.**

For select, combobox, and autocomplete controls backed by server data:

1. Initial load must fetch only the top `5` results.
2. When the user types, send the search term to the API/database and render the returned results.
3. Do not rely on client-side filtering over an arbitrary prefetched subset for server-backed option sets.
4. Treat the backend query as the source of truth for searchable option lists.

### API Error Exposure Rule

**CRITICAL: Do not return raw database, Supabase, or internal exception messages directly to API clients.**

For API routes and server actions:

1. Log the real internal error server-side with enough detail for debugging.
2. Return a user-friendly, non-sensitive error message to the client.
3. Do not expose raw backend error strings that may reveal schema details, constraint names, SQL behavior, internal service structure, or other implementation details.
4. If the client needs more actionable feedback, translate the failure into a safe domain-level message rather than forwarding the raw backend text.

### Why This Rule Exists

- Prevents errors from incorrect column names, table names, or relationships
- Ensures type safety and correct data handling
- Avoids multiple debugging iterations
- Saves time by verifying schema upfront rather than through trial-and-error

### How to Follow This Rule

1. **Before writing any API endpoint that queries or modifies the database:**
   - Locate the relevant migration files in the `supabase/migrations/` directory
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
const { data } = await supabase.from("items").select("sell_price, uom_name"); // These might not exist!
```

**GOOD - Verifying schema first:**

```typescript
// 1. First, check supabase/migrations/00001_db_schema_up.sql
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
const { data } = await supabase.from("items").select("sales_price, uom_id"); // ✅ CORRECT - verified from schema
```

### Migration File Location

Database migrations are located in: `supabase/migrations/`

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

gipabuhat nako prompt si claude para malikayan ning iyang mali2. pero testingan pa pud nako ni.

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
   const { data } = useMyHook();
   return data?.items; // Is it data.items or data.data.items?

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

| Pattern              | What to Check                                       |
| -------------------- | --------------------------------------------------- |
| `useQuery()` hook    | What does `queryFn` return?                         |
| `apiClient.get<T>()` | Is T the full response or wrapped in `{ data: T }`? |
| `response.data`      | Is this the final data or is there another `.data`? |
| `.map(item => ...)`  | Add type: `.map((item: Type) => ...)`               |
| `.filter(x => ...)`  | Add type: `.filter((x: Type) => ...)`               |

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
const { data: inventoryData } = useVanInventory(id);
const itemsInStock = inventoryData?.summary?.itemsInStock; // ✅ CORRECT
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

## UI Loading & Hydration Rules (Required for New Pages)

These are mandatory for new pages and when refactoring existing pages:

### 1) No Full-Page Blocking Loaders

- Always render the static layout immediately (header, sidebar, page title, filters).
- Do **not** show full-screen or full-page “Loading…” overlays for data fetches.

### 2) Skeletons for Dynamic Content

- Use skeleton loaders for dynamic sections (tables, cards, widgets, lists).
- On first load, show skeleton rows/cards instead of blank space or spinners.
- Keep filter controls visible; only the data portion should show skeletons.

### 3) Prevent Hydration Mismatch with Radix UI

- Radix components (Select, DropdownMenu, Popover) can cause hydration mismatch.
- Wrap Radix triggers/content in a `ClientOnly` wrapper and provide skeleton fallback.
- Prefer `ClientOnly` for header controls and filter selects on new pages.

### 4) Permission/BU Loading Behavior

- Do not block rendering while permissions or business units load.
- Allow rendering while permissions load, and use skeletons or disabled controls.
- Avoid redirecting to `/403` until permissions are fully loaded.

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
  queryClient.clear(); // Only fixes it on logout, not on permission changes
};
```

#### ✅ GOOD - Architectural Solution

```typescript
// Root cause: Permissions are security-critical and should NEVER be cached
// Solution: Zero-caching strategy across all layers

// 1. Server-side: Disable cache
const CACHE_TTL = 0; // No caching for security

// 2. HTTP layer: Prevent browser caching
response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");

// 3. Client-side: React Query configuration
useQuery({
  staleTime: 0, // Immediately stale
  gcTime: 0, // Clear from cache
  refetchOnMount: true, // Always refetch
  refetchOnWindowFocus: true,
});

// 4. Invalidation: On permission changes
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ["permissions"] });
};

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
    queryKey: ["items"],
    queryFn: async () => {
      const response = await apiClient.get<ItemsResponse>("/api/items");
      return response; // ✅ Returns ItemsResponse directly
    },
  });
}

// Then in component:
const { data } = useItems(); // data is ItemsResponse
const items = data?.data; // Access the items array

// ✅ CORRECT - API returns { data: T }
export function useItem(id: string) {
  return useQuery({
    queryKey: ["item", id],
    queryFn: async () => {
      const response = await apiClient.get<{ data: Item }>(`/api/items/${id}`);
      return response.data; // ✅ Unwrap once to get the Item
    },
  });
}

// Then in component:
const { data: item } = useItem(id); // data is Item directly

// ❌ WRONG - Double unwrapping
export function useItems() {
  return useQuery({
    queryKey: ["items"],
    queryFn: async () => {
      const response = await apiClient.get<ItemsResponse>("/api/items");
      return response.data; // ❌ Error: response is already ItemsResponse
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
   apiClient.get<ItemsResponse>("/api/items");
   // ItemsResponse should match the API response structure
   ```

3. Return the appropriate level:
   - If API returns `{ data: T, pagination }`: return `response` (full response)
   - If API returns `{ data: T }`: return `response.data` (unwrap to T)
   - NEVER return `response.data.data` (double unwrap)

### Common Mistakes

| Mistake                                                 | Why It's Wrong                                                                      | Fix                                         |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------- |
| `return response.data` when API returns `{ data: T[] }` | `response` is already `{ data: T[] }`, accessing `.data` again breaks the structure | `return response`                           |
| `return response.data.data`                             | Double unwrapping - `apiClient` already returns parsed JSON                         | `return response.data` or `return response` |
| Inconsistent unwrapping across hooks                    | Some hooks return `response`, others `response.data` for same API pattern           | Standardize based on API response structure |
