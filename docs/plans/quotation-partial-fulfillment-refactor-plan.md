# Quotation Partial Fulfillment Refactor Plan

## Goal

Refactor quotations from a one-quotation-to-one-sales-order workflow into a line-level source workflow where one sales order can include:

- Inventory-selected lines that are not linked to quotations.
- Lines selected from one or more accepted customer quotations.
- Multiple separate lines from the same quotation when the user selects separate quotation line items.

The sales order header must not assume a single quotation source.

## Finalized Requirements

- A quotation can be the source of multiple sales orders.
- A sales order can fulfill multiple quotation line items, including line items from different quotations.
- A sales order can also contain inventory items that are not from any quotation.
- Quotation-sourced sales order lines must reference the source quotation line item.
- Inventory-sourced sales order lines must not reference quotation line items.
- Quotation line items selected into sales orders must remain separate sales order lines. Do not merge quotation lines, even when item, UOM, or price match.
- Only line items from the selected customer are available for quotation sourcing.
- Only quotation lines from quotations with `accepted` or `partially_ordered` status can be selected.
- Creating a sales order from quotation lines creates a `draft` sales order first.
- Draft sales orders count toward quotation fulfillment immediately.
- Cancelling a sales order removes its linked quantities from quotation fulfillment.
- Sales order line quantity may exceed the remaining quotation quantity, but quotation fulfillment is capped at the quoted line quantity.
- Editing sales order line quantities updates quotation fulfillment.
- Deleting linked sales order lines updates quotation fulfillment.
- Changing a linked sales order line to a different inventory item clears the quotation link and updates quotation fulfillment.
- Frame-configured quotation lines can be partially fulfilled. Required frame materials/components must be recalculated for the selected sales order quantity.
- Confirming a quotation must not create a sales order.
- Confirming a quotation must not create an invoice.
- Invoices should be created from sales orders, not directly from quotations.

## Status Model

Keep existing `ordered` as the fully fulfilled terminal status and add:

```txt
partially_ordered
```

Expected status transitions:

```txt
draft -> sent
draft -> accepted
draft -> rejected

sent -> accepted
sent -> rejected
sent -> expired

accepted -> partially_ordered
accepted -> ordered
partially_ordered -> accepted
partially_ordered -> ordered
ordered -> partially_ordered
ordered -> accepted
```

Reversions from `ordered` or `partially_ordered` happen when linked sales orders are cancelled, deleted, or edited so that quotation fulfillment decreases.

Rejected and expired quotations should not be selectable as sales order sources.

## Data Model Direction

Remove the header-level quotation source from sales orders.

```txt
sales_orders.quotation_id -- remove
```

Do not keep legacy or compatibility behavior for `sales_orders.quotation_id`.

The quotation source belongs on sales order lines:

```txt
sales_order_items.quotation_id UUID NULL
sales_order_items.quotation_item_id UUID NULL
```

Rules:

- Inventory-selected line:
  - `quotation_id = NULL`
  - `quotation_item_id = NULL`
- Quotation-selected line:
  - `quotation_id = source sales_quotations.id`
  - `quotation_item_id = source sales_quotation_items.id`

Recommended constraints and indexes:

```txt
FK sales_order_items.quotation_id -> sales_quotations.id
FK sales_order_items.quotation_item_id -> sales_quotation_items.id
INDEX sales_order_items(company_id, quotation_id)
INDEX sales_order_items(company_id, quotation_item_id)
INDEX sales_order_items(order_id, quotation_item_id)
```

Also remove or stop using incompatible one-to-one quotation fields:

```txt
sales_quotations.sales_order_id -- remove unless separately required before implementation
```

Given the no-legacy decision for `sales_orders.quotation_id`, the implementation should audit and remove all assumptions that a quotation has one sales order.

## Fulfillment Calculation

Quotation fulfillment should be derived from non-deleted sales order items linked to quotation line items, excluding cancelled sales orders.

For each quotation line:

```txt
quoted_quantity = sales_quotation_items.quantity
ordered_quantity = SUM(linked sales_order_items.quantity from non-cancelled sales orders)
served_quantity = MIN(quoted_quantity, ordered_quantity)
remaining_quantity = MAX(quoted_quantity - served_quantity, 0)
```

If a sales order line exceeds the remaining quotation quantity:

```txt
SO line quantity stays as entered
quotation served quantity is capped at remaining quotation quantity
```

Example:

```txt
Quote line qty: 10
Already served: 8
Remaining: 2
New SO line qty: 5

SO line quantity: 5
Quotation fulfillment increment: 2
Quotation remaining: 0
```

Quotation status should be recalculated from line-level fulfillment:

- No served quantity and current fulfillment status was `partially_ordered` or `ordered`: set to `accepted`.
- Some served quantity but not fully served: set to `partially_ordered`.
- All quotation lines fully served: set to `ordered`.

