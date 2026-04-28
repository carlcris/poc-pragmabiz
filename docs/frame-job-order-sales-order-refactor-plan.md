# Frame Job Order Sales Order Refactor Plan

## Goal

Frame job orders must be created from sales orders, not directly from quotations.

Quotations may still capture configurable frame details for pricing and customer approval, but operational work should only begin after the quotation has been converted into a sales order. From the sales order, users should explicitly create a job order when eligible items are present.

## Correct Workflow

1. A user creates a quotation.
2. Configurable frame items can be configured on quotation lines for pricing.
3. Accepting or confirming the quotation must not create a job order.
4. The quotation is converted into a sales order.
5. Frame configuration and component details are copied from quotation lines to sales order lines.
6. The sales order shows a Create Job Order action when it has eligible configured frame lines and no existing job order.
7. Creating the job order is an explicit sales order action.
8. Creating the job order reserves materials and creates job order material rows.
9. Completing the job order consumes reserved stock.

## Current Problem

The current configurable frame implementation creates frame job orders during quotation confirmation. That mixes proposal approval, customer order creation, inventory reservation, operational work, and draft invoicing too early.

The current job order model is also quotation-centric:

- `frame_job_orders.quotation_id`
- `frame_job_order_items.quotation_item_id`
- `frame_job_order_items.quotation_component_id`

The target model should be sales-order-centric:

- `frame_job_orders.sales_order_id`
- `frame_job_order_items.sales_order_item_id`
- job order creation reads sales order frame configuration/components

Quotation references can remain for audit where useful, but they must not be the operational source for new job orders.

## Data Model Plan

Add sales-order-owned frame detail tables:

- `sales_order_item_configurations`
- `sales_order_item_components`

These tables should mirror the quotation frame detail tables closely enough to preserve:

- frame width and height
- fixed allowance
- molding item
- molding stick length
- molding sticks required
- service fee mode/type/amount
- invoice display mode
- component type/source
- component item
- quantity per frame
- total quantity
- UOM
- unit rate
- total amount
- rounding mode
- sort order

Update job order tables:

- add `sales_order_id` to `frame_job_orders`
- add `sales_order_item_id` to `frame_job_order_items`
- add `sales_order_component_id` to `frame_job_order_items`
- index job orders by `sales_order_id`
- prevent duplicate active job orders for the same sales order unless the business later requires split job orders

Existing quotation-oriented columns may stay temporarily for audit/backfill, but new creation logic must use sales-order-owned data.

## Quotation Flow Changes

Quotation confirmation should no longer:

- create frame job orders
- create frame job order items
- create inventory reservations
- consume or reserve stock

Quotation confirmation should only update quotation-level state.

Quotation-to-sales-order conversion should:

- create normal sales order rows
- create normal sales order item rows
- copy quotation frame configuration rows to sales order configuration rows
- copy quotation frame component rows to sales order component rows
- return enough metadata for the UI to show whether the created sales order has job-order-eligible lines

## Sales Order Flow Changes

Add a sales order action:

`POST /api/sales-orders/[id]/create-frame-job-order`

The endpoint should:

- require sales order edit/create permission as appropriate
- validate the sales order exists
- validate the sales order has configured frame lines
- validate there is no existing non-cancelled frame job order for the sales order
- validate warehouse/business unit context required for reservations
- create one frame job order
- create frame job order material rows from sales order frame components
- create inventory reservations
- return the created job order id and code

The multi-row work should be implemented as a database transaction/RPC.

## UI Plan

Sales order UI should show:

- Create Job Order when the sales order has eligible configured frame lines and no active job order
- View Job Order when a job order already exists
- no job-order creation action on quotation pages

Frame job order list/detail should show sales-order-centric source data:

- sales order code as the primary source document
- customer
- status
- linked quotation only as secondary audit context when available
- material/component details from sales order configuration

## Migration and Backfill Plan

If existing frame job order records are local/dev data, resetting the database is acceptable after migration.

If existing records must be preserved:

1. Add nullable sales order linkage columns.
2. Backfill `frame_job_orders.sales_order_id` from the quotation's sales order where a reliable link exists.
3. Backfill job order item sales order links where possible.
4. Report records that cannot be mapped.

Do not add silent compatibility behavior that lets new job orders be created from quotations. Any transition behavior must be explicit and temporary.

## Verification Plan

Run:

- `npm run lint`
- `npm run build`

Database verification:

- apply migration locally
- run the new sales-order job-order RPC inside a transaction when practical

Manual workflow verification:

1. Create a quotation with a configurable frame line.
2. Convert the quotation to a sales order.
3. Confirm the quotation did not create a job order.
4. Confirm the sales order has copied frame details.
5. Create a job order from the sales order.
6. View the job order details.
7. Complete the job order.
8. Verify reserved stock is consumed only on job order completion.

## Implementation Order

1. Add this plan document.
2. Inspect current sales order schema, conversion RPCs, and UI actions.
3. Add sales-order frame configuration/component schema and job-order sales order linkage.
4. Refactor quotation confirmation to stop creating job orders/reservations.
5. Refactor quotation-to-sales-order conversion to copy frame details to sales order rows.
6. Add sales-order job-order creation RPC.
7. Add `POST /api/sales-orders/[id]/create-frame-job-order`.
8. Update sales order UI with Create Job Order and View Job Order actions.
9. Update frame job order list/detail API and UI to use sales order source data.
10. Run lint/build and report any database migration requirements.
