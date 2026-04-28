# Configurable Frame Quotation and Job Order Plan

## Goal

Extend the existing quotation module so it remains useful for generic product quotations while also supporting configurable frame orders.

Users still create a normal quotation and select a product, for example `Frame`. If the selected product is configured as a frame/configurable item, the user supplies job-specific details such as frame size, molding, allowance, accessories, and service fees. The system calculates required materials, pricing, inventory reservations, job order creation, and draft invoice creation.

This is not a separate quotation module. It is an extension of quotation line behavior.

## Core Business Flow

1. Customer calls or visits the store.
2. Staff creates a quotation.
3. Staff adds a product line.
4. If the product is a normal item, the existing generic quotation line flow applies.
5. If the product is `Frame` or another configurable frame item, the line opens a frame setup panel.
6. Staff enters:
   - quantity
   - width and height in inches
   - molding item
   - fixed molding allowance
   - materials and accessories
   - service fee option
   - invoice display option
7. System calculates the component material quantities and amounts.
8. Customer confirms the quotation.
9. System transactionally:
   - marks the quotation accepted/confirmed
   - reserves component inventory
   - creates a job order for configurable frame lines
   - creates a draft sales invoice
10. When the job order is completed:

- reserved materials are deducted from inventory
- reservations are marked consumed
- job order is marked completed

## Example

User-facing quotation line:

```text
25 Frame (15 x 30)
```

Internal calculated/configured material breakdown:

```text
- 10 Stick 1001-1-BLK Molding
- 25 Sheet Backing
- 25 Sheet Glass
- 50 Pieces D Rings
- Other configured accessories
```

The exact molding stick quantity is calculated from the molding item metadata and can be reviewed during quotation setup.

## Confirmed Rules

- Frame dimensions are entered as `width x height`.
- Dimensions are in inches.
- Molding inventory is priced/handled by piece or stick.
- Molding requirement is rounded up per stick.
- Molding allowance is fixed, not percentage-based.
- Accessories/materials are configured during order setup.
- There is no fixed frame template rules table for backing, glass, D-rings, or accessories.
- Molding stick length comes from the existing inventory item `custom_fields`.
- For molding items, use `custom_fields.width` as the stick length in inches.
- Inventory is reserved when the quotation is confirmed.
- Inventory is deducted when the job order is completed.
- Service fee can support:
  - per frame
  - per order
  - by frame size
  - by service type
- Invoice display can support:
  - summarized frame lines
  - detailed component lines
  - both frame summary and component/service detail

## Calculation Rules

### Molding Sticks

Inputs:

```text
quantity
width_in
height_in
molding_item.custom_fields.width
fixed_allowance_in
```

Formula:

```text
stick_length_in = molding_item.custom_fields.width

width_cut_in = width_in + fixed_allowance_in
height_cut_in = height_in + fixed_allowance_in

cuts = [
  width_cut_in,
  width_cut_in,
  height_cut_in,
  height_cut_in
] repeated quantity times

sticks_required = pack cuts into physical sticks of stick_length_in
```

Important rule:

Molding must be calculated as physical sticks, not as one continuous length. Waste/offcuts can only be reused when another required cut actually fits into the same physical stick.

Recommended packing algorithm:

```text
1. Build all required cuts.
2. Sort cuts from longest to shortest.
3. Put each cut into the first existing stick where it fits.
4. If it does not fit, start a new stick.
5. sticks_required = number of sticks used.
```

This first-fit decreasing approach is deterministic and matches the store workflow closely enough for quotation calculation.

Example with 96-inch sticks:

```text
10 Frame (10 x 30)
fixed allowance = 0 in

cuts required:
- 20 cuts of 30 in
- 20 cuts of 10 in

continuous length would be:
(10 + 30) * 2 * 10 = 800 in
ceil(800 / 96) = 9 sticks

physical stick packing is:
stick 1: 30 + 30 + 10 + 10 + 10 = 90 in, waste 6 in
repeat as needed

sticks required = 10 sticks
```

The continuous-length result of 9 sticks is invalid because it treats molding as if it can be cut from one roll. The system must use the physical-stick cut plan.

### Accessories and Other Materials

Accessories are not fixed by a global template. They are configured on the quotation line.

Examples:

```text
Backing: 25 sheets
Glass: 25 sheets
D Rings: 50 pieces
```

The UI may provide helpers such as "quantity per frame", but the stored result should be explicit quantities on the quotation line components.

