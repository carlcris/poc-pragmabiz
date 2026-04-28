# Generic Manufacturing and Production Floor Plan

## Goal

Create a generic manufacturing module that can support multiple production workflows. The first concrete use case is frame service chop-and-join work, but the module should not be frame-specific.

The production floor UI must be touch-first, similar to a restaurant kitchen order screen. Operators should be able to see work waiting for them and move jobs forward without using a mouse or keyboard.

## User Intent

Production users work in a busy physical area. They need:

- large readable job cards
- large touch targets
- minimal typing
- direct actions such as Start, Complete Step, Hold, and Report Issue
- clear due/priority indicators
- simple workstation filtering
- job specs visible with one tap
- stable layouts on touch monitors and tablets

The floor screen should not feel like an ERP table. Admin/planning users can use tables, but production operators should use a board-style execution screen.

## Conceptual Model

The manufacturing module has two layers:

1. Manufacturing admin/planning
   - office or supervisor workflow
   - list/search/filter manufacturing orders
   - assign/reassign stations
   - inspect linked sales orders
   - cancel/hold/reopen when permitted

2. Production floor execution
   - touch-first kitchen-display-style board
   - operators see jobs by workstation/status
   - operators advance operations with large buttons
   - operators report holds/issues quickly

## Core Tables

Proposed generic tables:

- `manufacturing_workstations`
- `manufacturing_orders`
- `manufacturing_order_items`
- `manufacturing_order_materials`
- `manufacturing_operations`
- `manufacturing_order_events`

### Manufacturing Orders

Represents the production job.

Important fields:

- company and business unit
- manufacturing order code
- source type and source id
- sales order link
- customer link
- production type
- status
- priority
- due date
- current workstation
- started/completed timestamps
- notes
- custom fields for workflow-specific specs

### Manufacturing Order Materials

Represents required/issued materials.

For frame chop-and-join, these rows come from the sales order frame components:

- molding
- glass
- backing
- accessories
- service-related consumables where needed

### Manufacturing Operations

Represents production steps.

For frame chop-and-join, initial operation template:

1. Cut molding
2. Join frame
3. Fit materials
4. Quality check
5. Ready

Operations have statuses:

- `pending`
- `in_progress`
- `completed`
- `blocked`

Manufacturing order statuses:

- `queued`
- `ready`
- `in_progress`
- `on_hold`
- `quality_check`
- `completed`
- `cancelled`

## Sales Order and Job Order Integration

Manufacturing orders should be released from job orders, not quotations or invoices.

The sales order is the customer commitment. The job order is the internal work instruction. The production floor should receive work only after a job order is explicitly pushed to production.

For frame service:

1. quotation captures frame pricing/configuration
2. quotation converts to sales order
3. frame configuration/components are copied to sales order-owned frame tables
4. sales order creates a job order when eligible
5. job order is reviewed by operations
6. job order shows Push to Production
7. pushing to production creates generic manufacturing rows
8. production floor users execute the manufacturing order

This keeps manufacturing operational data tied to the job order while preserving links back to the sales order and quotation for traceability.

Sales invoices are billing documents only. They must not create, release, or control production work.

Sales order pages may show or create the eligible job order, but they must not expose a direct
"Create Manufacturing" action. The production release belongs on the job order detail page because
that is where operations can confirm the work instruction, reserved materials, and frame specs before
sending it to the floor.

Implementation guardrails:

- disable the legacy sales-order-to-manufacturing RPC path
- remove the sales order API route and client hook for direct manufacturing creation
- expose a job-order API route that calls `create_manufacturing_order_from_frame_job_order_transaction`
- show `Push to Production` on eligible frame job orders
- show `Open Production` after a manufacturing order exists for the job order

## Touch Floor Screen

Route:

`/manufacturing/floor`

Primary layout:

- full-width station/status controls
- large job cards
- no dense tables
- no hover-only actions
- no icon-only primary actions

Job card content:

- manufacturing order code
- sales order code
- customer
- product/spec summary
- current operation
- workstation
- priority
- due date or overdue indicator
- material readiness summary
- large primary action

Primary actions:

- Start
- Complete Step
- Complete Job
- Hold
- Resume
- View Specs

## Admin Screen

Route:

`/manufacturing/orders`

Admin/planning view can be denser than the floor screen, but should still expose:

- search
- status filter
- workstation filter
- priority/due date
- source sales order
- current operation
- View Floor action

## First Implementation Slice

1. Add this plan document.
2. Add generic manufacturing schema and RPCs.
3. Add seeded/default frame workstations:
   - Cutting
   - Joining
   - Assembly
   - Quality Check
   - Ready
4. Add `create_manufacturing_order_from_frame_job_order_transaction`.
5. Add manufacturing list and detail APIs.
6. Add `/manufacturing/orders`.
7. Add `/manufacturing/floor`.
8. Add a job order action to push/view manufacturing orders.
9. Verify lint, build, and migration dry-run.

## Verification Workflow

1. Create or use a sales order with manufacturable/frame-configured items.
2. Create job order from the sales order.
3. Push the job order to production.
4. Open `/manufacturing/floor`.
5. Start the order.
6. Complete operations.
7. Complete the order.
8. Confirm admin list and floor board reflect the state.
9. Confirm no manufacturing order is created directly from a quotation or invoice.
