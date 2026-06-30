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

#### Stock Aging Report
**Endpoint**: `GET /api/reports/stock-aging`

Shows how long inventory has been in stock, categorized by age buckets.

**Parameters**:
- `page` / `limit` (optional, paginated response)
- `search` (optional, matches item code/name, batch code, or batch-location scan code)
- `category` (optional, category id or name)
- `ageBucket` (optional, defaults to `90_plus`)

**Age Buckets**: `all`, `0_30`, `31_60`, `61_90`, `91_180`, `181_plus`, `90_plus`

The report applies business-unit scope before the 5,000 source-row safety cap. Requests that remain
too broad after scope and filters return `413`; narrow category, search, or age bucket filters before
regenerating the report.

**Output**:
```json
{
  "items": [
    {
      "item": "Widget ABC",
      "warehouse": "Main Warehouse",
      "age_distribution": {
        "0-30_days": { "quantity": 50, "value": 425.00 },
        "31-60_days": { "quantity": 75, "value": 637.50 },
        "61-90_days": { "quantity": 20, "value": 170.00 },
        "90+_days": { "quantity": 5, "value": 42.50 }
      },
      "total_quantity": 150,
      "total_value": 1275.00
    }
  ]
}
```

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
