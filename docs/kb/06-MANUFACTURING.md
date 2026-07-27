# Manufacturing Module

## Overview

The Manufacturing module manages production operations including Bill of Materials (BOM) templates, transformation orders for stock conversions, cost allocation, lineage tracking, custom assembly jobs, and workstation management.

Dashboard stock transformation screens are under **Manufacturing > Stock Transformations** at `/manufacturing/transformations`.

## Key Features

- **Bill of Materials (BOM)** templates
- **Transformation Orders** for stock transformations/production
- **Cost Allocation** and redistribution
- **Lineage Tracking** for transformed items
- **Frame Job Orders** for custom assembly
- **Workstation** management
- **Production efficiency** metrics
- **Multi-input/output** transformations
- **Atomic transactional** operations

## Manufacturing Architecture

```
┌────────────────────────────────────────────────────────┐
│              Template Layer                             │
│  BOM Templates → Define Input/Output Relationships     │
└────────────────────────────────────────────────────────┘
                          ↓
┌────────────────────────────────────────────────────────┐
│              Order Layer                                │
│  Transformation Orders → Execute Production            │
└────────────────────────────────────────────────────────┘
                          ↓
┌────────────────────────────────────────────────────────┐
│            Execution Layer (RPC)                        │
│  Reserve Inputs → Execute → Update Inventory           │
│  → Calculate Costs → Track Lineage                     │
└────────────────────────────────────────────────────────┘
                          ↓
┌────────────────────────────────────────────────────────┐
│              Inventory Layer                            │
│  Stock Transactions → Inventory Update → COGS Posting  │
└────────────────────────────────────────────────────────┘
```

## Core Concepts

### 1. Transformation Template (BOM)

A **Transformation Template** defines a production recipe: what inputs are required to produce what outputs.

**Key Features**:
- Multi-input items (raw materials)
- Multi-output items (finished goods, by-products)
- Quantity relationships
- Unit conversions
- Reusable templates
- Independent template copies from the current or another business unit

Templates remain owned and isolated by one business unit. When creating a template, a user with
the Stock Transformations `create` permission can start blank or copy an active template from the
same company. The copied values are editable before saving and become a new active template owned
by the current business unit. Later changes to either template do not propagate to the other.

**Example - Sheet Cutting**:
```
Template: "Cut 40x80 Sheet into 10x20 Pieces"
Inputs:
  - Sheet 40x80: 1 unit
Outputs:
  - Piece 10x20: 16 units (4 columns × 4 rows)
  - Scrap/Trim: 0.1 kg (edge waste)
```

**Example - Large Sheet to Small Pieces**:
```
Template: "Cut 48x96 Sheet into 12x24 Pieces"
Inputs:
  - Sheet 48x96 (4ft x 8ft): 1 unit
Outputs:
  - Piece 12x24 (1ft x 2ft): 16 units (4 columns × 4 rows)
  - Edge Trim: 0.15 kg (waste material)
```

### 2. Transformation Order

A **Transformation Order** executes a production run based on a template.

**Key Features**:
- Based on an active template
- Status workflow: Draft → Preparing → Completed (or Cancelled)
- Quantity scaling (make 10x the template)
- Predetermined template additional outputs that are not primary layout cuts
- Warehouse and location tracking
- Cost calculation and redistribution
- Lineage tracking

**Workflow**:
```
Draft → Preparing → Completed
```

Template creators can define predetermined **additional outputs** such as die cuts that are produced
during the same run but are intentionally absent from the template's primary sheet layout. Each
additional output stores an item and quantity per template execution; its unit is always derived
from the item's active base unit and cannot be selected by the user. Creating an order inherits and
scales these outputs automatically. Copies receive independent additional-output rows, so editing a
new copied template cannot change its source. Primary and additional outputs must both be fully
accounted as produced or wasted when the order is completed.

**Shared putaway behavior**:
Transformation completion hands produced output quantities into the shared putaway station instead of posting outputs into the `UNTRACKED` batch or making them immediately available. GRN receiving uses the same putaway model when received goods are submitted for confirmation, and the model also applies to chop-and-join production or any other workflow that creates stock before final warehouse placement. See `docs/plans/shared-putaway-station-plan.md`.

**Cost Redistribution**:
When executing a transformation:
1. Calculate total cost of all inputs (qty × avg_cost)
2. Redistribute total cost across outputs based on proportion
3. Update output item costs

