# Granular Permissions Rollout Plan

This plan tracks the rollout of field, widget, section, and operation-level permissions across the app.

Authoritative rule: `docs/rules/granular-permissions-rule.md`.

## Goal

Extend the current module-level RBAC implementation so users can keep normal module CRUD access while sensitive widgets, cards, fields, columns, reports, and derived values are hidden or redacted when not permitted.

Example target behavior:

- User can view and edit stock requisitions.
- User cannot see stock requisition total amount, unit cost, import cost, stock value, margin, or related dashboard widgets.
- API responses do not expose those values in DevTools/network responses.
- Update payloads omit redacted fields and never overwrite hidden values with `null`.

## Status Legend

- `Not Started`: no granular permissions implemented yet.
- `Inventory`: protected fields/widgets have been identified.
- `Permission Seeded`: granular permission catalog entries exist.
- `API Redacted`: server responses redact forbidden values.
- `UI Wired`: UI consumes capabilities and hides/redacts surfaces.
- `Mutation Safe`: create/update paths omit forbidden fields and reject unauthorized submitted fields.
- `Regressed`: denied and allowed role checks passed.
- `Done`: all required rollout checks passed.

## Global Rollout Order

1. Foundation: capability catalog, resolver, API capability response shape, UI helpers, permission settings UI.
2. Dashboard widgets and cards.
3. Purchasing modules.
4. Inventory modules.
5. Sales modules.
6. Accounting and finance modules.
7. Reports, analytics, exports, and print/PDF surfaces.
8. Admin and settings review.

## Foundation Inventory

| Area                          | Status            | Notes                                                                                                                                                              |
| ----------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Rollout rule                  | Done              | See `docs/rules/granular-permissions-rule.md`.                                                                                                                     |
| Capability metadata schema    | Permission Seeded | Added granular metadata columns on `permissions`: `parent_resource`, `surface`, `capability_key`, `capability_action`, `label`, `permission_group`, `is_granular`. |
| Effective capability resolver | Done              | Added dynamic capability map resolver while preserving existing module/action permission checks.                                                                   |
| API redaction helpers         | API Redacted      | Phase 1 APIs use explicit capability checks. Broader shared redaction helper extraction can happen as more modules are migrated.                                   |
| UI capability helpers         | UI Wired          | Added `useGranularCapabilities` for UI surfaces that need capability metadata.                                                                                     |
| Permission settings UI        | Not Started       | Needs grouped drill-down editor under each module.                                                                                                                 |
| Permission presets            | Not Started       | Operational User, Supervisor, Finance User, Admin.                                                                                                                 |
| Regression fixture roles      | Inventory         | Phase 1 grants seeded to Super Admin/Admin only; non-admin roles remain denied by default. Dedicated test fixtures still pending.                                  |

## Phase 1: Dashboard Widgets And Cards

Dashboard rollout is first because it exposes many sensitive aggregates while having limited mutation risk.

| Surface                          | Route/API                                                                    | Initial Protected Widgets / Values                                                           | Status  | Notes                                                                                                                                                                                  |
| -------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Main Dashboard                   | `/dashboard`, `/api/analytics/dashboard/widgets`, `/api/warehouse-dashboard` | total sales, top agent sales, recent activity amounts, stock health widgets, reorder widgets | Done    | Analytics API redacts values as `null`; warehouse dashboard skips protected stock/reorder queries and UI hides denied widgets.                                                         |
| Purchasing Overview              | `/purchasing/overview`, `/api/dashboard/purchasing`                          | stock requisition value, damaged item value, supplier spend capability seed                  | Done    | Outstanding requisition and damaged item values are redacted server-side and UI-safe.                                                                                                  |
| Reports Home Cards               | `/reports`                                                                   | financial report cards, revenue cards, valuation cards, sensitive report shortcuts           | Done    | UI hides denied cards; financial and valuation report APIs now block denied direct access for covered reports.                                                                         |
| Sales Analytics                  | `/reports/sales-analytics`, `/api/analytics/sales/*`                         | total sales, commissions, average order value, sales rankings                                | Done    | Analytics APIs redact protected money values; charts/tables render denied values as `--` or zero-value chart data without exposing amounts.                                            |
| Warehouse / Inventory Dashboards | inventory dashboard-related widgets                                          | stock value, valuation, cost, reorder value                                                  | Partial | `/api/warehouse-dashboard` gates stock health/reorder widgets with existing dashboard granular capabilities. Deeper valuation and cost widgets remain tracked for the Inventory phase. |