### Service Fees

Service fee calculation must store the selected rule and final calculated amount on the quotation line so historical quotations do not change if presets change later.

Supported modes:

```text
per_frame
per_order
size_based
service_type
manual
```

Recommended formulas:

```text
per_frame: quantity * fee_amount
per_order: fee_amount
size_based: resolved configured amount based on width/height
service_type: resolved configured amount based on selected service type
manual: user-entered fixed amount
```

## Data Model Plan

### Item Configuration

Use existing inventory items. Add only minimal metadata needed to identify configurable behavior.

Recommended addition to `items`:

```text
fulfillment_type TEXT
```

Suggested values:

```text
stock
service
configurable
manufactured
```

For the `Frame` product:

```text
fulfillment_type = configurable
```

Alternative if avoiding a new column:

```json
custom_fields: {
  "fulfillment_type": "configurable",
  "configuration_type": "frame"
}
```

The column approach is preferred for filtering and validation.

### Molding Metadata

Use existing inventory `custom_fields` on the molding item.

Example:

```json
{
  "width": 96
}
```

Interpretation:

```text
custom_fields.width = stick length in inches
```

Validation:

- `custom_fields.width` must exist for selected molding items.
- value must be numeric and greater than zero.

### Quotation Item Configuration

Add a child table for configurable product details.

Proposed table: `sales_quotation_item_configurations`

```text
id
company_id
quotation_id
quotation_item_id
configuration_type
width_in
height_in
molding_item_id
fixed_allowance_in
stick_length_in_snapshot
service_fee_mode
service_fee_amount
service_type
invoice_display_mode
configuration_json
created_at
created_by
updated_at
updated_by
deleted_at
```

Notes:

- `stick_length_in_snapshot` stores the molding stick length used at quotation time.
- `configuration_json` stores extra job-specific details and instructions.
- The quotation item remains the customer-facing product line, for example `Frame`.

### Quotation Item Components

Add a child table for generated and manually configured component materials.

Proposed table: `sales_quotation_item_components`

```text
id
company_id
quotation_id
quotation_item_id
configuration_id
component_item_id
component_type
source
quantity_required
uom_id
unit_price
amount
calculation_basis
sort_order
created_at
created_by
updated_at
updated_by
deleted_at
```

Suggested `component_type` values:

```text
molding
backing
glass
hardware
accessory
service
other
```

Suggested `source` values:

```text
auto
manual
override
```

Examples:

```text
component_type = molding
source = auto
quantity_required = sticks_required

component_type = backing
source = manual
quantity_required = 25

component_type = hardware
source = manual
quantity_required = 50
```

### Job Orders

Create job orders only for configurable/manufactured quotation lines.

Proposed table: `frame_job_orders`

```text
id
company_id
business_unit_id
job_order_code
quotation_id
customer_id
sales_invoice_id
status
notes
created_at
created_by
updated_at
updated_by
deleted_at
```

Suggested status values:

```text
draft
reserved
in_progress
completed
cancelled
```

Proposed table: `frame_job_order_items`

```text
id
company_id
job_order_id
quotation_item_id
configuration_id
quantity
width_in
height_in
molding_item_id
status
notes
created_at
created_by
updated_at
updated_by
deleted_at
```

### Inventory Reservations

Use existing reservation/stock allocation structures if available. If none fit, add a generic reservation table.

Proposed table: `inventory_reservations`

```text
id
company_id
business_unit_id
source_type
source_id
source_line_id
item_id
quantity
uom_id
status
reserved_at
consumed_at
released_at
created_by
updated_by
```

Suggested `source_type` values:

```text
frame_job_order
sales_quotation
sales_order
```

Suggested status values:

```text
active
consumed
released
cancelled
```

## Quotation UI Plan

### Add Product Line

When user selects a product:

- If normal stock/service item:
  - keep existing line item behavior.
- If configurable frame item:
  - open frame configuration panel.

### Frame Configuration Panel

Fields:

```text
Quantity
Width in
Height in
Molding item
Fixed allowance in
Service fee mode
Service fee amount or selected preset
Invoice display mode
Notes/instructions
```

Material/component section:

```text
Auto-calculated molding row
Manually added component rows
Optional quick-add helpers for common materials
```

Common material examples:

```text
Backing
Glass
D Rings
Hooks
Mat board
Packaging
Other accessories
```

The UI should show:

```text
Frame summary
Calculated molding sticks
Component material amount
Service fee amount
Line total
```

