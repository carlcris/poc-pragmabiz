import { NextRequest, NextResponse } from "next/server";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";

type TransformationOrderRow = {
  id: string;
  order_code: string;
  status: string;
  template_id: string;
  source_warehouse_id: string;
  planned_quantity: number | string | null;
  actual_quantity: number | string | null;
  total_input_cost: number | string | null;
  total_output_cost: number | string | null;
  cost_variance: number | string | null;
  order_date: string;
  execution_date: string | null;
  completion_date: string | null;
  template?:
    | { template_code: string | null; template_name: string | null }
    | { template_code: string | null; template_name: string | null }[]
    | null;
  source_warehouse?:
    | { warehouse_code: string | null; warehouse_name: string | null }
    | { warehouse_code: string | null; warehouse_name: string | null }[]
    | null;
  inputs?:
    | {
        id: string;
        consumed_quantity: number | string | null;
        planned_quantity: number | string | null;
        total_cost: number | string | null;
      }[]
    | null;
  outputs?:
    | {
        id: string;
        is_scrap: boolean;
        produced_quantity: number | string | null;
        wasted_quantity: number | string | null;
        total_allocated_cost: number | string | null;
        waste_reason: string | null;
      }[]
    | null;
};

type GroupAgg = {
  key: string;
  groupType: "template" | "warehouse";
  templateId: string | null;
  templateCode: string | null;
  templateName: string | null;
  warehouseId: string | null;
  warehouseCode: string | null;
  warehouseName: string | null;
  orderCount: number;
  completedCount: number;
  plannedQty: number;
  actualQty: number;
  inputConsumedQty: number;
  outputProducedQty: number;
  wastedQty: number;
  totalInputCost: number;
  totalOutputCost: number;
  totalCostVariance: number;
  totalCycleSeconds: number;
  cycleCount: number;
};

const CHUNK_SIZE = 200;

const asArray = <T,>(value: T | T[] | null | undefined): T[] =>
  value == null ? [] : Array.isArray(value) ? value : [value];
const one = <T,>(value: T | T[] | null | undefined): T | null =>
  Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
const toNumber = (value: number | string | null | undefined) => {
  if (value == null) return 0;
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
};
const pct = (n: number, d: number) => (d > 0 ? (n / d) * 100 : 0);
const diffSeconds = (start: string | null, end: string | null) => {
  if (!start || !end) return 0;
  const a = new Date(start).getTime();
  const b = new Date(end).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return 0;
  return (b - a) / 1000;
};

