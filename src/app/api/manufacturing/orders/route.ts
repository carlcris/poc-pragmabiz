import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { NextRequest, NextResponse } from "next/server";
import { requireAnyPermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { logQuotationError } from "../../quotations/_shared";

type ManufacturingOrderRow = {
  id: string;
  manufacturing_order_code: string;
  sales_order_id: string | null;
  customer_id: string | null;
  production_type: string;
  status: string;
  priority: string;
  due_date: string | null;
  current_workstation_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  notes: string | null;
  custom_fields: Record<string, unknown> | null;
  created_at: string;
};

type OperationRow = {
  id: string;
  manufacturing_order_id: string;
  workstation_id: string | null;
  operation_code: string;
  operation_name: string;
  operation_type: string;
  status: string;
  sequence_no: number;
};

type ItemRow = {
  manufacturing_order_id: string;
  item_description: string | null;
  quantity: number | string;
};

type MaterialRow = {
  manufacturing_order_id: string;
  item_description: string | null;
  required_quantity: number | string;
  issued_quantity: number | string;
  material_status: string;
  units_of_measure?: {
    code?: string | null;
  } | null;
};

type NamedRow = {
  id: string;
  customer_name?: string | null;
  order_code?: string | null;
  workstation_name?: string | null;
  workstation_code?: string | null;
};

const MAX_LIMIT = 50;

const parsePositiveInt = (raw: string | null, fallback: number) => {
  const parsed = Number.parseInt(raw || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const toNumber = (value: number | string | null | undefined) => Number(value) || 0;

async function GETHandler(request: NextRequest) {
  try {
    const unauthorized = await requireAnyPermission([
      [RESOURCES.MANUFACTURING, "view"],
      [RESOURCES.STOCK_TRANSFORMATIONS, "view"],
    ]);
    if (unauthorized) return unauthorized;

    const { supabase } = await createServerClientWithBU();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parsePositiveInt(searchParams.get("page"), 1);
    const limit = Math.min(parsePositiveInt(searchParams.get("limit"), 20), MAX_LIMIT);
    const status = searchParams.get("status")?.trim();
    const workstationId = searchParams.get("workstationId")?.trim();
    const search = searchParams.get("search")?.trim();
    const floor = searchParams.get("floor") === "true";
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from("manufacturing_orders")
      .select(
        `
        id,
        manufacturing_order_code,
        sales_order_id,
        customer_id,
        production_type,
        status,
        priority,
        due_date,
        current_workstation_id,
        started_at,
        completed_at,
        notes,
        custom_fields,
        created_at
      `,
        { count: "exact" }
      )
      .is("deleted_at", null);

    if (floor) {
      query = query.not("status", "in", '("completed","cancelled")');
    }

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    if (workstationId && workstationId !== "all") {
      query = query.eq("current_workstation_id", workstationId);
    }

    if (search) {
      query = query.ilike("manufacturing_order_code", `%${search}%`);
    }

    const { data, error, count } = await query
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true })
      .range(from, to);

    if (error) {
      logQuotationError("Error fetching orders:", error);
      return NextResponse.json({ error: "Failed to load orders" }, { status: 500 });
    }

    const orders = (data || []) as ManufacturingOrderRow[];
    const orderIds = orders.map((order) => order.id);
    const customerIds = orders
      .map((order) => order.customer_id)
      .filter((id): id is string => Boolean(id));
    const salesOrderIds = orders
      .map((order) => order.sales_order_id)
      .filter((id): id is string => Boolean(id));
    const workstationIds = orders
      .map((order) => order.current_workstation_id)
      .filter((id): id is string => Boolean(id));

    const [
      customersResult,
      salesOrdersResult,
      workstationsResult,
      operationsResult,
      itemsResult,
      materialsResult,
    ] = await Promise.all([
      customerIds.length > 0
        ? supabase.from("customers").select("id, customer_name").in("id", customerIds)
        : Promise.resolve({ data: [], error: null }),
      salesOrderIds.length > 0
        ? supabase.from("sales_orders").select("id, order_code").in("id", salesOrderIds)
        : Promise.resolve({ data: [], error: null }),
      workstationIds.length > 0
        ? supabase
            .from("manufacturing_workstations")
            .select("id, workstation_code, workstation_name")
            .in("id", workstationIds)
        : Promise.resolve({ data: [], error: null }),
      orderIds.length > 0
        ? supabase
            .from("manufacturing_operations")
            .select(
              "id, manufacturing_order_id, workstation_id, operation_code, operation_name, operation_type, status, sequence_no"
            )
            .in("manufacturing_order_id", orderIds)
            .is("deleted_at", null)
            .order("sequence_no", { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      orderIds.length > 0
        ? supabase
            .from("manufacturing_order_items")
            .select("manufacturing_order_id, item_description, quantity")
            .in("manufacturing_order_id", orderIds)
            .is("deleted_at", null)
            .order("sort_order", { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      orderIds.length > 0
        ? supabase
            .from("manufacturing_order_materials")
            .select(
              "manufacturing_order_id, item_description, required_quantity, issued_quantity, material_status, units_of_measure:uom_id(code)"
            )
            .in("manufacturing_order_id", orderIds)
            .is("deleted_at", null)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const relatedError =
      customersResult.error ||
      salesOrdersResult.error ||
      workstationsResult.error ||
      operationsResult.error ||
      itemsResult.error ||
      materialsResult.error;

    if (relatedError) {
      logQuotationError("Error fetching order related data:", relatedError);
      return NextResponse.json({ error: "Failed to load orders" }, { status: 500 });
    }

    const customersById = new Map(
      ((customersResult.data || []) as NamedRow[]).map((row) => [row.id, row.customer_name || ""])
    );
    const salesOrdersById = new Map(
      ((salesOrdersResult.data || []) as NamedRow[]).map((row) => [row.id, row.order_code || ""])
    );
    const workstationsById = new Map(
      ((workstationsResult.data || []) as NamedRow[]).map((row) => [
        row.id,
        { code: row.workstation_code || "", name: row.workstation_name || "" },
      ])
    );

    const operationsByOrderId = new Map<string, OperationRow[]>();
    for (const operation of (operationsResult.data || []) as OperationRow[]) {
      const list = operationsByOrderId.get(operation.manufacturing_order_id) || [];
      list.push(operation);
      operationsByOrderId.set(operation.manufacturing_order_id, list);
    }

    const itemsByOrderId = new Map<string, ItemRow[]>();
    for (const item of (itemsResult.data || []) as ItemRow[]) {
      const list = itemsByOrderId.get(item.manufacturing_order_id) || [];
      list.push(item);
      itemsByOrderId.set(item.manufacturing_order_id, list);
    }

    const materialsByOrderId = new Map<string, MaterialRow[]>();
    for (const material of (materialsResult.data || []) as MaterialRow[]) {
      const list = materialsByOrderId.get(material.manufacturing_order_id) || [];
      list.push(material);
      materialsByOrderId.set(material.manufacturing_order_id, list);
    }

    return NextResponse.json({
      data: orders.map((order) => {
        const operations = operationsByOrderId.get(order.id) || [];
        const activeOperation =
          operations.find((operation) => operation.status === "in_progress") ||
          operations.find((operation) => operation.status === "pending") ||
          operations[operations.length - 1] ||
          null;
        const items = itemsByOrderId.get(order.id) || [];
        const materials = materialsByOrderId.get(order.id) || [];
        const requiredQuantity = materials.reduce(
          (sum, material) => sum + toNumber(material.required_quantity),
          0
        );
        const issuedQuantity = materials.reduce(
          (sum, material) => sum + toNumber(material.issued_quantity),
          0
        );
        const materialsList = materials.map((material) => ({
          description: material.item_description || "Material",
          requiredQuantity: toNumber(material.required_quantity),
          issuedQuantity: toNumber(material.issued_quantity),
          uomCode: material.units_of_measure?.code || "",
          status: material.material_status,
        }));
        const workstation = order.current_workstation_id
          ? workstationsById.get(order.current_workstation_id)
          : null;

        return {
          id: order.id,
          manufacturingOrderCode: order.manufacturing_order_code,
          salesOrderId: order.sales_order_id,
          salesOrderCode: order.sales_order_id
            ? salesOrdersById.get(order.sales_order_id) || ""
            : "",
          customerId: order.customer_id,
          customerName: order.customer_id ? customersById.get(order.customer_id) || "" : "",
          productionType: order.production_type,
          status: order.status,
          priority: order.priority,
          dueDate: order.due_date,
          startedAt: order.started_at,
          completedAt: order.completed_at,
          notes: order.notes,
          createdAt: order.created_at,
          currentWorkstationId: order.current_workstation_id,
          currentWorkstationCode: workstation?.code || "",
          currentWorkstationName: workstation?.name || "",
          activeOperation: activeOperation
            ? {
                id: activeOperation.id,
                code: activeOperation.operation_code,
                name: activeOperation.operation_name,
                type: activeOperation.operation_type,
                status: activeOperation.status,
                sequenceNo: activeOperation.sequence_no,
              }
            : null,
          itemSummary:
            items
              .map((item) => item.item_description)
              .filter(Boolean)
              .slice(0, 2)
              .join(", ") || "Manufacturing order",
          itemCount: items.length,
          materialCount: materials.length,
          requiredQuantity,
          issuedQuantity,
          materials: materialsList,
          hasMaterialShortage: materials.some((material) => material.material_status === "short"),
        };
      }),
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    logQuotationError("Unexpected orders list error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withActivityLogging(GETHandler, {
  action: "list",
  resourceType: "manufacturing",
  route: "/api/manufacturing/orders",
});