### Invoice Display Mode

Store per quotation or per configurable line:

```text
summary
components
both
```

Modes:

```text
summary:
25 Frame (15 x 30)

components:
10 Stick 1001-1-BLK Molding
25 Sheet Backing
25 Sheet Glass
50 Pieces D Rings
Service Fee

both:
25 Frame (15 x 30)
  - 10 Stick 1001-1-BLK Molding
  - 25 Sheet Backing
  - 25 Sheet Glass
  - 50 Pieces D Rings
  - Service Fee
```

## API and Service Plan

### Calculation API

Add an endpoint or service function to calculate frame components before saving:

```text
POST /api/quotations/frame/calculate
```

Input:

```json
{
  "quantity": 25,
  "widthIn": 15,
  "heightIn": 30,
  "moldingItemId": "uuid",
  "fixedAllowanceIn": 4,
  "manualComponents": []
}
```

Output:

```json
{
  "molding": {
    "stickLengthIn": 96,
    "sticksRequired": 10,
    "cutLengthIn": 800,
    "wasteLengthIn": 160,
    "unitPrice": 100,
    "amount": 1000
  },
  "components": [],
  "materialAmount": 1000,
  "serviceAmount": 0,
  "lineTotal": 2500
}
```

### Save Quotation

When saving a quotation:

- Save normal quotation items.
- Save frame item configurations for configurable lines.
- Save component rows for configurable lines.
- Store calculated snapshots, not just references.

### Confirm Quotation

Create a transactional RPC for confirmation.

Suggested name:

```text
confirm_sales_quotation_transaction
```

Responsibilities:

1. Lock quotation.
2. Validate status is confirmable.
3. Validate configurable lines are complete.
4. Validate molding items have `custom_fields.width`.
5. Reserve component inventory.
6. Create job order for configurable lines.
7. Create draft invoice.
8. Link quotation, job order, and invoice.
9. Mark quotation confirmed/accepted.

### Complete Job Order

Create a transactional RPC for completion.

Suggested name:

```text
complete_frame_job_order_transaction
```

Responsibilities:

1. Lock job order.
2. Validate status.
3. Deduct reserved inventory.
4. Mark reservations consumed.
5. Mark job order completed.

## Implementation Phases

### Phase 1: Foundation

- Add item fulfillment metadata.
- Add quotation item configuration table.
- Add quotation item component table.
- Add calculation helper for molding sticks from `custom_fields.width`.
- Keep existing generic quotation behavior unchanged.

### Phase 2: Quotation UI

- Detect configurable frame items when selected.
- Add frame setup panel.
- Add component/material editor.
- Add service fee options.
- Add invoice display mode option.
- Show calculated material breakdown and line total.

### Phase 3: Save and Reopen

- Persist frame configurations and components.
- Load existing configurable lines for edit/view.
- Ensure generic quotations still behave as before.

### Phase 4: Confirmation Workflow

- Add confirm quotation action.
- Reserve inventory for components.
- Create frame job order.
- Create draft sales invoice.
- Link all generated records.

### Phase 5: Job Order Completion

- Add job order list/detail pages.
- Add complete job order action.
- Deduct reserved materials.
- Mark reservations consumed.

### Phase 6: Reporting and Polish

- Add internal material breakdown view.
- Add invoice display mode preview.
- Add audit trail for generated materials and overrides.
- Add validation warnings for missing molding width metadata.

## Validation Rules

For configurable frame lines:

- quantity must be greater than zero.
- width and height must be greater than zero.
- molding item is required.
- molding item must have numeric `custom_fields.width`.
- fixed allowance must be zero or greater.
- generated molding quantity must be greater than zero.
- service fee mode is required.
- invoice display mode is required.
- components that affect inventory must have item IDs and quantities.

## Open Decisions

- Whether `Frame` line price should always be calculated from components, or allow manual override.
- Whether service fee presets should be stored in a config table or entered manually first.
- Whether job orders should be frame-specific tables or reuse a more generic production/job order model.
- Whether inventory reservation should be generic for all modules or scoped first to frame job orders.
- Whether customer-facing quotation should hide component prices by default.

## Non-Goals

- Do not remove generic quotation support.
- Do not hardcode backing/glass/hardware templates globally.
- Do not calculate molding from a fixed hardcoded stick length.
- Do not deduct inventory at quotation confirmation; only reserve it.
- Do not deduct materials until the job order is completed.
