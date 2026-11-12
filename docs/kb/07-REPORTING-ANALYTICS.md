# Reporting & Analytics Module

## Overview

The Reporting & Analytics module provides real-time business intelligence through dashboards, operational reports, and analytical insights across all business functions including sales, inventory, purchasing, and financial performance.

## Key Features

- **Real-time Dashboard** widgets with KPIs
- **Inventory Reports** (valuation, aging, movement, location/batch details)
- **Sales Analytics** (by employee, location, time period, customer)
- **Purchasing Analytics** (supplier spend, outstanding requisitions, capacity)
- **Financial Reports** (A/R aging, ledger summaries)
- **Transformation Efficiency** metrics
- **Custom date ranges** and filtering
- **Export capabilities** (Excel, PDF, CSV)
- **Scheduled reports** (future enhancement)
- **Permission-based** report access

## Reporting Architecture

```
┌────────────────────────────────────────────────────────┐
│                 Presentation Layer                      │
│  Dashboard Widgets | Report Pages | Charts             │
└────────────────────────────────────────────────────────┘
                          ↓
┌────────────────────────────────────────────────────────┐
│                  API Layer                              │
│  Report Endpoints | Analytics Endpoints                │
└────────────────────────────────────────────────────────┘
                          ↓
┌────────────────────────────────────────────────────────┐
│            Data Aggregation Layer (RPC)                 │
│  Optimized Queries | Aggregations | Calculations       │
└────────────────────────────────────────────────────────┘
                          ↓
┌────────────────────────────────────────────────────────┐
│                   Data Layer                            │
│  Transactions | Ledgers | Stock | Orders               │
└────────────────────────────────────────────────────────┘
```

## Core Concepts

### 1. Dashboard Widgets

**Dashboard Widgets** display real-time KPIs on the main dashboard.

**Widget Types**:
- **Metric Widgets**: Single number with trend (e.g., "Total Sales: $125K ↑5%")
- **Chart Widgets**: Visual data (bar, line, pie charts)
- **List Widgets**: Top/bottom lists (e.g., "Top 5 Selling Items")
- **Alert Widgets**: Actionable alerts (e.g., "15 Items Below Reorder Point")

**Permission Control**:
Widgets have granular capabilities:
- `view_dashboard_sales_widget`
- `view_dashboard_inventory_widget`
- `view_dashboard_purchasing_widget`
- `view_dashboard_financial_widget`

**Examples**:
- Total Sales (Today, MTD, YTD)
- Total Inventory Value
- Outstanding Purchase Orders
- Accounts Receivable Aging
- Low Stock Alerts
- Top Selling Items
- Sales by Employee
- Purchase Requisitions Pending Approval

### 2. Operational Reports

**Operational Reports** provide detailed transactional data for daily operations.

**Report Categories**:
- Inventory Reports
- Sales Reports
- Purchasing Reports
- Financial Reports
- Manufacturing Reports

**Common Features**:
- Date range filtering
- Warehouse/location filtering
- Category/supplier/customer filtering
- Pagination for large datasets
- Export to Excel/PDF
- Print-friendly formatting

**Operational Limits**:
- Interactive report list endpoints keep normal page sizes bounded to avoid large hot queries.
- Inventory PDF preview can request up to 500 matching rows with `exportMode=pdf`.
- Stock aging, stock movement, stock valuation, picking efficiency, and transformation efficiency reports reject overly broad requests once the source dataset exceeds 5,000 rows. Users should narrow date range, warehouse, item, category, template, or picker filters before regenerating the report.

### 3. Analytical Reports

**Analytical Reports** provide insights and trends for decision-making.

**Analysis Types**:
- Trend analysis (sales over time)
- Comparative analysis (period over period)
- Distribution analysis (by category, region, employee)
- Performance analysis (efficiency, productivity)
- Profitability analysis

## Report Catalog

The Reports directory displays available and in-development reports only. Report definitions
marked as coming soon remain hidden until their implementation is ready for users.