**Example**:
```
Input Costs:
  - Sheet 40x80 (1 unit @ ₱1,200/unit): ₱1,200.00
Total Input Cost: ₱1,200.00

Outputs (redistribute ₱1,200.00):
  - Piece 10x20: 16 units @ ₱74.50/unit = ₱1,192.00 (99.3% of value)
  - Scrap/Trim: 0.1 kg @ ₱80/kg = ₱8.00 (0.7% of value, salvage/recycle)

Unit Cost per 10x20 Piece: ₱74.50
```

### 3. Lineage Tracking

The system tracks **lineage** - the relationship between input items and output items through transformations.

**Use Cases**:
- Quality recalls (trace which outputs came from bad inputs)
- Batch tracking for expiry management
- Audit trail for production

**Example**:
```
Sheet Batch #SH-2025-001 (40x80) → Transformation Order #TO-456 → Pieces 10x20 (Batch #PC-2025-456)
If Sheet Batch #SH-2025-001 is defective, can find all 10x20 Pieces produced from it
```

### 4. Frame Job Orders

A **Frame Job Order** represents custom assembly/framing work created from sales orders requiring custom manufacturing (e.g., picture framing, custom furniture assembly, made-to-order products).

**Key Features**:
- **Created from sales orders** - Triggered when sales order requires custom work
- **Material reservation** - Reserves materials from warehouse inventory
- **Cost tracking** - Tracks material costs and labor
- **Sales integration** - Links back to sales order for invoicing
- **Status workflow** - Draft → In Progress → Completed
- **Atomic transactions** - Uses RPC for data integrity

**Workflow**:
```
Sales Order Created (custom work required)
   ↓
Create Frame Job Order (reserve materials)
   ↓
Start Job (status: in_progress)
   ↓
Complete Job (consume materials, calculate costs)
   ↓
Link to Sales Order (ready for invoicing)
```

**Use Cases**:
- **Picture framing** - Custom frame dimensions, glass, matting
- **Custom furniture** - Made-to-order pieces with specific materials
- **Product assembly** - Assembling components per customer specifications
- **Engraving/customization** - Adding custom work to existing products

**Material Consumption**:
When a frame job order is completed:
1. Materials are consumed from warehouse inventory
2. Stock transactions are created for each material
3. Total material cost is calculated
4. Job order cost is recorded
5. Sales order is updated with job completion status

**Example - Custom Picture Frame**:
```
Sales Order: Custom frame for 24x36 poster
   ↓
Frame Job Order Created:
  Materials:
    - Wood molding: 10 feet
    - Glass sheet: 1 unit (24x36)
    - Backing board: 1 unit
    - Hanging wire: 3 feet
  Labor estimate: 1.5 hours
  Total estimated cost: ₱3,250
  Selling price: ₱7,500
   ↓
Job Completed:
  Actual materials consumed (from inventory)
  Actual cost: ₱3,400
  Margin: ₱4,100
```

### 5. Workstation

A **Workstation** represents a production area or equipment.

**Key Features**:
- Capacity tracking
- Schedule management
- Assigned to transformation orders
- Efficiency metrics

## Database Schema

### Core Tables

