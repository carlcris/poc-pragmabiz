import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireRequestContext } from "@/lib/auth/requestContext";
import { RESOURCES } from "@/constants/resources";

type ItemScanPayload = {
  item_id?: unknown;
  itemId?: unknown;
  item?: unknown;
  batch_location_id?: unknown;
  batchLocationId?: unknown;
  batch_location_sku?: unknown;
  batchLocationSku?: unknown;
  sourceSku?: unknown;
  barcode?: unknown;
  code?: unknown;
  item_code?: unknown;
  itemCode?: unknown;
  location?: unknown;
  warehouse_id?: unknown;
  warehouseId?: unknown;
};

type ItemRow = {
  id: string;
  item_code: string;
  item_name: string;
  description: string | null;
  dimensions: unknown;
  item_type: string;
  image_url: string | null;
  item_categories: { name: string | null } | { name: string | null }[] | null;
};

type WarehouseStockRow = {
  current_stock: number | string | null;
  reserved_stock: number | string | null;
  available_stock: number | string | null;
};

type BatchLocationRow = {
  item_id: string;
  warehouse_id: string;
  warehouses: { business_unit_id: string | null } | { business_unit_id: string | null }[] | null;
};

type Dimensions = {
  length?: number;
  width?: number;
  height?: number;
  unit?: string;
  label: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );

const asText = (value: unknown) => {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
};

const toNumber = (value: unknown) => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseScanInput = (input: string): { payload: ItemScanPayload | null; text: string } => {
  const rawText = input.trim();
  let text = rawText;
  try {
    text = decodeURIComponent(rawText).trim();
  } catch {}
  if (!text) return { payload: null, text: "" };
  if (!text.startsWith("{")) return { payload: null, text };

  const parsed = JSON.parse(text) as unknown;
  if (!isRecord(parsed)) {
    throw new Error("Invalid QR code payload");
  }

  return { payload: parsed, text };
};

const firstText = (payload: ItemScanPayload | null, keys: Array<keyof ItemScanPayload>) => {
  if (!payload) return "";
  for (const key of keys) {
    const value = asText(payload[key]);
    if (value) return value;
  }
  return "";
};

const normalizeDimensions = (value: unknown): Dimensions | null => {
  if (!isRecord(value)) return null;

  const length = toNumber(value.length);
  const width = toNumber(value.width);
  const height = toNumber(value.height);
  const unit = asText(value.unit) || "unit";
  const parts = [
    length > 0 ? `${length}` : "",
    width > 0 ? `${width}` : "",
    height > 0 ? `${height}` : "",
  ].filter(Boolean);

  if (parts.length === 0) return null;

  return {
    ...(length > 0 ? { length } : {}),
    ...(width > 0 ? { width } : {}),
    ...(height > 0 ? { height } : {}),
    unit,
    label: `${parts.join(" x ")} ${unit}`,
  };
};

const getCategoryName = (item: ItemRow) => {
  const category = Array.isArray(item.item_categories)
    ? item.item_categories[0]
    : item.item_categories;
  return category?.name || "Uncategorized";
};

const getBatchBusinessUnitId = (row: BatchLocationRow) => {
  const warehouse = Array.isArray(row.warehouses) ? row.warehouses[0] : row.warehouses;
  return warehouse?.business_unit_id || null;
};