### Inventory Reports

#### Stock Valuation Report
**Endpoint**: `GET /api/reports/stock-valuation`

Shows total inventory value by warehouse using the configured inventory default pricing tier for item valuation, with item sales price and purchase price fallback when no active default-tier item price exists.

**Parameters**:
- `warehouse_id` (optional) - Filter by warehouse
- `as_of_date` (optional) - Valuation as of date

**Output**:
```json
{
  "as_of_date": "2025-06-14",
  "warehouses": [
    {
      "warehouse": "Main Warehouse",
      "items": [
        {
          "item_code": "ITEM-001",
          "item_name": "Widget ABC",
          "on_hand": 150,
          "average_cost": 8.50,
          "total_value": 1275.00
        }
      ],
      "total_value": 125000.00
    }
  ],
  "grand_total": 125000.00
}
```

#### Expired Batches

Available from **Reports → Inventory → Expired Batches**. Includes only non-deleted batches with `expiration_date` strictly before the selected date and `qty_on_hand > 0`. Exhausted batches, unset expiration dates, and batches expiring on the selected date are excluded. This uses saved dates for all item origins; it does not recalculate JIS dates. The date defaults to the viewer's local today. Quantities reflect current stock, not a historical inventory snapshot.

The report follows Stock Aging’s left settings panel and right PDF preview layout. No report data is fetched until Preview is clicked; there is no interactive result table or pagination control. Changing filters clears the prior preview. PDF detail columns show batches in Item mode and item code/name in Batch mode. Group headings repeat across pages; each group ends with quantity subtotals per base unit. Empty results generate an explicit empty-report PDF.

Users can group by Item (default) or Batch and filter by warehouse, category, and item code/name or batch-code search. Batch grouping combines the same batch code across items and warehouses within the permitted scope. Rows show item, warehouse, batch, expiration, days expired, on-hand/reserved/available quantities, and base unit. Groups are ordered by label/key; rows within groups by expiration and batch ID. No quantities across different units are summed.

`GET /api/reports/expired-batches` requires Reports view permission before report work. It calls invoker RPC `get_expired_batches_report`, applying company, accessible-business-unit membership, and selected-business-unit scope. `asOf=YYYY-MM-DD` is required; `groupBy=item|batch` defaults to item. Optional filters: `warehouseId`, `categoryId`, `search` (100 characters). Normal `page`/`limit` paginate complete groups, default 20 and maximum 50 groups. Each response is bounded to 500 batch rows; oversized pages return safe HTTP 413 requiring narrower filters. `exportMode=pdf` exports all matching groups from page one, with an explicit 500-row cap and HTTP 413 instead of partial output. PDF preview supports the shared download/print actions and repeats group labels across PDF pages.

The report query key includes business-unit context and all filters. Expiration edits and relevant inventory mutations invalidate the report cache; preview URLs are cleared when invalidated. Migration `20261110110000_expired_batches_report.sql` adds the RPC and partial company/expiration index. Authenticated SQL tests: `supabase/tests/expired-batches-report.sql`.


#### Stock Aging Report
**Endpoint**: `GET /api/reports/stock-aging`

Shows positive, non-deleted location-batch stock balances in the current business unit, grouped by item (default) or batch code in the PDF. Items without positive location-batch stock are excluded.

**Parameters**:
- `page` / `limit` (optional; normal responses default to 25 rows and allow 10–50 rows per page)
- `exportMode=pdf` (optional; returns all matching rows in one response, ignoring `page` and `limit`)
- `groupBy=item|batch` (optional, defaults to `item`; invalid values return `400`)
- `search` (optional, matches item code/name, batch code, or batch-location scan code)
- `category` (optional, category id or name)
- `ageBucket` (optional, defaults to `90_plus`, meaning strictly older than 90 days)

**Age Buckets**: `all`, `0_30`, `31_60`, `61_90`, `91_180`, `181_plus`, `90_plus`