Only apply these recalculated statuses to quotations in the fulfillment lifecycle. Do not mutate `draft`, `sent`, `rejected`, or `expired` through fulfillment recalculation unless the business explicitly allows it later.

## UI Changes

### Sales Order Create/Edit

Sales order line entry needs a source selector:

```txt
Inventory
Customer Quotations
```

Inventory source:

- Existing item search behavior.
- Creates an unlinked sales order line.

Customer quotation source:

- Show eligible quotation line items for the selected customer.
- Eligible statuses: `accepted`, `partially_ordered`.
- Show quote number, quote date, line item, quoted quantity, already ordered quantity, remaining quantity, UOM, price, discount, tax, and frame indicator when applicable.
- User selects specific quotation lines and quantities.
- Each selected quotation line becomes a separate sales order line.

Sales order line table should indicate source:

```txt
Inventory
Quotation QT-000000001 line ...
```

### Quotation List and Details

Replace the old one-time "Convert to Order" language with source/fulfillment language:

```txt
Create Sales Order
Create Sales Order from Quotation
Fulfill Quotation
```

Display fulfillment state:

- Quoted quantity
- Ordered/served quantity
- Remaining quantity
- Related sales orders, grouped by quotation line where useful

### Quotation Confirmation

Confirming or accepting a quotation should only approve it for ordering.

Remove draft invoice creation from the confirmation workflow.

## API/RPC Changes

### Quotation Confirmation

Refactor `confirm_sales_quotation_transaction`:

- Keep validation and status update to `accepted`.
- Remove draft invoice creation.
- Remove invoice item creation.
- Remove frame job reservation side effects unless separately needed by a later workflow.
- Return accepted quotation information only.

### Sales Order Creation From Quotation Lines

Replace the current one-shot quotation conversion behavior with sales order creation that accepts mixed line sources:

```txt
items: [
  {
    itemId,
    quantity,
    uomId,
    rate,
    quotationId?: null | uuid,
    quotationItemId?: null | uuid
  }
]
```

Validation:

- If `quotationItemId` is supplied, `quotationId` must also be supplied.
- Quotation must belong to the selected customer.
- Quotation status must be `accepted` or `partially_ordered`.
- Quotation item must belong to the quotation.
- Sales order line item/UOM should match the quotation line unless explicitly cleared and treated as inventory-sourced.

Create sales order as `draft`.

After insert/update/delete/cancel of sales order lines, recalculate affected quotation statuses.

### Existing Conversion Endpoint

The current endpoint:

```txt
POST /api/quotations/[id]/convert-to-sales-order
```

should be removed or replaced with a new API that creates draft sales orders from selected quotation line items.

Do not keep compatibility behavior that assumes one quotation maps to one sales order.

## Frame-Configured Lines

When a frame quotation line is selected for sales order:

- Copy the frame configuration to the sales order line.
- Recalculate component quantities using the selected sales order line quantity.
- Recalculate molding sticks and material requirements for the selected quantity.
- Keep parent sales order line `skip_inventory = true` for frame-configured lines.
- Store copied component references so downstream job order/manufacturing flows can use the sales order configuration.

If the linked sales order line quantity changes later:

- Recalculate frame components for the new quantity.
- Recalculate quotation fulfillment.

## Implementation Phases

1. Schema migration
   - Add `partially_ordered` support.
   - Add line-level quotation references to `sales_order_items`.
   - Drop `sales_orders.quotation_id`.
   - Remove `sales_quotations.sales_order_id` if no longer needed after audit.
   - Add indexes and foreign keys.

2. Database functions
   - Add quotation fulfillment recalculation function.
   - Refactor quotation confirmation to status-only.
   - Refactor sales order create/update/cancel flows to maintain quotation fulfillment.
   - Remove one-to-one quotation conversion logic.

3. API layer
   - Update quotation endpoints and response types.
   - Update sales order create/edit APIs for mixed item sources.
   - Remove or replace the old conversion endpoint.

4. Frontend
   - Update quotation list/status labels/actions.
   - Add quotation line picker to sales order line entry.
   - Show quotation fulfillment metrics.
   - Update frame line partial fulfillment behavior.

5. Tests
   - Add/adjust tests for partial fulfillment once the Jest harness is available.
   - Required coverage:
     - Multiple sales orders from one quotation.
     - One sales order fulfilling multiple quotations.
     - Inventory-only line does not affect quotation.
     - Over-quantity SO line caps quotation fulfillment.
     - Cancelled SO releases fulfillment.
     - Edited/deleted SO line recalculates fulfillment.
     - Frame line partial quantity recalculates materials.

## Open Implementation Risks

- Existing sales order APIs, reports, and UI may assume `sales_orders.quotation_id`.
- Existing quotation reports may assume `sales_quotations.sales_order_id`.
- Current confirmation flow creates draft invoices; removing this changes accounting/customer workflow behavior.
- Frame line recalculation must match existing frame quotation formulas to avoid pricing/material drift.
- Sales order cancellation/edit paths must be audited so quotation fulfillment always stays consistent.
