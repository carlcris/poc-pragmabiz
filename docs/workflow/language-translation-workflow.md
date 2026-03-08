# Language Translation Workflow

## Purpose

This workflow defines the required process for migrating any page, dialog, tab, or module to `next-intl`.

The goal is consistency, correctness, and maintainability.

Current supported locales:

- `en`
- `zh`

## Hard Rules

- Use `next-intl` only.
- Use `src/lib/i18n/translations.ts` as the single source of truth for user-facing text.
- Do not use inline locale conditionals in UI code.
- Do not use local translation maps such as `const tx = { ... }`.
- Do not use dynamic translation access such as `t.generated[...]`.
- Do not use file-path keys, generated keys, or placeholder keys.
- Do not hardcode new UI strings in components when they should be translated.
- Keep formatting separate from translation content.
- Translate validation, toast, empty state, loading state, dialog copy, and error fallback messages, not only headers and labels.

## Required Pattern

### 1. Add messages to `translations.ts`

All strings must be added to both locales under explicit namespaces:

```ts
export const translations = {
  en: {
    common: {
      save: "Save",
    },
    warehousesPage: {
      title: "Warehouse Management",
    },
  },
  zh: {
    common: {
      save: "Save",
    },
    warehousesPage: {
      title: "仓库管理",
    },
  },
};
```

### 2. Read messages directly with `useTranslations`

Use direct namespace access in the component:

```tsx
const t = useTranslations("warehousesPage");

<h1>{t("title")}</h1>
```

### 3. Use shared namespaces for reused text

Examples:

- `common`
- `pagination`
- `forms`

### 4. Use explicit feature namespaces for module-specific text

Examples:

- `warehousesPage`
- `warehouseForm`
- `itemsPage`
- `itemDialog`
- `itemLocationsTab`

## Forbidden Patterns

Do not introduce any of the following:

```tsx
locale === "zh" ? "..." : "..."
```

```tsx
const tx = {
  title: t("title"),
};
```

```tsx
t.generated["some.key"]
```

```tsx
const label = "Create Warehouse";
```

## Migration Sequence

Follow this order every time.

### 1. Inspect the module surface

Identify all user-facing text in the target module:

- page title and subtitle
- buttons
- table headers
- filters
- tabs
- dialog titles and descriptions
- form labels and placeholders
- validation messages
- toast messages
- loading states
- empty states
- error states
- aria labels

Also identify related child components used by the module:

- dialogs
- nested tabs
- shared tables used only by the feature

### 2. Define the target namespaces

Choose semantic namespace names before editing code.

Rules:

- use domain-oriented names
- keep names stable
- avoid file-system-derived names

Examples:

- `salesOrdersPage`
- `purchaseOrderDialog`
- `stockTransformationDetailPage`

Not acceptable:

- `app_dashboard_inventory_items_page`
- `components_items_itemformdialog`

### 3. Add translations for `en` and `zh`

Add every required key to both locale objects in:

- `src/lib/i18n/translations.ts`

Requirements:

- both locales must contain the same keys
- values must be reviewed carefully per locale
- do not leave English values in `zh` by accident
- do not leave Chinese values in `en` by accident

### 4. Replace UI strings with `useTranslations(...)`

In the target component:

- import `useTranslations` from `next-intl`
- initialize the correct namespace
- replace hardcoded strings with `t("key")`

Pattern:

```tsx
const t = useTranslations("itemsPage");

<Button>{t("createItem")}</Button>
```

If a component needs multiple namespaces:

```tsx
const t = useTranslations("itemsPage");
const tCommon = useTranslations("common");
```

### 5. Migrate validation messages

If the module has validation schemas:

- do not hardcode validation strings
- convert schema creation into a factory that accepts translated strings or a translator

Pattern:

```ts
export const createWarehouseSchema = (t: (key: string) => string) =>
  z.object({
    code: z.string().min(1, t("codeRequired")),
  });
```

Usage:

```tsx
const tValidation = useTranslations("warehouseValidation");
const schema = createWarehouseSchema(tValidation);
```

### 6. Migrate toast, dialog, and runtime error copy

Translate all runtime-visible messages:

- success toasts
- error toasts
- confirmation dialogs
- empty-state copy
- retry buttons
- fallback errors

Do not leave operational messages hardcoded.

### 7. Keep formatting separate from text

Do not translate formatting logic manually.

Use locale-aware helpers for:

- date
- number
- currency

Pattern:

```ts
new Intl.DateTimeFormat(locale).format(date);
```

or existing shared formatting helpers.

### 8. Remove dead code and old implementation residue

After migration, remove:

- old i18n imports
- unused locale variables
- unused hardcoded constants
- stale helper functions only used by the old translation approach

### 9. Verify the module end-to-end

The migration is not complete until verification passes.

## Verification Checklist

Run these checks after each migrated module:

### Code scan

Confirm the migrated module does not contain:

- inline locale conditionals
- local translation maps
- dynamic translation access
- leftover hardcoded UI strings introduced by the migration

Suggested scans:

```sh
rg -n 'locale ===|locale!==|const tx =|t\.generated\[|useLanguage\(|useTranslation\(' src
```

### Type check

```sh
npx tsc --noEmit
```

### Lint

```sh
npm run lint
```

### Manual UI verification

Check the target module in both locales:

- English renders English values
- Chinese renders Chinese values
- switching language updates the full module
- labels, placeholders, dialogs, tabs, tables, toasts, and validation are translated
- no language inversion exists
- no untranslated static text remains in the migrated surface

## Definition Of Done

A page or module is complete only when all items below are true:

- all user-facing text in the module is sourced from `next-intl`
- all strings exist in `translations.ts` for `en` and `zh`
- no inline locale logic exists in the migrated module
- no local translation map exists in the migrated module
- no dynamic translation key access exists in the migrated module
- validation and runtime messages are translated
- dead code from the old implementation is removed
- type check passes
- lint passes
- manual verification in both locales passes

## Migration Checklist

- [ ] Identify all user-facing text in the target module
- [ ] Define semantic namespaces
- [ ] Add `en` translations
- [ ] Add `zh` translations
- [ ] Replace hardcoded UI strings with `useTranslations(...)`
- [ ] Migrate validation messages
- [ ] Migrate toast, dialog, loading, empty, and error states
- [ ] Keep formatting locale-aware and separate from translation text
- [ ] Remove old i18n residue and dead code
- [ ] Run `npx tsc --noEmit`
- [ ] Run `npm run lint`
- [ ] Verify English in UI
- [ ] Verify Chinese in UI

## Enforcement Note

If a migration does not follow this workflow, it must be corrected before moving to the next module.