Company, business-unit, category, positive quantity, and non-deleted balance filters apply in the database. The API reads source rows in stable ID order in batches of up to 1,000, advancing by the actual returned row count so a lower Supabase response cap cannot silently truncate the report. An exact count verifies completeness; source-count changes during retrieval return `409` and require retrying.

The existing safety ceiling is **5,000 source location-batch rows**, before search and age filtering. Requests above that ceiling return `413` without partial data. Narrow the category or business-unit scope; changing search or age filters does not reduce the source count. Accepted requests apply search, aging, sorting, summaries, and pagination on the server across the complete source dataset.

PDF preview/download uses `exportMode=pdf`, including every matching row for an accepted request, rather than only the first 50 rows. Groups are ordered by their oldest stock age descending, and rows within each group are ordered by age descending. Normal paginated API rows are also sorted by age descending before pagination. Each group subtotal includes all its matching location-batch rows. Batch mode combines identical batch codes across items and warehouses within the filtered business-unit scope, including shared opening-balance codes. Missing batch codes remain separate by batch ID. Batch headers show the batch code; detail rows show item name/code and receipt date. Item mode retains item headers and batch details. Oversized and failed requests show a translated error and clear the previous preview. The warehouse/location cell shows the warehouse name only, with the full ancestor-to-leaf location-name path underneath. Warehouse and location codes are omitted, and the warehouse name is not repeated in the subtext. `locationPath` contains this names-only location address, resolved from hierarchy IDs with deduplicated, bounded ancestor queries. PDF columns show warehouse/location, batch or item details, age, on-hand/reserved/available quantities, and stock value; Updated At is not displayed. The age column shows total elapsed days with smaller calendar year/month/day subtext, calculated server-side from the batch receipt timestamp to one shared report-time snapshot. Calendar arithmetic uses UTC, actual month lengths, and leap years; month-end anniversaries clamp to the last day of shorter months. Remaining partial days are not counted. For example, 2025-01-01 to 2026-02-04 is 399 days and `1 y 1 m 3 d`. Missing/invalid receipt dates show `--` for the duration; future receipts show zero age. Zero-valued units are omitted from the localized subtext (for example, `3 m 4 d`); an entirely zero duration displays `0 d`. Calendar components are supplied as `batchAgeDuration`; sorting still uses total age in days. Group stock-row counts appear beneath the subtotal label. PDF footers show actual printed page numbers and the matching row count. PDF layout is processed in sections of at most 50 stock rows to avoid repeatedly laying out a report-sized table. These are layout sections, not data limits: every matching row remains included, group headings repeat for continued sections, and each group subtotal appears only after its final section. Long content can still wrap onto additional printed pages. PDF libraries load concurrently with the data request.

**Response**: `{ data, groups, summary, pagination, filters }`. PDF mode includes server-computed `groups`: group ID, title/subtitle, `startIndex` and `rowCount` into the returned `data` array, quantity/value subtotals, and oldest age. Rows are serialized only once. Normal paginated requests return an empty `groups` array; `filters.groupBy` records the selected mode. `data` contains location-batch rows with item, warehouse/location, receipt date, age, quantities, and stock value. `summary` covers all matching rows. Normal requests paginate `data`; PDF mode returns all matches with `pagination.page = 1`, `limit = 5000`, and `totalPages = 1` (API pages, not printed PDF pages).

#### Stock Movement Report
**Endpoint**: `GET /api/reports/stock-movement`

Shows all stock transactions for a period.

**Parameters**:
- `start_date`, `end_date` (required)
- `warehouse_id` (optional)
- `item_id` (optional)
- `transaction_type` (optional)

**Output**:
```json
{
  "movements": [
    {
      "date": "2025-06-14",
      "item": "Widget ABC",
      "warehouse": "Main Warehouse",
      "location": "A-01-01",
      "transaction_type": "purchase_receipt",
      "quantity": 100,
      "unit": "piece",
      "reference": "PO-123"
    }
  ]
}
```