Dashboard capability examples:

```text
dashboard.widget.total_sales.view
dashboard.widget.stock_value.view
dashboard.widget.reorder_value.view
purchasing_dashboard.widget.stock_requisition_value.view
sales_analytics.widget.employee_commission.view
reports.card.financial_reports.view
```

Dashboard acceptance checks:

- Denied user cannot see protected widget values in API responses.
- Denied user does not see protected dashboard cards/widgets in UI.
- Denied user can still see non-sensitive widgets if they have `dashboard:view`.
- Allowed user sees the same widgets and values as before.
- Loading, empty, and denied states keep the page shell stable.

Phase 1 verification:

- `npm run lint`
- `npm run build`
- `git diff --check`
- Rollback-only SQL validation for `20260506130000_add_phase1_granular_dashboard_permissions.sql`

## Phase 2: Purchasing Modules

| Module             | Resource              | Routes                           | Initial Protected Surfaces                                                  | Status      | Notes                                                                                                                                                   |
| ------------------ | --------------------- | -------------------------------- | --------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stock Requisitions | `stock_requisitions`  | `/purchasing/stock-requisitions` | total amount, unit cost, currency-sensitive totals, supplier cost summaries | Done        | API redacts total/unit costs, UI hides protected columns/fields/PDF, create/update rejects forbidden cost payloads and preserves hidden existing costs. |
| Load Lists         | `load_lists`          | `/purchasing/load-lists`         | total amount, import currency amounts, supplier/shipment cost summaries     | Not Started | Must preserve list/detail currency behavior.                                                                                                            |
| GRNs               | `goods_receipt_notes` | `/purchasing/grns`               | received cost, stock value, variance/damage value                           | Not Started | Approval and stock posting must remain mutation safe.                                                                                                   |
| Purchase Orders    | `purchase_orders`     | `/purchasing/orders`             | unit cost, order total, supplier spend, tax totals                          | Not Started | Protected values affect forms, list, detail, print/export.                                                                                              |
| Purchase Receipts  | `purchase_receipts`   | `/purchasing/receipts`           | receipt value, cost, variance                                               | Not Started | Include tablet receiving surfaces if reused.                                                                                                            |
| Suppliers          | `suppliers`           | `/purchasing/suppliers`          | credit terms, balances, spend summaries, private supplier fields            | Not Started | Master data CRUD may need field edit capabilities.                                                                                                      |

## Phase 3: Inventory Modules

