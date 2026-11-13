# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Internal staff of a single business operating multi-warehouse, multi-business-unit retail/trade
operations. Primary roles:

- **Warehouse/inventory staff**: stock picking, GRN receiving, location and transfer handling,
  stock adjustments. Likely mobile/tablet surfaces during physical warehouse work.
- **Sales & purchasing staff**: quotations, sales orders, purchase orders, vendor and customer
  management, load list consolidation. Primarily desktop.
- **Accounting/finance staff**: GL posting, journal entries, trial balance, AR/AP reconciliation.
- **Store/POS cashiers**: point-of-sale transactions, tablet-based.

Each user's visible navigation and actions are scoped by granular, role-based permissions (73+
resources, 40+ capabilities); the same shell serves every role, gated by what the signed-in user
can see and do.

## Product Purpose

An ERP system covering inventory, sales, purchasing, accounting, manufacturing, reporting, and
point of sale for one company's own multi-warehouse, multi-business-unit operations. It replaces
fragmented spreadsheets/manual tracking with a single system of record: real-time stock across
warehouses and locations, the full sales workflow (quotation through invoice and delivery), the
full purchasing workflow (requisition through PO and receipt), automatic GL posting, manufacturing
BOM/transformation tracking, and POS transactions. Success means staff in every role can complete
their workflow (pick, receive, quote, post, sell) accurately and quickly, with data staying
consistent across modules (e.g., a stock move updates inventory, GL, and reports together).

## Positioning

This is an internal operations tool built for one business's own operations, not a multi-tenant
SaaS product sold to other companies. "Multi-tenant" in this codebase means business-unit and
company-level scoping within the one operating business, not separate paying customers. The
differentiator is depth of integration across modules under one roof — a stock move, sale, or
purchase reconciles inventory, accounting, and reporting together via DB-owned transactional
operations, rather than being a loose assembly of disconnected tools.

## Operating Context

- Desktop web is the primary surface for sales, purchasing, and accounting staff doing structured
  data entry and review (quotations, POs, journal entries, reports).
- Tablet and mobile surfaces (`src/app/mobile/`, `src/app/tablet/`, `apps/mobile/` React Native
  Expo app) serve warehouse and POS workflows performed while physically moving around a
  warehouse or store floor: picking, GRN receiving, stock adjustments/transfers, POS checkout.
- Real-time inventory spans multiple warehouses and locations within them; on-hand, reserved, and
  available quantities must stay consistent as stock moves between locations, warehouses, and
  sales/purchasing documents.
- Workflows are stateful documents with transitions (quotation → sales order → invoice; requisition
  → PO → receipt; pick list → dispatch), each requiring atomic, DB-owned transactional operations
  so no workflow is left in a partially-written state.
- Barcode/QR scanning exists for specific item-level flows (e.g., item lookup, GRN scan receiving)
  but is not a general document-scanning capability — see constraints below.

## Capabilities and Constraints

- No offline mode on mobile: the mobile app assumes live connectivity; no sync/offline UI should
  be designed into mobile or tablet surfaces.
- No document scanning on mobile: load lists and pick lists are not scannable documents; scanning
  is limited to specific barcode/QR item flows already implemented, not a general-purpose capture
  feature.
- Business operations that write across tables or trigger workflow state transitions must be
  implemented as DB-owned transactional RPCs, not chained client calls (see `AGENTS.md`).
- Multi-tenancy is company- and business-unit-scoped; RLS policies enforce data isolation at the
  database level, not at the application layer alone.
- Internationalization: `en` and `zh` locales via `next-intl`, kept in parity.

## Brand Commitments

None confirmed yet. No existing name/logo/voice constraints have been established beyond the
working project name "ERP Frontend (poc-pragmabiz)".

## Evidence on Hand

No real customer testimonials, case studies, press, or production usage data are on hand. Treat
the system as pre-production/active development; do not fabricate adoption claims, metrics, or
customer quotes in any surface.

## Product Principles

1. One system of record: a single workflow operation (stock move, sale, purchase, workflow
   transition) must leave inventory, accounting, and reporting consistent together, never
   piecemeal.
2. Role-scoped, not role-forked: every user works in the same shell and the same component
   library; differences come from permission-gated visibility, not separate UIs per role.
3. Physical-floor surfaces stay lean: mobile/tablet workflows (picking, receiving, POS) are
   optimized for quick, connected, in-motion use — no offline mode, no general document scanning.
4. Data integrity over convenience: multi-step business operations are atomic and DB-owned;
   partial writes from a failed multi-call flow are treated as a correctness defect.
5. Internal tool discipline: this serves one company's own operations, so design and product
   decisions should optimize for the actual internal workflows and roles above, not generic
   multi-customer SaaS concerns (onboarding funnels, billing tiers, public marketing surfaces).

## Accessibility & Inclusion

WCAG 2.1 is the stated standard for the web application (per `docs/kb/00-PROJECT-OVERVIEW.md`).