#### transformation_templates
```sql
CREATE TABLE transformation_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  business_unit_id UUID REFERENCES business_units(id),
  template_code VARCHAR UNIQUE NOT NULL,
  template_name VARCHAR NOT NULL,
  description TEXT,
  copied_from_template_id UUID REFERENCES transformation_templates(id) ON DELETE SET NULL,
  copied_from_business_unit_id UUID REFERENCES business_units(id) ON DELETE SET NULL,
  copied_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### template_inputs
```sql
CREATE TABLE template_inputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES transformation_templates(id) ON DELETE CASCADE,
  item_id UUID REFERENCES items(id),
  quantity DECIMAL(12,3) NOT NULL,
  unit_id UUID REFERENCES units_of_measure(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### template_outputs
```sql
CREATE TABLE template_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES transformation_templates(id) ON DELETE CASCADE,
  item_id UUID REFERENCES items(id),
  quantity DECIMAL(12,3) NOT NULL,
  unit_id UUID REFERENCES units_of_measure(id),
  cost_proportion DECIMAL(5,4) DEFAULT 1.0,  -- % of input cost
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### transformation_orders
```sql
CREATE TABLE transformation_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  order_number VARCHAR UNIQUE NOT NULL,
  template_id UUID REFERENCES transformation_templates(id),
  warehouse_id UUID REFERENCES warehouses(id),
  workstation_id UUID REFERENCES workstations(id),
  order_date TIMESTAMPTZ DEFAULT now(),
  status VARCHAR DEFAULT 'draft',  -- 'draft', 'reserved', 'executed', 'completed', 'cancelled'
  scale_factor DECIMAL(10,2) DEFAULT 1.0,  -- Multiply template quantities
  total_input_cost DECIMAL(12,2),
  notes TEXT,
  executed_by UUID REFERENCES users(id),
  executed_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### transformation_order_inputs
```sql
CREATE TABLE transformation_order_inputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES transformation_orders(id) ON DELETE CASCADE,
  item_id UUID REFERENCES items(id),
  location_id UUID REFERENCES warehouse_locations(id),
  quantity DECIMAL(12,3) NOT NULL,
  unit_id UUID REFERENCES units_of_measure(id),
  unit_cost DECIMAL(12,2),  -- Cost at time of transformation
  total_cost DECIMAL(12,2),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### transformation_order_outputs
```sql
CREATE TABLE transformation_order_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES transformation_orders(id) ON DELETE CASCADE,
  item_id UUID REFERENCES items(id),
  location_id UUID REFERENCES warehouse_locations(id),
  quantity DECIMAL(12,3) NOT NULL,
  unit_id UUID REFERENCES units_of_measure(id),
  allocated_cost DECIMAL(12,2),  -- Redistributed cost
  unit_cost DECIMAL(12,2),  -- Cost per unit
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### transformation_lineage
```sql
CREATE TABLE transformation_lineage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transformation_order_id UUID REFERENCES transformation_orders(id),
  input_item_id UUID REFERENCES items(id),
  output_item_id UUID REFERENCES items(id),
  input_batch_id UUID,  -- If batch tracking enabled
  output_batch_id UUID,
  transformation_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### frame_job_orders
```sql
CREATE TABLE frame_job_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  job_number VARCHAR UNIQUE NOT NULL,
  sales_order_id UUID REFERENCES sales_orders(id),
  customer_id UUID REFERENCES customers(id),
  job_date TIMESTAMPTZ DEFAULT now(),
  status VARCHAR DEFAULT 'draft',  -- 'draft', 'in_progress', 'completed', 'cancelled'
  description TEXT,
  total_cost DECIMAL(12,2),
  total_price DECIMAL(12,2),
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### frame_job_materials
```sql
CREATE TABLE frame_job_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES frame_job_orders(id) ON DELETE CASCADE,
  item_id UUID REFERENCES items(id),
  quantity DECIMAL(12,3) NOT NULL,
  unit_id UUID REFERENCES units_of_measure(id),
  unit_cost DECIMAL(12,2),
  total_cost DECIMAL(12,2),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### workstations
```sql
CREATE TABLE workstations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  code VARCHAR UNIQUE NOT NULL,
  name VARCHAR NOT NULL,
  warehouse_id UUID REFERENCES warehouses(id),
  capacity_per_day INTEGER,  -- Units per day
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

## API Reference

### Transformation Template Management

#### GET /api/transformations/templates
List transformation templates owned by the current business unit.

**Permissions**: `view` on `stock_transformations`

**Response**:
```json
{
  "data": [
    {
      "id": "uuid",
      "template_code": "SHEET-CUT-001",
      "template_name": "Cut 40x80 Sheet into 10x20 Pieces",
      "inputs": [
        { "item": "Sheet 40x80", "quantity": 1, "unit": "unit" }
      ],
      "outputs": [
        { "item": "Piece 10x20", "quantity": 16, "unit": "unit", "cost_proportion": 0.993 },
        { "item": "Scrap/Trim", "quantity": 0.1, "unit": "kg", "cost_proportion": 0.007 }
      ],
      "is_active": true
    }
  ]
}
```

#### POST /api/transformations/templates
Create transformation template.

**Permissions**: `create` on `stock_transformations` in the current business unit. Template header,
inputs, outputs, and optional copy lineage are created in one database transaction. New templates
are active immediately.

**Request**:
```json
{
  "templateCode": "SHEET-CUT-002",
  "templateName": "Cut 48x96 Sheet into 12x24 Pieces",
  "description": "Cut one 48x96 sheet into sixteen 12x24 pieces with edge trim",
  "inputs": [
    {
      "itemId": "uuid-sheet-48x96",
      "quantity": 1,
      "uomId": "uuid-unit"
    }
  ],
  "outputs": [
    {
      "itemId": "uuid-piece-12x24",
      "quantity": 16,
      "uomId": "uuid-unit",
      "isScrap": false
    },
    {
      "itemId": "uuid-trim-scrap",
      "quantity": 0.15,
      "uomId": "uuid-kg",
      "isScrap": true
    }
  ],
  "copiedFromTemplateId": "optional-active-source-template-uuid"
}
```

#### GET /api/transformations/templates/copy-sources
List active copy sources from the current or other business units in the same company. The endpoint
uses bounded server-side search and pagination and does not grant normal read access to another
business unit's template records.

**Permissions**: `create` on `stock_transformations` in the current business unit.

**Query parameters**: `scope=current|other`, `templateKind=recipe|sheet_layout`, optional `search`,
`page`, and `limit` (maximum 50; creation selectors request 5 at a time).

#### GET /api/transformations/templates/copy-sources/[id]
Return the active source template snapshot needed to initialize a new template. Access is restricted
to the authenticated user's company and current-BU Stock Transformations `create` permission.

### Transformation Order Management

#### POST /api/transformations/orders
Create a draft transformation order atomically from a template.

**Permissions**: `create` on `stock_transformations` in the current business unit.

**Request**:
```json
{
  "templateId": "uuid",
  "warehouseId": "uuid",
  "plannedQuantity": 10,
  "orderDate": "2025-06-14",
  "notes": "Weekly production run"
}
```

**Effect**:
- Creates the order, scaled template inputs, primary outputs, inherited additional outputs, and initial cost allocation in one database transaction.
- Additional-output item, quantity, and base UOM come from the selected template. The order request cannot override them.
- Rejects the template before creating the order if any referenced input, primary output, additional output, or UOM is inactive or deleted.
- Does not reserve inventory yet.

Known create failures return a stable safe reason code. The order form explains whether the selected
template or warehouse is unavailable, the template lacks required lines, a referenced item/UOM is
inactive or deleted, the business-unit context changed, or permission was lost, and tells the user
what to correct. These stale-resource failures use HTTP `409 Conflict`; internal database details
remain server-side.

#### POST /api/transformations/orders/[id]/release
Prepare the transformation order.

**Permissions**: `edit` on `stock_transformations`.

**Effect**:
1. Validates sufficient inventory for inputs
2. Status changes to `PREPARING`

#### POST /api/transformations/orders/[id]/execute
Complete transformation (atomic RPC).

**Permissions**: `edit` on `stock_transformations`.

**Effect** (all in single transaction):
1. **Remove input inventory**
   - Consume available input batches FIFO
   - Record each consumed batch-location slice as its own stock-out transaction using the actual
     source location and batch number
   - Reduce item/warehouse, item batch, and batch/location stock
   - Create negative stock transactions
2. **Calculate total input cost**
   - Sum (input_qty × unit_cost) for all inputs
3. **Add output inventory**
   - Post both primary template outputs and planned additional outputs
   - Create putaway tasks for produced quantities pending final placement
   - Increase item/warehouse putaway quantity
   - Create positive stock transactions
   - Allocate input cost across non-scrap produced and wasted quantities
4. **Create lineage records**
   - Link inputs to outputs
5. **Status changes to `COMPLETED`**
6. **Record execution/completion dates and user**

Completion first verifies and locks every referenced input/output item and UOM. If any line has
become inactive or deleted since order creation, the order remains `PREPARING` and no inventory,
putaway, waste, costing, lineage, or status writes are committed.
This unavailable-item state is returned as an HTTP `409 Conflict` with a stable safe reason code.
The completion dialog stays open and explains that the item/UOM must be reactivated, or that the
order should be cancelled and recreated from a corrected template if it must remain inactive.

If any consumption, output, waste, putaway, lineage, costing, or final-status write fails, the entire completion rolls back.

#### POST /api/transformations/orders/[id]/cancel
Cancel transformation order.

**Permissions**: `delete` on `transformation_orders`

**Effect**:
- If status = 'reserved', releases reservations
- Status changes to 'cancelled'

### Frame Job Order Management

Frame job orders are created from sales orders and managed through their lifecycle.

#### POST /api/sales-orders/[id]/create-frame-job-order
Create frame job order from a sales order.

**Permissions**: `edit` on `sales_orders`

**Request**:
```json
{
  "warehouseId": "uuid"  // Warehouse to reserve materials from
}
```

**Response**:
```json
{
  "success": true,
  "salesOrderId": "uuid",
  "frameJobOrder": {
    "id": "uuid",
    "jobOrderCode": "FJO-001"
  }
}
```

**Effect**:
- Creates frame job order record
- Generates unique job order code (FJO-XXX)
- Links to sales order
- Reserves materials from specified warehouse
- Status set to 'draft'
- Uses RPC: `create_frame_job_order_from_sales_order_transaction`

**Validation**:
- Sales order must exist
- Warehouse ID is required
- User must have edit permission on sales orders
- Sufficient material inventory must be available

**Example Usage**:
```typescript
// Create frame job order from sales order
const response = await fetch(`/api/sales-orders/${salesOrderId}/create-frame-job-order`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    warehouseId: 'warehouse-uuid-here'
  })
})

const { frameJobOrder } = await response.json()
console.log(`Created job order: ${frameJobOrder.jobOrderCode}`)
```

#### GET /api/frame-job-orders
List all frame job orders.

**Permissions**: `view` on `frame_job_orders`

**Query Parameters**:
- `status` (optional) - Filter by status (draft, in_progress, completed, cancelled)
- `sales_order_id` (optional) - Filter by sales order
- `customer_id` (optional) - Filter by customer

**Response**:
```json
{
  "jobOrders": [
    {
      "id": "uuid",
      "job_number": "FJO-001",
      "sales_order_id": "uuid",
      "customer": {
        "id": "uuid",
        "name": "Acme Corp"
      },
      "status": "in_progress",
      "description": "Custom picture frame 24x36",
      "total_cost": 3400.00,
      "total_price": 7500.00,
      "job_date": "2025-06-14",
      "materials": [
        {
          "item": "Wood Molding",
          "quantity": 10,
          "unit": "feet",
          "unit_cost": 175.00,
          "total_cost": 1750.00
        }
      ]
    }
  ]
}
```

#### POST /api/frame-job-orders/[id]/start
Start a frame job order.

**Permissions**: `edit` on `frame_job_orders`

**Effect**:
- Validates materials are reserved
- Status changes to 'in_progress'
- Records start timestamp

#### POST /api/frame-job-orders/[id]/complete
Complete a frame job order.

**Permissions**: `edit` on `frame_job_orders`

**Effect**:
- Consumes materials from inventory (creates stock transactions)
- Calculates total material cost
- Status changes to 'completed'
- Records completion timestamp
- Links completed job back to sales order
- Sales order ready for invoicing

**Validation**:
- Job must be in 'in_progress' status
- All materials must be available in inventory

#### POST /api/frame-job-orders/[id]/cancel
Cancel a frame job order.

**Permissions**: `edit` on `frame_job_orders`

**Effect**:
- Releases reserved materials back to available inventory
- Status changes to 'cancelled'
- Unlinks from sales order (sales order can create new job order if needed)

## Services

### Transformation Operations

Transformation order creation and completion are database-owned operations:

- `create_transformation_order_transaction` creates the order header, template lines, inherited
  additional outputs, and initial costs atomically.
- `complete_transformation_order_transaction` locks and completes the order while owning FIFO input
  consumption, stock transactions, output putaway, waste, lineage, costing, and final status.
- `src/services/inventory/transformationValidationService.ts` contains the remaining read-only
  template, stock-availability, transition, and template-lock validation helpers.

## Workflows

### Workflow 1: Create and Execute Sheet Cutting Transformation

**Example: Cutting 40x80 sheets into 10x20 pieces**

1. **Create Transformation Template**
   - Template: "Cut 40x80 Sheet into 10x20 Pieces"
   - Input: 1 unit of Sheet 40x80
   - Outputs:
     - 16 units of Piece 10x20 (4 columns × 4 rows, 99.3% value)
     - 0.1 kg of Scrap/Trim (edge waste, 0.7% value)

2. **Create Transformation Order**
   - Select template: "SHEET-CUT-001"
   - Scale factor: 10 (to cut 10 sheets)
   - Warehouse: Main Warehouse
   - Optionally add predetermined inventory outputs that are produced by the run but are not primary cuts in the template. Their base UOM is assigned automatically.

3. **System Validates Inventory**
   - Check: 10 sheets of 40x80 available? ✓
   - Current stock: 25 sheets available

4. **Reserve Inputs**
   - System reserves: 10 sheets of 40x80
   - Records cost at reservation: ₱1,200/sheet = ₱12,000 total
   - Available stock reduced: 25 → 15 sheets
   - Reserved stock: 10 sheets

5. **Production Team Performs Cutting**
   - Operator takes 10 sheets to cutting station
   - Cuts each 40x80 sheet into 16 pieces of 10x20
   - Total pieces produced: 160 pieces (10 sheets × 16 pieces)
   - Edge trim collected: ~1 kg total

6. **Execute Transformation Order**
   - Operator confirms cutting complete
   - API: `POST /api/transformations/orders/{id}/execute`

7. **System Executes (Atomic Transaction)**
   - Removes from inventory: 10 sheets of 40x80 (₱12,000)
   - Adds to inventory:
     - 160 pieces of 10x20 @ ₱74.50/unit = ₱11,920
     - 1 kg of Scrap/Trim @ ₱80/kg = ₱80
   - Creates lineage: Links each output piece to source sheet batch
   - Posts COGS GL entry if needed

8. **Order Marked as Completed**
   - Status: Completed
   - 160 pieces now available for sale
   - Scrap collected for recycling/disposal

### Workflow 2: Cost Redistribution

1. Transformation order executed
2. System calculates total input cost:
   ```
   Total = Σ (input_qty × unit_cost)
   ```
3. For each output:
   ```
   allocated_cost = total_input_cost × cost_proportion
   unit_cost = allocated_cost / output_qty
   ```
4. System updates output item costs using moving average
5. New cost used for future COGS calculations

### Workflow 3: Lineage Tracing (Quality Issue with Sheet Batch)

**Scenario**: Defective sheet batch discovered after cutting

1. **Quality Issue Identified**
   - Customer reports defects in 10x20 pieces
   - Investigation reveals issue with source sheet material
   - Sheet Batch #SH-2025-001 identified as defective

2. **Search Lineage for Sheet Batch**
   - User opens Lineage Viewer
   - Searches for: Sheet Batch #SH-2025-001 (40x80)

3. **System Shows Lineage Tree**
   - **Backward (Source)**:
     - Supplier: ABC Sheet Supplier
     - Purchase Order: PO-2025-123
     - Received: Jan 15, 2025
     - Original batch: 50 sheets

   - **Forward (Outputs)**:
     - Transformation Order #TO-456 (Jan 20, 2025)
       - Consumed: 10 sheets from Batch #SH-2025-001
       - Produced: 160 pieces of 10x20 (Batch #PC-2025-456)
     - Transformation Order #TO-489 (Jan 22, 2025)
       - Consumed: 5 sheets from Batch #SH-2025-001
       - Produced: 80 pieces of 10x20 (Batch #PC-2025-489)

   - **Distribution**:
     - 120 pieces sold (Sales Orders: SO-501, SO-508, SO-515)
     - 100 pieces in warehouse inventory
     - 20 pieces in customer orders (pending delivery)

4. **All Affected Products Identified**
   - Total affected: 240 pieces of 10x20
   - Already shipped: 120 pieces (3 customers)
   - In warehouse: 100 pieces
   - Pending shipment: 20 pieces

5. **Quality Control Actions**
   - Quarantine remaining 100 pieces in warehouse
   - Hold pending shipments (20 pieces)
   - Contact 3 customers for product recall
   - Issue credit notes/replacements
   - Contact supplier about defective sheet batch
   - Document root cause in quality system

### Workflow 4: Frame Job Order (Sales to Manufacturing)

**Complete workflow from sales order to completed custom job**:

1. **Sales Order Created**
   - Customer requests custom product (e.g., "24x36 picture frame")
   - Sales rep creates sales order with custom items
   - Sales order status: Pending

2. **Create Frame Job Order**
   - Sales rep clicks "Create Frame Job Order"
   - API: `POST /api/sales-orders/{id}/create-frame-job-order`
   - Request body: `{ warehouseId: "uuid" }`
   - System validates warehouse has materials
   - System generates job order code (FJO-001)
   - Frame job order created, status: Draft
   - Materials reserved from warehouse

3. **Review Job Specifications**
   - Production manager reviews job order
   - Verifies materials list:
     - Wood molding: 10 feet
     - Glass sheet: 1 unit (24x36)
     - Backing board: 1 unit
     - Hanging wire: 3 feet
   - Confirms material reservations
   - Estimates labor time

4. **Start Production**
   - Production team starts work
   - API: `POST /api/frame-job-orders/{id}/start`
   - Frame job order status: In Progress
   - Materials remain reserved
   - Start timestamp recorded

5. **Physical Work Performed**
   - Cut wood molding to size (10 feet total)
   - Cut glass to 24x36 dimensions
   - Assemble frame components
   - Install hanging wire
   - Quality check completed frame

6. **Complete Job**
   - Production team marks job complete
   - API: `POST /api/frame-job-orders/{id}/complete`
   - System performs (atomic transaction):
     - Consumes reserved materials from inventory
     - Creates stock transactions for each material
     - Calculates total material cost (₱3,400)
     - Records completion timestamp
     - Updates frame job order status: Completed
     - Links completed job to sales order

7. **Invoice Customer**
   - Sales order now shows job complete
   - Sales rep creates invoice from sales order
   - Invoice includes custom job charge (₱7,500)
   - Material cost tracked separately (₱3,400)
   - Gross margin: ₱4,100

**Example Timeline**:
```
Day 1, 10:00 AM - Sales order created
Day 1, 10:15 AM - Frame job order created (FJO-001)
Day 1, 02:00 PM - Job started (production begins)
Day 2, 11:00 AM - Job completed (frame assembled)
Day 2, 02:00 PM - Invoice sent to customer
Day 3          - Customer picks up framed poster
```

**Integration Points**:
- **Sales Module**: Sales order triggers frame job order creation
- **Inventory Module**: Material reservation and consumption
- **Accounting Module**: Cost tracking for profitability analysis
- **Reporting Module**: Job efficiency and profitability reports

## UI Components

### Key Components

#### TransformationTemplateForm
**Location**: `src/components/manufacturing/TransformationTemplateForm.tsx`
- Create/edit templates
- Add input/output items
- Set cost proportions

#### TransformationOrderForm
**Location**: `src/components/manufacturing/TransformationOrderForm.tsx`
- Create transformation orders
- Select template
- Set scale factor

#### TransformationExecutionUI
**Location**: `src/components/manufacturing/TransformationExecutionUI.tsx`
- Execute transformation
- View cost calculations
- Confirm execution

#### LineageViewer
**Location**: `src/components/manufacturing/LineageViewer.tsx`
- Visualize lineage tree
- Trace forward/backward
- Export lineage report

#### FrameJobOrderForm
**Location**: `src/components/manufacturing/FrameJobOrderForm.tsx`
- Create custom jobs
- Add materials
- Track status

## Reports

### Transformation Efficiency Report
**Location**: `/api/reports/transformation-efficiency`

Shows production efficiency metrics: planned vs actual, waste, costs.

### Production Summary
**Location**: `/api/analytics/manufacturing/production`

Summarizes production volumes by template, workstation, period.

### Lineage Report
**Location**: `/api/reports/lineage`

Detailed lineage tracing for quality management.

## Troubleshooting

### Issue: Transformation execution fails
**Symptoms**: Error when executing order
**Solution**:
1. Check sufficient inventory for inputs
2. Verify all items exist and are active
3. Check warehouse has locations
4. Review error logs for specific issue
5. Ensure atomic transaction not interrupted

### Issue: Cost allocation incorrect
**Symptoms**: Output costs don't match expectations
**Solution**:
1. Verify cost proportions sum to 1.0
2. Check input costs at time of reservation
3. Review moving average calculation
4. Ensure all inputs have valid costs

### Issue: Lineage tracking broken
**Symptoms**: Cannot trace products
**Solution**:
1. Check transformation_lineage table populated
2. Verify batch tracking enabled if needed
3. Ensure execution completed successfully
4. Review lineage service logic

## Related Documentation

- **Transformation Implementation Plan**: `docs/plans/transformation-final-summary.md`
- **Transformation Progress**: `docs/plans/transformation-progress.md`
- **Transformation Validation Service**: `src/services/inventory/transformationValidationService.ts`
- **Frame Job Order Plan**: `docs/frame-job-order-sales-order-refactor-plan.md`
- **Manufacturing Plan**: `docs/generic-manufacturing-production-floor-plan.md`

## Migration History

Key manufacturing-related migrations:

- Transformation templates and orders
- Lineage tracking
- Frame job orders
- Workstation management
- Cost allocation and redistribution