export async function GET(request: NextRequest) {
  try {
    const unauthorized = await requirePermission(RESOURCES.ITEMS, "view");
    if (unauthorized) return unauthorized;

    const context = await requireRequestContext();
    if ("status" in context) return context;

    const { supabase, companyId, currentBusinessUnitId, accessibleBusinessUnitIds, userId } = context;
    if (!currentBusinessUnitId) {
      return NextResponse.json(
        { error: "Select a business unit before scanning items." },
        { status: 400 }
      );
    }

    const scan = request.nextUrl.searchParams.get("payload")?.trim() || "";
    if (!scan) {
      return NextResponse.json({ error: "Scan payload is required." }, { status: 400 });
    }

    let parsed: { payload: ItemScanPayload | null; text: string };
    try {
      parsed = parseScanInput(scan);
    } catch {
      return NextResponse.json({ error: "The scanned QR code is not valid JSON." }, { status: 400 });
    }

    const { data: warehouses, error: warehouseError } = await supabase
      .from("warehouses")
      .select("id")
      .eq("company_id", companyId)
      .eq("business_unit_id", currentBusinessUnitId)
      .is("deleted_at", null);

    if (warehouseError) {
      console.error("Failed to resolve item scan warehouses", warehouseError);
      return NextResponse.json({ error: "Failed to scan item." }, { status: 500 });
    }

    let scopedWarehouseIds = (warehouses || []).map((warehouse) => warehouse.id);
    if (scopedWarehouseIds.length === 0) {
      return NextResponse.json({ error: "No warehouses are available for this business unit." }, { status: 404 });
    }

    let itemId = firstText(parsed.payload, ["item_id", "itemId", "item"]);
    const batchLocationId = firstText(parsed.payload, ["batch_location_id", "batchLocationId"]);
    const batchLocationSku = firstText(parsed.payload, [
      "batch_location_sku",
      "batchLocationSku",
      "sourceSku",
    ]);
    const barcode = firstText(parsed.payload, ["barcode"]);
    const rawBatchLocationSku = !parsed.payload ? (parsed.text.match(/\b\d{10}\b/)?.[0] ?? "") : "";
    const effectiveBatchLocationSku = batchLocationSku || rawBatchLocationSku;
    const itemCode =
      firstText(parsed.payload, ["item_code", "itemCode", "code"]) ||
      (rawBatchLocationSku ? "" : parsed.text);

    if (itemId && !isUuid(itemId)) {
      return NextResponse.json({ error: "The scanned item identifier is invalid." }, { status: 400 });
    }

    if (!itemId && batchLocationId) {
      const batchQuery = supabase
        .from("item_location_batch")
        .select("item_id")
        .eq("company_id", companyId)
        .in("warehouse_id", scopedWarehouseIds)
        .is("deleted_at", null)
        .limit(1);

      const { data: batchRows, error: batchError } = isUuid(batchLocationId)
        ? await batchQuery.eq("id", batchLocationId)
        : await batchQuery.eq("batch_location_sku", batchLocationId);

      if (batchError) {
        console.error("Failed to resolve item scan batch location", batchError);
        return NextResponse.json({ error: "Failed to scan item." }, { status: 500 });
      }

      itemId = batchRows?.[0]?.item_id || "";
    }

    if (!itemId && effectiveBatchLocationSku) {
      const { data: batchRows, error: batchError } = await supabase
        .from("item_location_batch")
        .select("item_id, warehouse_id, warehouses!item_location_batch_warehouse_id_fkey(business_unit_id)")
        .eq("company_id", companyId)
        .eq("batch_location_sku", effectiveBatchLocationSku)
        .is("deleted_at", null)
        .limit(1);

      if (batchError) {
        console.error("Failed to resolve item scan batch SKU", batchError);
        return NextResponse.json({ error: "Failed to scan item." }, { status: 500 });
      }

      const batchRow = ((batchRows || [])[0] || null) as BatchLocationRow | null;
      if (!batchRow?.item_id) {
        return NextResponse.json(
          { data: null, message: "No product found for this code." },
          { status: 200 }
        );
      }

      const batchBusinessUnitId = getBatchBusinessUnitId(batchRow);
      let canAccessBatchBusinessUnit =
        batchBusinessUnitId !== null &&
        (batchBusinessUnitId === currentBusinessUnitId ||
          accessibleBusinessUnitIds.includes(batchBusinessUnitId));

      if (!canAccessBatchBusinessUnit && batchBusinessUnitId) {
        const { data: accessRows, error: accessError } = await supabase
          .from("user_business_unit_access")
          .select("business_unit_id")
          .eq("user_id", userId)
          .eq("business_unit_id", batchBusinessUnitId)
          .limit(1);

        if (accessError) {
          console.error("Failed to verify batch SKU business unit access", accessError);
          return NextResponse.json({ error: "Failed to scan item." }, { status: 500 });
        }

        canAccessBatchBusinessUnit = (accessRows || []).length > 0;
      }

      if (!canAccessBatchBusinessUnit || !batchBusinessUnitId) {
        return NextResponse.json(
          { error: "Batch location SKU belongs to another business unit." },
          { status: 404 }
        );
      }

      itemId = batchRow.item_id;

      if (batchBusinessUnitId !== currentBusinessUnitId) {
        const { data: batchBuWarehouses, error: batchBuWarehouseError } = await supabase
          .from("warehouses")
          .select("id")
          .eq("company_id", companyId)
          .eq("business_unit_id", batchBusinessUnitId)
          .is("deleted_at", null);

        if (batchBuWarehouseError) {
          console.error("Failed to resolve batch SKU business unit warehouses", batchBuWarehouseError);
          return NextResponse.json({ error: "Failed to scan item." }, { status: 500 });
        }

        scopedWarehouseIds = (batchBuWarehouses || []).map((warehouse) => warehouse.id);
      }
    }

    if (!itemId && barcode) {
      const { data: unitRows, error: unitError } = await supabase
        .from("item_unit_options")
        .select("item_id")
        .eq("company_id", companyId)
        .eq("barcode", barcode)
        .eq("is_active", true)
        .is("deleted_at", null)
        .limit(1);

      if (unitError) {
        console.error("Failed to resolve item scan barcode", unitError);
        return NextResponse.json({ error: "Failed to scan item." }, { status: 500 });
      }

      itemId = unitRows?.[0]?.item_id || "";
    }

    let itemQuery = supabase
      .from("items")
      .select(
        `
        id,
        item_code,
        item_name,
        description,
        dimensions,
        item_type,
        image_url,
        item_categories(name)
      `
      )
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .limit(1);

    if (itemId) {
      itemQuery = itemQuery.eq("id", itemId);
    } else if (itemCode) {
      itemQuery = itemQuery.eq("item_code", itemCode);
    } else {
      return NextResponse.json({ error: "The scanned QR code does not include an item." }, { status: 400 });
    }

    const { data: items, error: itemError } = await itemQuery;
    if (itemError) {
      console.error("Failed to resolve scanned item", itemError);
      return NextResponse.json({ error: "Failed to scan item." }, { status: 500 });
    }

    const item = (items?.[0] || null) as ItemRow | null;
    if (!item) {
      return NextResponse.json(
        { data: null, message: "No product found for this code." },
        { status: 200 }
      );
    }

    const { data: stockRows, error: stockError } = await supabase
      .from("item_warehouse")
      .select("current_stock, reserved_stock, available_stock")
      .eq("company_id", companyId)
      .eq("item_id", item.id)
      .in("warehouse_id", scopedWarehouseIds)
      .is("deleted_at", null);

    if (stockError) {
      console.error("Failed to load scanned item stock", stockError);
      return NextResponse.json({ error: "Failed to scan item." }, { status: 500 });
    }

    const inventory = (stockRows || []).reduce(
      (totals, row: WarehouseStockRow) => ({
        onHand: totals.onHand + toNumber(row.current_stock),
        reserved: totals.reserved + toNumber(row.reserved_stock),
        available: totals.available + toNumber(row.available_stock),
      }),
      { onHand: 0, reserved: 0, available: 0 }
    );

    return NextResponse.json({
      data: {
        id: item.id,
        code: item.item_code,
        name: item.item_name,
        type: item.item_type,
        category: getCategoryName(item),
        description: item.description || "",
        imageUrl: item.image_url,
        dimensions: normalizeDimensions(item.dimensions),
        inventory,
      },
    });
  } catch (error) {
    console.error("Unexpected item scan error", error);
    return NextResponse.json({ error: "Failed to scan item." }, { status: 500 });
  }
}