#### Inventory Report (Current Stock)
**Endpoint**: `GET /api/reports/inventory`

Current stock levels with location and batch details.

**Parameters**:
- `warehouse_id` (optional)
- `category_id` (optional)
- `show_locations` (boolean) - Include location-level detail
- `show_zero_stock` (boolean) - Include items with zero stock

### Sales Reports

#### Sales by Employee
**Endpoint**: `GET /api/analytics/sales/by-employee`

Sales performance by salesperson.

**Parameters**:
- `start_date`, `end_date`
- `employee_id` (optional)

**Output**:
```json
{
  "employees": [
    {
      "employee": "John Doe",
      "sales_count": 45,
      "total_sales": 125000.00,
      "average_sale": 2777.78,
      "commission_earned": 6250.00
    }
  ]
}
```

#### Sales by Time Period
**Endpoint**: `GET /api/analytics/sales/by-period`

Sales trends over time.

**Parameters**:
- `start_date`, `end_date`
- `group_by`: 'day', 'week', 'month'

**Output**:
```json
{
  "periods": [
    {
      "period": "2025-06",
      "sales_count": 120,
      "total_sales": 350000.00,
      "total_cost": 210000.00,
      "gross_profit": 140000.00,
      "margin_percent": 40.00
    }
  ]
}
```

#### Sales by Location
**Endpoint**: `GET /api/analytics/sales/by-location`

Sales distribution by warehouse or business unit.

#### Top Selling Items
**Endpoint**: `GET /api/analytics/sales/top-items`

Most sold items by quantity or value.

**Parameters**:
- `start_date`, `end_date`
- `limit` (default: 10)
- `order_by`: 'quantity' or 'value'

### Purchasing Reports

#### Supplier Spend Analysis
**Endpoint**: `GET /api/analytics/purchasing/supplier-spend`

Total spending per supplier.

**Parameters**:
- `start_date`, `end_date`
- `supplier_id` (optional)

**Output**:
```json
{
  "suppliers": [
    {
      "supplier": "ABC Supplies Inc",
      "po_count": 25,
      "total_spend": 85000.00,
      "average_po_value": 3400.00,
      "payment_terms_days": 30
    }
  ]
}
```

#### Outstanding Purchase Orders
**Endpoint**: `GET /api/reports/purchasing/outstanding-pos`

POs not yet completed.

**Output**:
```json
{
  "purchase_orders": [
    {
      "po_number": "PO-123",
      "supplier": "ABC Supplies Inc",
      "order_date": "2025-06-01",
      "expected_delivery": "2025-06-15",
      "total_amount": 5000.00,
      "received_amount": 3000.00,
      "outstanding_amount": 2000.00,
      "days_outstanding": 14
    }
  ],
  "total_outstanding": 25000.00
}
```

#### Purchasing Capacity
**Endpoint**: `GET /api/analytics/purchasing/capacity`

Warehouse receiving capacity and workload.

**Output**:
```json
{
  "warehouses": [
    {
      "warehouse": "Main Warehouse",
      "capacity_per_day": 500,
      "scheduled_receipts": [
        { "date": "2025-06-15", "po_count": 5, "total_quantity": 350, "utilization": 70 }
      ]
    }
  ]
}
```

### Financial Reports

#### Accounts Receivable Aging
**Endpoint**: `GET /api/reports/ar-aging`

Customer balances by age.

**Parameters**:
- `as_of_date` (optional)

**Output**:
```json
{
  "customers": [
    {
      "customer": "Acme Corp",
      "current": 5000.00,        // 0-30 days
      "1_30_days": 3000.00,      // 31-60 days
      "31_60_days": 2000.00,     // 61-90 days
      "over_90_days": 1000.00,   // 90+ days
      "total_balance": 11000.00
    }
  ],
  "totals": {
    "current": 25000.00,
    "1_30_days": 15000.00,
    "31_60_days": 8000.00,
    "over_90_days": 3000.00,
    "total": 51000.00
  }
}
```