export async function GET(request: NextRequest) {
  try {
    await requirePermission(RESOURCES.REPORTS, "view");
    const { supabase } = await createServerClientWithBU();
    const { searchParams } = new URL(request.url);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from("users")
      .select("company_id")
      .eq("id", user.id)
      .single();
    if (!userData?.company_id) {
      return NextResponse.json({ error: "User company not found" }, { status: 400 });
    }

    const startDate =
      searchParams.get("startDate") ||
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const endDate = searchParams.get("endDate") || new Date().toISOString().slice(0, 10);
    const warehouseId = searchParams.get("warehouseId") || undefined;
    const templateId = searchParams.get("templateId") || undefined;
    const groupBy = (searchParams.get("groupBy") || "template") as "template" | "warehouse";
    const status = (searchParams.get("status") || "COMPLETED") as
      | "COMPLETED"
      | "PREPARING"
      | "DRAFT"
      | "CANCELLED"
      | "ALL";

    const orders: TransformationOrderRow[] = [];
    let from = 0;
    while (true) {
      let query = supabase
        .from("transformation_orders")
        .select(
          `
          id,
          order_code,
          status,
          template_id,
          source_warehouse_id,
          planned_quantity,
          actual_quantity,
          total_input_cost,
          total_output_cost,
          cost_variance,
          order_date,
          execution_date,
          completion_date,
          template:transformation_templates(template_code, template_name),
          source_warehouse:warehouses!transformation_orders_source_warehouse_id_fkey(warehouse_code, warehouse_name),
          inputs:transformation_order_inputs(id, consumed_quantity, planned_quantity, total_cost),
          outputs:transformation_order_outputs(id, is_scrap, produced_quantity, wasted_quantity, total_allocated_cost, waste_reason)
        `
        )
        .eq("company_id", userData.company_id)
        .is("deleted_at", null)
        .gte("order_date", startDate)
        .lte("order_date", endDate)
        .order("order_date", { ascending: false })
        .range(from, from + CHUNK_SIZE - 1);

      if (warehouseId) query = query.eq("source_warehouse_id", warehouseId);
      if (templateId) query = query.eq("template_id", templateId);
      if (status !== "ALL") query = query.eq("status", status);

      const { data, error } = await query;
      if (error) {
        return NextResponse.json(
          { error: "Failed to fetch transformation efficiency data" },
          { status: 500 }
        );
      }
      const chunk = (data || []) as TransformationOrderRow[];
      if (chunk.length === 0) break;
      orders.push(...chunk);
      if (chunk.length < CHUNK_SIZE) break;
      from += CHUNK_SIZE;
    }

    const templateMap = new Map<string, GroupAgg>();
    const warehouseMap = new Map<string, GroupAgg>();
    const dailyTrendMap = new Map<
      string,
      {
        date: string;
        orderCount: number;
        completedCount: number;
        plannedQty: number;
        actualQty: number;
        inputConsumedQty: number;
        outputProducedQty: number;
        wastedQty: number;
        totalCycleSeconds: number;
        cycleCount: number;
        totalCostVariance: number;
      }
    >();
    const wasteReasonMap = new Map<string, number>();

    let totalOrders = 0;
    let completedOrders = 0;
    let totalPlannedQty = 0;
    let totalActualQty = 0;
    let totalInputConsumedQty = 0;
    let totalOutputProducedQty = 0;
    let totalWastedQty = 0;
    let totalInputCost = 0;
    let totalOutputCost = 0;
    let totalCostVariance = 0;
    let totalCycleSeconds = 0;
    let cycleCount = 0;

    for (const order of orders) {
      const template = one(order.template);
      const warehouse = one(order.source_warehouse);
      const inputs = asArray(order.inputs);
      const outputs = asArray(order.outputs);
      const plannedQty = toNumber(order.planned_quantity);
      const actualQty = toNumber(order.actual_quantity);
      const inputConsumedQty = inputs.reduce((sum, i) => sum + toNumber(i.consumed_quantity), 0);
      const outputProducedQty = outputs.reduce(
        (sum, o) => sum + (o.is_scrap ? 0 : toNumber(o.produced_quantity)),
        0
      );
      const wastedQty = outputs.reduce((sum, o) => sum + toNumber(o.wasted_quantity), 0);
      const inputCost = toNumber(order.total_input_cost);
      const outputCost = toNumber(order.total_output_cost);
      const costVariance = toNumber(order.cost_variance);
      const cycleSeconds = diffSeconds(order.execution_date, order.completion_date);
      const isCompleted = order.status === "COMPLETED";

      totalOrders += 1;
      if (isCompleted) completedOrders += 1;
      totalPlannedQty += plannedQty;
      totalActualQty += actualQty;
      totalInputConsumedQty += inputConsumedQty;
      totalOutputProducedQty += outputProducedQty;
      totalWastedQty += wastedQty;
      totalInputCost += inputCost;
      totalOutputCost += outputCost;
      totalCostVariance += costVariance;
      if (cycleSeconds > 0) {
        totalCycleSeconds += cycleSeconds;
        cycleCount += 1;
      }

      for (const o of outputs) {
        const reason = (o.waste_reason || "").trim();
        if (reason) wasteReasonMap.set(reason, (wasteReasonMap.get(reason) || 0) + 1);
      }

      const trendKey = order.order_date;
      const trend = dailyTrendMap.get(trendKey) || {
        date: trendKey,
        orderCount: 0,
        completedCount: 0,
        plannedQty: 0,
        actualQty: 0,
        inputConsumedQty: 0,
        outputProducedQty: 0,
        wastedQty: 0,
        totalCycleSeconds: 0,
        cycleCount: 0,
        totalCostVariance: 0,
      };
      trend.orderCount += 1;
      if (isCompleted) trend.completedCount += 1;
      trend.plannedQty += plannedQty;
      trend.actualQty += actualQty;
      trend.inputConsumedQty += inputConsumedQty;
      trend.outputProducedQty += outputProducedQty;
      trend.wastedQty += wastedQty;
      trend.totalCostVariance += costVariance;
      if (cycleSeconds > 0) {
        trend.totalCycleSeconds += cycleSeconds;
        trend.cycleCount += 1;
      }
      dailyTrendMap.set(trendKey, trend);

      const templateKey = order.template_id || "unknown";
      const templateAgg = templateMap.get(templateKey) || {
        key: templateKey,
        groupType: "template",
        templateId: order.template_id || null,
        templateCode: template?.template_code || null,
        templateName: template?.template_name || "Unknown Template",
        warehouseId: null,
        warehouseCode: null,
        warehouseName: null,
        orderCount: 0,
        completedCount: 0,
        plannedQty: 0,
        actualQty: 0,
        inputConsumedQty: 0,
        outputProducedQty: 0,
        wastedQty: 0,
        totalInputCost: 0,
        totalOutputCost: 0,
        totalCostVariance: 0,
        totalCycleSeconds: 0,
        cycleCount: 0,
      };
      templateAgg.orderCount += 1;
      if (isCompleted) templateAgg.completedCount += 1;
      templateAgg.plannedQty += plannedQty;
      templateAgg.actualQty += actualQty;
      templateAgg.inputConsumedQty += inputConsumedQty;
      templateAgg.outputProducedQty += outputProducedQty;
      templateAgg.wastedQty += wastedQty;
      templateAgg.totalInputCost += inputCost;
      templateAgg.totalOutputCost += outputCost;
      templateAgg.totalCostVariance += costVariance;
      if (cycleSeconds > 0) {
        templateAgg.totalCycleSeconds += cycleSeconds;
        templateAgg.cycleCount += 1;
      }
      templateMap.set(templateKey, templateAgg);

      const whKey = order.source_warehouse_id || "unknown";
      const warehouseAgg = warehouseMap.get(whKey) || {
        key: whKey,
        groupType: "warehouse",
        templateId: null,
        templateCode: null,
        templateName: null,
        warehouseId: order.source_warehouse_id || null,
        warehouseCode: warehouse?.warehouse_code || null,
        warehouseName: warehouse?.warehouse_name || "Unknown Warehouse",
        orderCount: 0,
        completedCount: 0,
        plannedQty: 0,
        actualQty: 0,
        inputConsumedQty: 0,
        outputProducedQty: 0,
        wastedQty: 0,
        totalInputCost: 0,
        totalOutputCost: 0,
        totalCostVariance: 0,
        totalCycleSeconds: 0,
        cycleCount: 0,
      };
      warehouseAgg.orderCount += 1;
      if (isCompleted) warehouseAgg.completedCount += 1;
      warehouseAgg.plannedQty += plannedQty;
      warehouseAgg.actualQty += actualQty;
      warehouseAgg.inputConsumedQty += inputConsumedQty;
      warehouseAgg.outputProducedQty += outputProducedQty;
      warehouseAgg.wastedQty += wastedQty;
      warehouseAgg.totalInputCost += inputCost;
      warehouseAgg.totalOutputCost += outputCost;
      warehouseAgg.totalCostVariance += costVariance;
      if (cycleSeconds > 0) {
        warehouseAgg.totalCycleSeconds += cycleSeconds;
        warehouseAgg.cycleCount += 1;
      }
      warehouseMap.set(whKey, warehouseAgg);
    }

    const toRow = (agg: GroupAgg) => ({
      key: agg.key,
      groupType: agg.groupType,
      templateId: agg.templateId,
      templateCode: agg.templateCode,
      templateName: agg.templateName,
      warehouseId: agg.warehouseId,
      warehouseCode: agg.warehouseCode,
      warehouseName: agg.warehouseName,
      orderCount: agg.orderCount,
      completedCount: agg.completedCount,
      completionRatePct: pct(agg.completedCount, Math.max(agg.orderCount, 1)),
      plannedQty: agg.plannedQty,
      actualQty: agg.actualQty,
      inputConsumedQty: agg.inputConsumedQty,
      outputProducedQty: agg.outputProducedQty,
      wastedQty: agg.wastedQty,
      yieldPct: pct(agg.outputProducedQty, Math.max(agg.inputConsumedQty, 1)),
      wasteRatePct: pct(agg.wastedQty, Math.max(agg.inputConsumedQty, 1)),
      planAdherencePct: pct(agg.actualQty, Math.max(agg.plannedQty, 1)),
      totalInputCost: agg.totalInputCost,
      totalOutputCost: agg.totalOutputCost,
      totalCostVariance: agg.totalCostVariance,
      avgCostVariancePerOrder: agg.orderCount > 0 ? agg.totalCostVariance / agg.orderCount : 0,
      averageCycleSeconds: agg.cycleCount > 0 ? agg.totalCycleSeconds / agg.cycleCount : 0,
    });

    const templatePerformance = Array.from(templateMap.values())
      .map(toRow)
      .sort((a, b) => b.orderCount - a.orderCount);
    const warehousePerformance = Array.from(warehouseMap.values())
      .map(toRow)
      .sort((a, b) => b.orderCount - a.orderCount);
    const data = (groupBy === "warehouse" ? warehousePerformance : templatePerformance).slice(0, 50);

    const dailyTrend = Array.from(dailyTrendMap.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => ({
        date: d.date,
        orderCount: d.orderCount,
        completedCount: d.completedCount,
        completionRatePct: pct(d.completedCount, Math.max(d.orderCount, 1)),
        outputProducedQty: d.outputProducedQty,
        wastedQty: d.wastedQty,
        yieldPct: pct(d.outputProducedQty, Math.max(d.inputConsumedQty, 1)),
        wasteRatePct: pct(d.wastedQty, Math.max(d.inputConsumedQty, 1)),
        avgCycleSeconds: d.cycleCount > 0 ? d.totalCycleSeconds / d.cycleCount : 0,
        totalCostVariance: d.totalCostVariance,
      }));

    const wasteReasons = Array.from(wasteReasonMap.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count);

    const summary = {
      totalOrders,
      completedOrders,
      completionRatePct: pct(completedOrders, Math.max(totalOrders, 1)),
      totalPlannedQty,
      totalActualQty,
      totalInputConsumedQty,
      totalOutputProducedQty,
      totalWastedQty,
      yieldPct: pct(totalOutputProducedQty, Math.max(totalInputConsumedQty, 1)),
      wasteRatePct: pct(totalWastedQty, Math.max(totalInputConsumedQty, 1)),
      planAdherencePct: pct(totalActualQty, Math.max(totalPlannedQty, 1)),
      totalInputCost,
      totalOutputCost,
      totalCostVariance,
      averageCycleSeconds: cycleCount > 0 ? totalCycleSeconds / cycleCount : 0,
      templateCount: templatePerformance.length,
      warehouseCount: warehousePerformance.length,
    };

    return NextResponse.json({
      data,
      templatePerformance,
      warehousePerformance,
      dailyTrend,
      wasteReasons,
      summary,
      filters: {
        startDate,
        endDate,
        warehouseId: warehouseId || null,
        templateId: templateId || null,
        groupBy,
        status,
      },
    });
  } catch (error) {
    console.error("Error generating transformation efficiency report:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