| Module                 | Resource                                       | Routes                                          | Initial Protected Surfaces                                              | Status      | Notes                                                           |
| ---------------------- | ---------------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------- | ----------- | --------------------------------------------------------------- |
| Items                  | `items`                                        | `/inventory/items`                              | standard cost, import cost, list price, margins, supplier/import fields | Not Started | High priority because costs feed many modules.                  |
| Stock                  | `view_location_stock` / inventory stock routes | `/inventory/stock`                              | stock value, cost-derived valuation, batch cost                         | Not Started | Quantities can be separate from values.                         |
| Stock Ledger           | `stock_transactions`                           | `/inventory/ledger`                             | unit cost, transaction value, running value                             | Not Started | API and exports must redact value fields.                       |
| Stock Adjustments      | `stock_adjustments`                            | `/inventory/adjustments`                        | adjustment value, unit cost, variance value                             | Not Started | Mutation paths must reject forbidden cost edits.                |
| Stock Requests         | `stock_requests`                               | `/inventory/stock-requests`                     | source value, destination value, transfer cost                          | Not Started | Keep pick/receive operations available by operation permission. |
| Stock Transfers        | `stock_transfers`                              | stock transfer routes                           | transfer value, unit cost                                               | Not Started | Verify route coverage; not all pages may exist yet.             |
| Transformations        | `stock_transformations`                        | `/inventory/transformations`                    | input cost, output cost, variance, yield cost                           | Not Started | Sensitive because derived costs can reveal item costs.          |
| Reorder Management     | `reorder_management`                           | `/inventory/reorder`                            | reorder value, projected purchase value, supplier cost                  | Not Started | Quantity alerts may remain visible separately.                  |
| Warehouses / Locations | `warehouses`, `manage_locations`               | `/inventory/warehouses`                         | location stock value, inventory value by warehouse                      | Not Started | Warehouse metadata itself remains module-level.                 |
| Manufacturing          | `manufacturing`                                | `/manufacturing/orders`, `/manufacturing/floor` | job cost, material cost, labor cost, variance                           | Not Started | Production floor should avoid financial fields by default.      |

## Phase 4: Sales Modules

| Module           | Resource                             | Routes                                  | Initial Protected Surfaces                                             | Status      | Notes                                                            |
| ---------------- | ------------------------------------ | --------------------------------------- | ---------------------------------------------------------------------- | ----------- | ---------------------------------------------------------------- |
| POS              | `pos`                                | `/sales/pos`, `/sales/pos/transactions` | sales totals, discounts, tax, cashier summaries, void financial effect | Not Started | Cashier may need operational access without analytics.           |
| Sales Orders     | `sales_orders`                       | `/sales/orders`                         | order total, discount, margin, cost, payment summary                   | Not Started | Conversion APIs must preserve redacted field safety.             |
| Sales Quotations | `sales_quotations`                   | `/sales/quotations`                     | quote total, discount, margin, cost                                    | Not Started | Print/export must apply same capabilities.                       |
| Sales Invoices   | `sales_invoices`                     | `/sales/invoices`                       | invoice total, balance, payment details, credit exposure               | Not Started | Finance-sensitive; cash vs credit handling must remain explicit. |
| Customers        | `customers`                          | `/sales/customers`                      | balance, credit limit, ledger summary, payment history                 | Not Started | Customer ledger report must share capabilities.                  |
| Employees        | `employees`                          | `/sales/employees`                      | salary/commission-related fields, performance earnings                 | Not Started | Split HR fields from sales assignment data.                      |
| Frame Job Orders | manufacturing/sales resource mapping | `/sales/frame-job-orders`               | job cost, material cost, margin                                        | Not Started | Align with manufacturing cost capabilities.                      |
| Van Sales        | `van_sales`                          | `/mobile/van-sales/*`                   | daily sales value, commissions, settlement totals                      | Not Started | Mobile API responses must be redacted too.                       |

## Phase 5: Accounting And Finance

| Module            | Resource                   | Routes                                 | Initial Protected Surfaces                 | Status      | Notes                                                   |
| ----------------- | -------------------------- | -------------------------------------- | ------------------------------------------ | ----------- | ------------------------------------------------------- |
| Chart of Accounts | `chart_of_accounts`        | `/accounting/chart-of-accounts`        | account balances, sensitive account groups | Not Started | Structure may be visible while balances are restricted. |
| Journal Entries   | `journal_entries`          | `/accounting/journals`                 | amounts, posting details, reversal amounts | Not Started | Usually finance-only; confirm role model first.         |
| General Ledger    | `general_ledger`           | `/accounting/ledger`                   | debit/credit amounts, balances             | Not Started | Reports and exports must match UI permissions.          |
| Trial Balance     | `general_ledger` / reports | `/accounting/trial-balance`            | balances and movement amounts              | Not Started | May need report-specific capabilities.                  |
| Invoice Payments  | `invoice_payments`         | invoice payment APIs                   | payment amount, method, balance            | Not Started | Do not break operational payment posting.               |
| Commissions       | `commissions`              | `/reports/commission`, sales analytics | commission amount, payout amount, rate     | Not Started | Related to employee and sales analytics surfaces.       |