#### Customer Ledger
**Endpoint**: `GET /api/customers/[id]/ledger`

All transactions for a customer.

**See**: Sales Management Module

### Manufacturing Reports

#### Transformation Efficiency
**Endpoint**: `GET /api/reports/transformation-efficiency`

Production efficiency metrics.

**Parameters**:
- `start_date`, `end_date`
- `template_id` (optional)
- `workstation_id` (optional)

**Output**:
```json
{
  "templates": [
    {
      "template": "Make Pizza",
      "orders_count": 45,
      "total_output_units": 450,
      "average_time_minutes": 15,
      "planned_cost": 2700.00,
      "actual_cost": 2850.00,
      "variance": 150.00,
      "efficiency_percent": 94.74
    }
  ]
}
```

#### Production Summary
**Endpoint**: `GET /api/analytics/manufacturing/production`

Production volumes by period.

### Warehouse Operations Reports

#### Delivery Performance
**Endpoint**: `GET /api/reports/delivery-performance`

Business-unit-scoped delivery reliability for dispatched delivery notes. The report compares the
receipt date with the earliest required date among the delivery note's linked stock requests. Date
range boundaries, receipt dates, and overdue checks use the business unit's configured timezone;
when none is configured, they use `Asia/Manila`.

**Parameters**:
- `startDate`, `endDate` (dispatch date range, maximum 366 days)
- `direction`: `all`, `outbound`, `inbound`, or `internal`
- `performanceStatus`: `all`, `on_time`, `late`, `in_transit`, or `discrepancy`
- `search` (delivery note, route, source warehouse, driver, or plate)
- `page`, `limit` (maximum 500 rows per request)

**Metrics**:
- Completion, on-time, late, in-transit, discrepancy, and perfect-delivery counts
- On-time, completion, and perfect-delivery rates
- Average dispatch-to-receipt transit hours
- Dispatched and received quantities

An unreceived delivery becomes late after its required date. A perfect delivery is received on
time without a header or line-level receiving discrepancy. The PDF preview is localized and
exports at most 500 filtered rows per request. The database scopes delivery notes by company,
business unit, direction, date, and search before aggregating linked requests and line quantities,
so narrow report requests do not aggregate unrelated delivery history.

#### Picking Efficiency
**Endpoint**: `GET /api/reports/picking-efficiency`

Warehouse picking performance.

**Parameters**:
- `start_date`, `end_date`
- `warehouse_id` (optional)
- `user_id` (optional)

**Output**:
```json
{
  "summary": {
    "total_picks": 250,
    "total_items_picked": 2500,
    "average_picks_per_hour": 15,
    "accuracy_percent": 98.5
  },
  "by_user": [
    {
      "user": "Jane Smith",
      "picks_completed": 50,
      "items_picked": 500,
      "average_time_per_pick_minutes": 4,
      "accuracy_percent": 99.0
    }
  ]
}
```

## API Reference

### Dashboard Widgets

#### GET /api/dashboard/widgets
Get all dashboard widgets for current user.

**Permissions**: Various widget-specific capabilities

Inventory reorder widgets use the same effective reorder alert calculation as reorder management:
item-level defaults, active seasonal policies, active acknowledgments, zero-stock items, and
company-wide available stock are handled by the reorder RPC. Reorder widget rows are not tied to a
single warehouse, so `warehouseId` is `null` for those company-wide alerts.

**Response**:
```json
{
  "widgets": [
    {
      "id": "sales_today",
      "type": "metric",
      "title": "Sales Today",
      "value": 15000.00,
      "trend": 5.2,
      "trend_direction": "up"
    },
    {
      "id": "inventory_value",
      "type": "metric",
      "title": "Inventory Value",
      "value": 125000.00
    },
    {
      "id": "low_stock_items",
      "type": "alert",
      "title": "Low Stock Alerts",
      "count": 15,
      "items": [...]
    },
    {
      "id": "sales_trend",
      "type": "chart",
      "title": "Sales Trend (30 Days)",
      "chart_type": "line",
      "data": [...]
    }
  ]
}
```

