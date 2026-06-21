# Developer Onboarding Guide

Welcome to the ERP System development team! This guide will help you set up your development environment and get familiar with the codebase.

## Prerequisites

Before starting, ensure you have the following installed:

- **Node.js** 18+ ([Download](https://nodejs.org/))
- **npm** (comes with Node.js) or **pnpm** (recommended for faster installs)
- **Git** ([Download](https://git-scm.com/))
- **Docker Desktop** ([Download](https://www.docker.com/products/docker-desktop/)) - for Supabase local development
- **VS Code** ([Download](https://code.visualstudio.com/)) - recommended IDE

## Day 1: Environment Setup

### 1. Clone the Repository

```bash
cd ~/workspace  # or your preferred workspace directory
git clone <repository-url> poc-pragmabiz
cd poc-pragmabiz
```

### 2. Install Dependencies

```bash
# Install Node.js dependencies
npm install

# Or using pnpm (faster)
pnpm install
```

### 3. Install Supabase CLI

```bash
# macOS (via Homebrew)
brew install supabase/tap/supabase

# Or via npm
npm install -g supabase
```

Verify installation:
```bash
supabase --version
```

### 4. Start Supabase Local Development

```bash
# Start all Supabase services (PostgreSQL, API, Studio, etc.)
supabase start
```

**Important**: Wait for all services to start. You should see output with URLs for:
- **API URL**: http://localhost:54321
- **DB URL**: postgresql://postgres:postgres@localhost:54322/postgres
- **Studio URL**: http://localhost:54323
- **Inbucket URL**: http://localhost:54324 (email testing)

**Credentials**:
- **Database Password**: `postgres`
- **JWT Secret**: (shown in output)
- **Anon Key**: (shown in output)
- **Service Role Key**: (shown in output)

### 5. Run Database Migrations

```bash
# Apply all migrations to local database
supabase db reset
```

This will:
1. Reset the database
2. Run all 209 migrations
3. Seed the database with test data (from `supabase/seed.sql`)

### 6. Set Up Environment Variables

Create a `.env.local` file in the project root:

```bash
# Copy from .env.example if it exists, or create manually
touch .env.local
```

Add the following (use values from `supabase start` output):

```env
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key-from-supabase-start>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key-from-supabase-start>
```

### 7. Start the Development Server

```bash
npm run dev
```

The application should now be running at [http://localhost:3000](http://localhost:3000).

### 8. Access Supabase Studio

Open [http://localhost:54323](http://localhost:54323) to access the Supabase Studio (database GUI).

You can:
- Browse tables
- Run SQL queries
- View table relationships
- Test RPC functions
- Monitor real-time subscriptions

### 9. Test Login

Default seed data should include a test user. Try logging in at [http://localhost:3000](http://localhost:3000).

If no seed users exist, create one via Supabase Studio:
1. Go to Authentication → Users
2. Add new user
3. Set email and password
4. Confirm the user

## Day 2: Codebase Familiarization

### 1. Read Core Documentation

Start with these documents in order:

1. **[Project Overview](../kb/00-PROJECT-OVERVIEW.md)** - System architecture and tech stack
2. **[Documentation Index](../DOCUMENTATION-INDEX.md)** - Navigation to all docs
3. **[Engineering Rule](../rules/engineering-rule.md)** - Mandatory development standards

### 2. Explore the Project Structure

```
/
├── src/
│   ├── app/                  # Next.js App Router
│   │   ├── (auth)/           # Auth routes (login, logout)
│   │   ├── (dashboard)/      # Protected dashboard routes
│   │   ├── api/              # API route handlers (207 routes)
│   │   ├── mobile/           # Mobile-optimized pages
│   │   └── ...
│   ├── components/           # React components (181 total)
│   │   ├── ui/               # shadcn/ui base components
│   │   ├── layout/           # Layout components
│   │   ├── inventory/        # Inventory feature components
│   │   ├── sales/            # Sales feature components
│   │   └── ...
│   ├── hooks/                # Custom React hooks (61 total)
│   ├── services/             # Business logic services
│   ├── stores/               # Zustand state stores
│   ├── types/                # TypeScript definitions
│   ├── lib/                  # Utilities and helpers
│   └── ...
├── supabase/                 # Database & backend
│   ├── migrations/           # 209 SQL migrations
│   ├── functions/            # Edge functions
│   └── seed.sql              # Database seed data
└── docs/                     # This documentation
```

### 3. Review Module Documentation

Read the documentation for the module you'll be working on:

- **[Authentication & Authorization](../kb/01-AUTHENTICATION-AUTHORIZATION.md)** - User auth, permissions
- **[Inventory Management](../kb/02-INVENTORY-MANAGEMENT.md)** - Items, warehouses, stock
- **[Sales Management](../kb/03-SALES-MANAGEMENT.md)** - Customers, orders, invoices
- *(Additional modules to be documented)*

### 4. Understand Key Patterns

#### API Route Pattern
```typescript
// Location: src/app/api/[module]/route.ts

import { requirePermission } from '@/lib/permissions'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  // 1. Get authenticated user (middleware ensures this exists)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // 2. Check permission
  await requirePermission(user.id, 'resource_name', 'view')

  // 3. Fetch data with company scoping
  const { data, error } = await supabase
    .from('table_name')
    .select('*')
    .eq('company_id', user.company_id)

  // 4. Return response
  return NextResponse.json(data)
}
```

#### Component Permission Pattern
```typescript
// Location: src/components/[module]/ComponentName.tsx

import { usePermissions } from '@/hooks/usePermissions'

function ComponentName() {
  const { canView, canCreate, canEdit, canDelete, hasCapability } =
    usePermissions('resource_name')

  if (!canView) {
    return <PermissionDenied />
  }

  return (
    <div>
      {canCreate && <CreateButton />}
      {canEdit && <EditButton />}
      {hasCapability('view_cost_price') && <CostPriceField />}
    </div>
  )
}
```

#### Service Pattern
```typescript
// Location: src/services/[module]/service.ts

class ServiceName {
  async performComplexOperation(params) {
    // Call RPC function for atomic transaction
    const { data, error } = await supabase.rpc('function_name', {
      param1: params.value1,
      param2: params.value2
    })

    if (error) throw error
    return data
  }
}
```

### 5. Explore the Database

Open Supabase Studio and explore:

1. **Tables**: Browse core tables (users, items, warehouses, customers, etc.)
2. **Relationships**: View foreign key relationships
3. **RLS Policies**: See Row-Level Security policies
4. **Functions**: Check out RPC functions in Database → Functions
5. **Triggers**: View automatic triggers

### 6. Run a Sample Query

In Supabase Studio SQL Editor, try:

```sql
-- Get all items with their stock levels
SELECT
  i.code,
  i.name,
  w.name as warehouse,
  iw.on_hand,
  iw.reserved,
  iw.available
FROM items i
JOIN item_warehouse iw ON i.id = iw.item_id
JOIN warehouses w ON iw.warehouse_id = w.id
ORDER BY i.code;
```

## Day 3: Make Your First Change

**Note**: This project uses **trunk-based development** - you commit directly to `main` for most changes. Feature branches are optional and only recommended for experimental or risky work.

### 1. Make a Simple Change

Let's add a new field to the Item display:

**Step 1**: Update the component (example)
```typescript
// File: src/components/inventory/ItemCard.tsx

// Add a new field display
<div className="text-sm text-muted-foreground">
  Reorder Point: {item.reorder_point}
</div>
```

**Step 2**: Test in browser
1. Navigate to Items page
2. Verify new field displays

**Step 3**: Add translation
```typescript
// File: src/lib/i18n/translations.ts

export const translations = {
  en: {
    // ...existing translations
    reorder_point: 'Reorder Point'
  }
}
```

**Step 4**: Use translation in component
```typescript
import { useTranslations } from 'next-intl'

const t = useTranslations()

<div>
  {t('reorder_point')}: {item.reorder_point}
</div>
```

### 2. Commit Your Changes

```bash
# Stage changes
git add .

# Commit with descriptive message (use conventional commit format)
git commit -m "feat(inventory): display reorder point in item card"

# Push to main
git push origin main
```

## Development Workflow

### Trunk-Based Development

This project uses **trunk-based development**:
- ✅ Commit directly to `main` for most changes
- ✅ Test thoroughly before pushing
- ✅ Keep commits small and focused
- ❌ No pull requests required
- ❌ No long-lived feature branches

### When to Use a Feature Branch (Optional)

Only create a branch for:
- **Experimental work** you might abandon
- **Large refactors** taking multiple days
- **Breaking changes** that need testing
- **Risky migrations** you want to validate first

Branch workflow (when needed):
```bash
# Create temporary branch
git checkout -b experiment/my-idea

# Make changes and test
git add .
git commit -m "experiment: trying new approach"

# If it works, merge to main
git checkout main
git merge experiment/my-idea
git push origin main

# Delete branch
git branch -d experiment/my-idea
```

### Daily Workflow

1. **Pull latest changes**
   ```bash
   git pull origin main
   ```

2. **Start services**
   ```bash
   supabase start
   npm run dev
   ```

3. **Make changes and test thoroughly**
   - Test in browser
   - Verify no console errors
   - Check mobile responsive design
   - Test with different user roles (if applicable)

4. **Commit and push**
   ```bash
   git add .
   git commit -m "feat(module): description of change"
   git push origin main
   ```

**Important**: Since there's no PR review, YOU are responsible for:
- ✅ Testing your changes thoroughly
- ✅ Running linter before pushing
- ✅ Ensuring migrations work (`supabase db reset`)
- ✅ Not breaking existing functionality

### Testing Your Changes

#### Manual Testing
1. Test in browser at http://localhost:3000
2. Check mobile responsive design (Chrome DevTools)
3. Test with different user roles/permissions
4. Verify translations work

#### Database Changes
```bash
# Reset database to test migrations
supabase db reset

# View migration status
supabase migration list
```

### Common Development Tasks

#### Add a New API Endpoint

1. Create route file: `src/app/api/[module]/route.ts`
2. Implement with permission checks
3. Test with Thunder Client or Postman
4. Document in module docs

**See**: [API Development Guide](API-DEVELOPMENT.md) *(To be created)*

#### Add a Database Migration

1. **Search existing migrations first** (MANDATORY)
   ```bash
   grep -r "CREATE TABLE my_table" supabase/migrations/
   ```

2. Create new migration
   ```bash
   supabase migration new description_of_change
   ```

3. Edit migration file in `supabase/migrations/`

4. Test migration
   ```bash
   supabase db reset
   ```

**See**: [Migration Guide](MIGRATION-GUIDE.md) *(To be created)*

#### Add a New UI Component

1. Create component file in appropriate module folder
2. Use shadcn/ui primitives for consistency
3. Implement permission checks
4. Add translations for all user-facing text
5. Test responsive design

#### Update Translations

1. Edit `src/lib/i18n/translations.ts`
2. Add entries for all supported languages
3. Use translation keys in components
4. Test language switching

**See**: [Language Translation Workflow](../workflow/language-translation-workflow.md)

## Development Tools

### Recommended VS Code Extensions

- **ESLint** - Code linting
- **Prettier** - Code formatting
- **Tailwind CSS IntelliSense** - Tailwind class autocomplete
- **TypeScript Vue Plugin (Volar)** - Better TypeScript support
- **GitLens** - Git history and blame
- **Thunder Client** - API testing
- **Database Client** - Database GUI in VS Code

### Useful Commands

```bash
# Development server (with Turbopack)
npm run dev

# Build for production
npm run build

# Run production build
npm start

# Lint code
npm run lint

# Format code
npm run format

# Supabase commands
supabase start           # Start all services
supabase stop            # Stop all services
supabase db reset        # Reset database and run migrations
supabase db push         # Push local migrations to remote
supabase gen types typescript --local > src/types/database.types.ts  # Generate types
```

### Debugging

#### Client-Side Debugging
- Use Chrome DevTools
- React Developer Tools extension
- Check Network tab for API calls
- View Redux DevTools for state (if using Redux)

#### Server-Side Debugging
- Check terminal for Next.js server logs
- Add `console.log()` in API routes
- Use VS Code debugger with breakpoints

#### Database Debugging
- Use Supabase Studio SQL Editor
- Check PostgreSQL logs in Docker
- Use `EXPLAIN ANALYZE` for slow queries

## Common Issues & Solutions

### Issue: "Module not found" errors
**Solution**: Delete `node_modules` and reinstall
```bash
rm -rf node_modules
npm install
```

### Issue: Database connection errors
**Solution**: Ensure Supabase is running
```bash
supabase stop
supabase start
```

### Issue: Migration errors
**Solution**: Reset database
```bash
supabase db reset
```

### Issue: TypeScript errors after DB changes
**Solution**: Regenerate types
```bash
supabase gen types typescript --local > src/types/database.types.ts
```

### Issue: Port already in use
**Solution**: Kill process using the port
```bash
# macOS/Linux
lsof -ti:3000 | xargs kill -9

# Or change port in package.json
"dev": "next dev -p 3001"
```

## Best Practices

### Code Quality

1. **Type Safety**: Use TypeScript strictly, avoid `any`
2. **Linting**: Run `npm run lint` before committing
3. **Formatting**: Use Prettier (configured in project)
4. **Comments**: Add comments for complex logic
5. **Naming**: Use descriptive, consistent names

### Git Commits

1. **Conventional Commits**: Use format `type(scope): description`
   - `feat(inventory): add reorder point display`
   - `fix(sales): correct invoice total calculation`
   - `refactor(auth): simplify permission checks`

2. **Atomic Commits**: One logical change per commit
3. **Descriptive Messages**: Explain WHY, not just WHAT
4. **Test Before Push**: No PR reviews, so test thoroughly yourself
5. **Small Commits**: Push frequently to avoid large, risky changes

### Security

1. **Never commit secrets**: Use `.env.local` (gitignored)
2. **Permission checks**: Every API route must check permissions
3. **Input validation**: Use Zod schemas
4. **SQL injection**: Use parameterized queries (Supabase does this)
5. **XSS prevention**: React escapes by default, be careful with `dangerouslySetInnerHTML`

## Next Steps

### Week 1 Goals

- [ ] Complete environment setup
- [ ] Read all core documentation
- [ ] Explore codebase structure
- [ ] Understand authentication flow
- [ ] Make first small contribution
- [ ] Get familiar with database schema

### Week 2 Goals

- [ ] Complete first feature ticket
- [ ] Review existing code in your module
- [ ] Understand module workflows
- [ ] Contribute to documentation
- [ ] Participate in code review

### Week 3 Goals

- [ ] Take on medium complexity ticket
- [ ] Propose improvements
- [ ] Help onboard next developer
- [ ] Understand cross-module interactions

## Resources

### Documentation
- [Project Overview](../kb/00-PROJECT-OVERVIEW.md)
- [Documentation Index](../DOCUMENTATION-INDEX.md)
- [Engineering Rules](../rules/engineering-rule.md)
- [Module Documentation](../kb/)

### External Resources
- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://react.dev/)
- [Supabase Documentation](https://supabase.com/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [shadcn/ui Components](https://ui.shadcn.com/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)

### Getting Help

1. **Search documentation** first
2. **Check similar code** in codebase
3. **Review implementation plans** for context
4. **Ask team members** if stuck

## Mandatory Checklist

Before considering yourself onboarded, ensure you can:

- [ ] Start all services locally
- [ ] Run and reset database migrations
- [ ] Login to the application
- [ ] Navigate Supabase Studio
- [ ] Find relevant module documentation
- [ ] Understand permission system basics
- [ ] Create a feature branch
- [ ] Make a code change with proper translations
- [ ] Run linting and formatting
- [ ] Commit with conventional commit format
- [ ] Understand the API route pattern
- [ ] Know where to find migration files
- [ ] Explain the difference between RLS and permission checks

## Welcome Aboard!

You're now ready to contribute to the ERP system. Remember:

1. **Read documentation** before asking
2. **Search for similar code** as examples
3. **Follow development rules** strictly
4. **Test thoroughly** before committing
5. **Ask questions** when genuinely stuck

Happy coding! 🚀
