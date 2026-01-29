# Transformation Feature - Troubleshooting Guide

## Issue: 404 Error on `/inventory/transformations`

### Quick Fix

**The pages are installed correctly.** This is likely a Next.js cache issue. Try these steps:

### Step 1: Restart the Dev Server
```bash
# Stop the current dev server (Ctrl+C)
# Then restart:
cd /Users/carl/workspace/react-app/poc-pragmabiz
npm run dev
```

### Step 2: Clear Next.js Cache
```bash
cd /Users/carl/workspace/react-app/poc-pragmabiz
rm -rf .next
npm run dev
```

### Step 3: Verify Files Are in Place

Check that these files exist:
```bash
ls src/app/\(dashboard\)/inventory/transformations/page.tsx
ls src/app/\(dashboard\)/inventory/transformations/templates/page.tsx
ls src/hooks/useTransformationOrders.ts
ls src/hooks/useTransformationTemplates.ts
ls src/components/transformations/TransformationTemplateFormDialog.tsx
```

All files should exist ✅

### Step 4: Check TypeScript Compilation

From the app directory:
```bash
npm run build
```

If there are TypeScript errors, they will show here.

---

## Verify Installation

### Files Created (Should All Exist)

**Backend:**
- ✅ `supabase/migrations/20251217000000_transformation_schema.sql`

**Types:**
- ✅ `src/types/transformation-template.ts`
- ✅ `src/types/transformation-order.ts`
- ✅ `src/types/transformation-lineage.ts`

**Validation:**
- ✅ `src/lib/validations/transformation-template.ts`
- ✅ `src/lib/validations/transformation-order.ts`

**Service:**
- ✅ `src/services/inventory/transformationService.ts`

**API Routes:**
- ✅ `src/app/api/transformations/templates/route.ts`
- ✅ `src/app/api/transformations/templates/[id]/route.ts`
- ✅ `src/app/api/transformations/orders/route.ts`
- ✅ `src/app/api/transformations/orders/[id]/route.ts`
- ✅ `src/app/api/transformations/orders/[id]/release/route.ts`
- ✅ `src/app/api/transformations/orders/[id]/execute/route.ts`
- ✅ `src/app/api/transformations/orders/[id]/complete/route.ts`
- ✅ `src/app/api/transformations/orders/[id]/close/route.ts`

**API Clients:**
- ✅ `src/lib/api/transformation-templates.ts`
- ✅ `src/lib/api/transformation-orders.ts`

**Hooks:**
- ✅ `src/hooks/useTransformationTemplates.ts`
- ✅ `src/hooks/useTransformationOrders.ts`

**Pages:**
- ✅ `src/app/(dashboard)/inventory/transformations/page.tsx`
- ✅ `src/app/(dashboard)/inventory/transformations/templates/page.tsx`

**Components:**
- ✅ `src/components/transformations/TransformationTemplateFormDialog.tsx`
- ✅ `src/components/transformations/TransformationTemplateDetailDialog.tsx`

---

## Common Issues & Solutions

### Issue: "Module not found" error

**Solution:** Make sure you're in the correct directory
```bash
cd /Users/carl/workspace/react-app/poc-pragmabiz
npm install
npm run dev
```

### Issue: TypeScript errors about missing types

**Solution:** The types are all created. Try:
```bash
# Restart TypeScript server in VSCode
# Command Palette (Cmd+Shift+P) > "TypeScript: Restart TS Server"
```

### Issue: API returns 401 Unauthorized

**Solution:** Make sure you're logged in
- Check Supabase auth is working
- Verify JWT token in browser storage

### Issue: Database tables don't exist

**Solution:** Run the migration
```bash
cd /Users/carl/workspace/react-app/poc-pragmabiz
supabase db reset
```

---

## Test Database Migration

From the project root:
```bash
supabase db reset
```

Should see:
```
Applying migration 20251217000000_transformation_schema.sql...
```

Verify tables:
```bash
docker exec supabase_db_backend psql -U postgres -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'transformation%' ORDER BY tablename;"
```

Should return 7 tables:
```
transformation_lineage
transformation_order_inputs
transformation_order_outputs
transformation_orders
transformation_template_inputs
transformation_template_outputs
transformation_templates
```

---

## Manual Testing

### 1. Test API Endpoints

**Create Template:**
```bash
curl -X POST http://localhost:3000/api/transformations/templates \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "templateCode": "TEST-001",
    "templateName": "Test Template",
    "inputs": [{"itemId": "item-uuid", "quantity": 1, "uomId": "uom-uuid"}],
    "outputs": [{"itemId": "item-uuid", "quantity": 1, "uomId": "uom-uuid"}]
  }'
```

**List Templates:**
```bash
curl http://localhost:3000/api/transformations/templates \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 2. Test UI Pages

Navigate to:
- http://localhost:3000/inventory/transformations
- http://localhost:3000/inventory/transformations/templates

---

## Still Having Issues?

### Check Next.js Logs

Look at the terminal where `npm run dev` is running. Look for:
- Compilation errors
- Runtime errors
- Module not found errors

### Check Browser Console

Open DevTools (F12) and check:
- Console tab for JavaScript errors
- Network tab for failed API requests

### Check File Paths

Make sure you're in the right directory:
```bash
pwd
# Should output: /Users/carl/workspace/react-app/poc-pragmabiz
```

---

## Contact for Help

If issues persist, provide:
1. Output of `npm run dev`
2. Browser console errors
3. Any TypeScript errors
4. Result of `ls src/app/\(dashboard\)/inventory/transformations/`

---

**Most likely solution:** Just restart the dev server! 🚀