### Report Generation

#### POST /api/reports/generate
Generate custom report.

**Permissions**: `view` on `reports`

**Request**:
```json
{
  "report_type": "stock_valuation",
  "parameters": {
    "warehouse_id": "uuid",
    "as_of_date": "2025-06-14"
  },
  "format": "pdf"  // or "excel", "csv"
}
```

**Response**:
```json
{
  "report_id": "uuid",
  "download_url": "https://...report.pdf",
  "expires_at": "2025-06-14T23:59:59Z"
}
```

## Report Implementation Patterns

### Pattern 1: RPC-Based Aggregation

For complex reports, use database RPC functions for performance:

```sql
-- Example: Stock valuation RPC
CREATE OR REPLACE FUNCTION get_stock_valuation(
  p_warehouse_id UUID DEFAULT NULL,
  p_as_of_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  item_id UUID,
  item_code VARCHAR,
  item_name VARCHAR,
  warehouse_id UUID,
  warehouse_name VARCHAR,
  on_hand DECIMAL,
  average_cost DECIMAL,
  total_value DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.id,
    i.code,
    i.name,
    w.id,
    w.name,
    iw.on_hand,
    iw.average_cost,
    (iw.on_hand * iw.average_cost) AS total_value
  FROM items i
  JOIN item_warehouse iw ON i.id = iw.item_id
  JOIN warehouses w ON iw.warehouse_id = w.id
  WHERE (p_warehouse_id IS NULL OR w.id = p_warehouse_id)
    AND iw.on_hand > 0
  ORDER BY i.code;
END;
$$ LANGUAGE plpgsql;
```

### Pattern 2: Pagination for Large Reports

```typescript
// API endpoint with pagination
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '100')
  const offset = (page - 1) * limit

  const { data, error, count } = await supabase
    .from('stock_transactions')
    .select('*', { count: 'exact' })
    .range(offset, offset + limit - 1)
    .order('transaction_date', { ascending: false })

  return NextResponse.json({
    data,
    pagination: {
      page,
      limit,
      total: count,
      pages: Math.ceil((count || 0) / limit)
    }
  })
}
```

### Pattern 3: Cached Reports

For expensive reports run frequently:

```typescript
// Cache report results
const cacheKey = `report:${reportType}:${JSON.stringify(params)}`
const cached = await redis.get(cacheKey)

if (cached) {
  return JSON.parse(cached)
}

const reportData = await generateReport(reportType, params)

// Cache for 5 minutes
await redis.set(cacheKey, JSON.stringify(reportData), 'EX', 300)

return reportData
```

## UI Components

### Key Components

#### DashboardWidgets
**Location**: `src/components/dashboard/DashboardWidgets.tsx`
- Display all authorized widgets
- Auto-refresh data
- Responsive grid layout

#### ReportGenerator
**Location**: `src/components/reports/ReportGenerator.tsx`
- Select report type
- Set parameters (dates, filters)
- Choose export format
- Download generated report

#### ChartWidget
**Location**: `src/components/reports/ChartWidget.tsx`
- Render various chart types
- Interactive tooltips
- Export chart as image

#### DataTable
**Location**: `src/components/reports/DataTable.tsx`
- Display tabular report data
- Sorting and filtering
- Pagination
- Export to Excel/CSV

## Troubleshooting

### Issue: Report takes too long to generate
**Symptoms**: Timeout errors, slow response
**Solution**:
1. Use RPC functions for complex aggregations
2. Add database indexes on filtered columns
3. Implement pagination for large datasets
4. Cache frequently-run reports
5. Use materialized views for complex joins

### Issue: Dashboard widgets not showing
**Symptoms**: Widgets missing or show permission errors
**Solution**:
1. Check user has widget-specific capabilities
2. Verify widget API endpoints working
3. Check business unit context
4. Review permission cache