## Phase 6: Reports, Analytics, Exports, PDFs

| Surface                   | Routes/APIs                              | Initial Protected Surfaces                            | Status      | Notes                                                            |
| ------------------------- | ---------------------------------------- | ----------------------------------------------------- | ----------- | ---------------------------------------------------------------- |
| Reports Home              | `/reports`                               | financial report cards, sensitive report entry points | Not Started | UI card hiding must match API route access.                      |
| Inventory Reports         | `/api/reports/inventory`, stock reports  | cost, value, valuation, margin-derived values         | Not Started | Quantity-only reports may stay visible.                          |
| Product Movement          | `/api/reports/product-movement`          | revenue, stock value, margin                          | Not Started | Already has overlapping text/layout concerns; avoid regressions. |
| Stock Valuation           | `/api/reports/stock-valuation`           | all valuation values                                  | Not Started | Deny whole report unless user can view valuation.                |
| Accounts Receivable Aging | `/api/reports/accounts-receivable-aging` | balances, overdue amount, aging buckets               | Not Started | Finance-specific report capability.                              |
| Customer Ledger           | customer ledger APIs/PDF                 | balances, payments, running balance                   | Not Started | Align with customer financial fields.                            |
| Sales Analytics           | `/api/analytics/sales/*`                 | revenue, commissions, sales totals                    | Not Started | Separate operational sales counts from money values.             |
| PDF/Print Exports         | report PDF components, print views       | every protected source and derived value              | Not Started | No protected data in generated files.                            |

## Phase 7: Admin And Settings Review

| Area             | Resource           | Protected Surfaces                          | Status      | Notes                                                    |
| ---------------- | ------------------ | ------------------------------------------- | ----------- | -------------------------------------------------------- |
| Roles            | `roles`            | permission assignment itself                | Not Started | Existing RBAC must stay module/action compatible.        |
| Permissions      | `permissions`      | granular capability metadata editor         | Not Started | Main settings work for this rollout.                     |
| Users            | `users`            | assigned roles, sensitive user metadata     | Not Started | Ensure user cannot modify own privilege escalation path. |
| Company Settings | `company_settings` | financial/tax settings, integration secrets | Not Started | Secrets should never be returned raw.                    |
| Business Units   | `business_units`   | BU financial settings and scope assignment  | Not Started | Scope permissions remain separate from field visibility. |

## Per-Module Implementation Checklist

Use this checklist when moving any row forward:

- Identify sensitive fields, columns, widgets, sections, reports, exports, and derived values.
- Add explicit granular permission names and metadata.
- Seed permissions for Super Admin/Admin only unless a role is intentionally granted access.
- Add server-side capability resolver coverage.
- Redact protected API response fields before returning JSON.
- Include capability metadata for UI layout decisions.
- Hide or redact UI widgets, cards, table columns, fields, report cards, and export buttons.
- Convert mutation payloads to patch-only contracts where needed.
- Reject forbidden submitted protected fields with `403`.
- Confirm redacted `null` values are never sent back as update input.
- Verify denied role cannot see protected values in DevTools network responses.
- Verify allowed role keeps existing behavior.
- Run `npm run lint`, `npm run build`, and targeted manual regression.

## Tracking Notes

- Current implementation is module/action focused. Granular enforcement is not yet rolled out.
- Do not use frontend-only hiding for protected values.
- Do not add compatibility fallbacks that expose protected data when a granular permission is missing.
- Do not backfill historical permission assignments unless a rollout step explicitly requires seeded access for a role.
- Keep each module's protected field list explicit; do not infer sensitive fields from display labels.