### Issue: Export file corrupt or empty
**Symptoms**: Downloaded file won't open
**Solution**:
1. Check file generation service
2. Verify data format matches export type
3. Check for encoding issues
4. Test with smaller dataset

## Related Documentation

- **Dashboard Widget Implementation**: `docs/purchasing-dashboard-widgets-implementation-plan.md`
- **Inventory Reports**: `docs/kb/02-INVENTORY-MANAGEMENT.md#reports`
- **Sales Analytics**: `docs/kb/03-SALES-MANAGEMENT.md`
- **Transformation Efficiency**: `docs/kb/06-MANUFACTURING.md#reports`

## Future Enhancements

- Scheduled reports (daily/weekly/monthly email)
- Custom report builder (drag-and-drop)
- Advanced visualizations (heat maps, scatter plots)
- Report subscriptions
- Comparative period analysis
- Forecasting and predictions
- Mobile-optimized reports
- Real-time streaming dashboards

### Item Location (Location + Batch)

The PDF preview shows exact warehouse/location paths, item and batch identifiers, location SKU,
and on-hand, reserved, and available quantities. Choose a warehouse and/or item, then group by
**Item** (default) or **Batch**. Batch groups combine the same batch code across items and
warehouses, with items nested below each batch. Item grouping nests batches below each item. Exact warehouse/location rows appear
below each nested heading. Child headings omit the Item/Batch prefix and are indented; location
rows are indented further. Each main batch or item group ends with On Hand, Reserved, and
Available subtotals, computed over all matching location rows on the server. Subtotals appear
once at the true group end even across PDF rendering jobs/pages. The PDF omits the Updated column. Missing batch codes remain separate
by batch identity. The API groups
the complete bounded export before PDF chunking, so a group is never fragmented by fetch order.
Warehouse and item selectors query the server with five initial results and support lookup search.

**Include empty batches** is unchecked by default. Unchecked reports include only location/batch
records with positive on-hand quantity; checking it also includes existing zero-on-hand records.
It does not invent locations for batches that have no location record. The former stock-status,
report search, and sorting controls are removed; ordering is deterministic within each group.

`GET /api/reports/item-location-batch` is a PDF export endpoint. It accepts `warehouseId`, `itemId`,
`groupBy=item|batch`, `includeEmptyBatches=true|false`, and `locale=en|zh`; other values return HTTP
400. One exact count runs first: more than 10,000 matching rows returns HTTP 413 before any row is
read. Accepted reports are then fetched in database batches of at most 1,000 rows (at most 20 reads
if the database applies a smaller per-request cap). Groups are ordered with the requested locale's
collation. Responses include all matching rows, `groupSubtotals` keyed by each group's last location
row ID, and summary quantities over the full dataset; there is no `page`/`limit` pagination. Empty,
duplicate, or short reads return HTTP 409 with retry guidance; partial reports are never exported.
The reads are not a transactional snapshot, so concurrent updates that preserve the row count may
still appear in the report. Report view permission, company scoping, and existing Supabase RLS
remain in force.

PDF layout and font processing run in a dedicated browser worker so large reports do not block
page interaction. Each render job handles up to 125 rows. The next job starts with the previous
job's last-page rows, then adds new rows so the page can fill before the report advances. `pdf-lib`
merges the completed pages into one PDF. Group headings and subtotals stay with their rows. The full
report title block appears only on the first page. Column headings repeat on every page, and page
numbers run from `1 / N` to `N / N` across the merged PDF. Cancel preview or close the dialog to
terminate rendering and release worker memory. Rendering also stops after three minutes with
translated retry guidance. The 1,000-row database chunks and 10,000-row export cap remain unchanged.

PDF downloads use the report title and the local generation date in the format
`<report title> - YYYY-MM-DD.pdf`. The browser PDF viewer gets a named preview URL through a
scoped service worker that reads the existing local PDF. The report dialog's **Download PDF**
button sets the same name, including when the browser cannot activate the service worker.
