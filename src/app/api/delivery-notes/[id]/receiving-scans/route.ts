import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import {
  fetchDeliveryNote,
  fetchDeliveryNoteHeader,
  getAuthContext,
  isReceivingBusinessUnit,
  toNumber,
} from "../../_lib";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type RecordReceivingScanBody = {
  qrCode?: string;
  boxId?: string;
  itemId?: string;
  itemUnitOptionId?: string | null;
  qty?: number;
  acceptedQty?: number | null;
  adjustmentReason?: string | null;
  notes?: string | null;
  batchNumber?: string | null;
  locationId?: string | null;
};

type ParsedReceivingQrIdentity = {
  itemId: string | null;
  itemCodes: string[];
  unitBarcodes: string[];
  batchNumber: string | null;
  locationId: string | null;
};

type ItemUnitOptionMatch = {
  id: string;
  item_id: string;
};

type ItemCodeMatch = {
  id: string;
};

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const appendString = (target: string[], value: unknown) => {
  if (typeof value === "string" && value.trim()) target.push(value.trim());
};

const unique = (values: string[]) =>
  Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));

const parseReceivingQrIdentity = (value: string): ParsedReceivingQrIdentity => {
  const cleaned = value.trim();
  const result: ParsedReceivingQrIdentity = {
    itemId: null,
    itemCodes: [],
    unitBarcodes: [],
    batchNumber: null,
    locationId: null,
  };
  if (!cleaned) return result;

  try {
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    appendString(result.itemCodes, parsed.item);
    appendString(result.itemCodes, parsed.itemCode);
    appendString(result.itemCodes, parsed.code);
    appendString(result.unitBarcodes, parsed.barcode);
    appendString(result.unitBarcodes, parsed.unitBarcode);
    appendString(result.unitBarcodes, parsed.unit_barcode);

    const itemId = typeof parsed.itemId === "string" ? parsed.itemId.trim() : "";
    result.itemId = isUuid(itemId) ? itemId : null;
    result.batchNumber =
      typeof parsed.batchNumber === "string" && parsed.batchNumber.trim()
        ? parsed.batchNumber.trim()
        : null;
    result.locationId =
      typeof parsed.locationId === "string" && isUuid(parsed.locationId.trim())
        ? parsed.locationId.trim()
        : typeof parsed.location === "string" && isUuid(parsed.location.trim())
          ? parsed.location.trim()
          : null;
  } catch {
    result.itemCodes.push(cleaned);
    result.unitBarcodes.push(cleaned);
  }

  result.itemCodes = unique(result.itemCodes);
  result.unitBarcodes = unique(result.unitBarcodes);
  return result;
};

const userSafeRpcMessage = (message: string | undefined) => {
  if (!message) return "Failed to record receiving scan";
  const allowedMessages = new Set([
    "Box ID is required",
    "Scanned quantity must be greater than zero",
    "Accepted quantity must be greater than zero",
    "Manual quantity adjustment requires a reason",
    "Delivery note not found",
    "Only dispatched delivery notes can be received",
    "Item not found",
    "Multiple delivery note lines match this item. Scan a unit-specific barcode.",
    "Expected item quantity would exceed dispatched quantity",
  ]);

  return allowedMessages.has(message) ? message : "Failed to record receiving scan";
};

// POST /api/delivery-notes/[id]/receiving-scans
async function POSTHandler(request: NextRequest, context: RouteContext) {
  try {
    const unauthorized = await requirePermission(RESOURCES.STOCK_REQUESTS, "edit");
    if (unauthorized) return unauthorized;

    const auth = await getAuthContext();
    if (auth instanceof NextResponse) return auth;

    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as RecordReceivingScanBody;

    if (!body.boxId?.trim()) {
      return NextResponse.json({ error: "Box ID is required" }, { status: 400 });
    }
    if (toNumber(body.qty) <= 0) {
      return NextResponse.json(
        { error: "Scanned quantity must be greater than zero" },
        { status: 400 }
      );
    }

    const header = await fetchDeliveryNoteHeader(auth.supabase, auth.companyId, id);
    if (!header) {
      return NextResponse.json({ error: "Delivery note not found" }, { status: 404 });
    }

    const businessUnitId = auth.currentBusinessUnitId;
    if (!businessUnitId) {
      return NextResponse.json({ error: "Business unit context required" }, { status: 400 });
    }
    const canReceive = await isReceivingBusinessUnit(
      auth.supabase,
      auth.companyId,
      businessUnitId,
      header.requesting_warehouse_id
    );
    if (!canReceive) {
      return NextResponse.json(
        { error: "Only the receiving business unit can record receiving scans" },
        { status: 403 }
      );
    }

    let itemId = body.itemId || null;
    let itemUnitOptionId = body.itemUnitOptionId || null;
    const scannedQrCode = body.qrCode?.trim() || body.boxId.trim();

    if (!itemId) {
      const parsedQr = parseReceivingQrIdentity(scannedQrCode);
      itemId = parsedQr.itemId;
      body.batchNumber = body.batchNumber || parsedQr.batchNumber;
      body.locationId = body.locationId || parsedQr.locationId;

      if (!itemId && parsedQr.unitBarcodes.length > 0) {
        const { data: unitOptions, error: unitOptionError } = await auth.supabase
          .from("item_unit_options")
          .select("id, item_id")
          .eq("company_id", auth.companyId)
          .in("barcode", parsedQr.unitBarcodes)
          .is("deleted_at", null)
          .limit(2);

        if (unitOptionError) {
          console.error("Error resolving scanned unit barcode:", unitOptionError);
          return NextResponse.json({ error: "Failed to resolve scanned QR code" }, { status: 500 });
        }

        if (unitOptions && unitOptions.length > 1) {
          return NextResponse.json(
            { error: "Scanned code matches multiple item units" },
            { status: 400 }
          );
        }

        if (unitOptions && unitOptions.length === 1) {
          const unitOption = unitOptions[0] as ItemUnitOptionMatch;
          itemId = unitOption.item_id;
          itemUnitOptionId = unitOption.id;
        }
      }

      if (!itemId && parsedQr.itemCodes.length > 0) {
        const { data: items, error: itemError } = await auth.supabase
          .from("items")
          .select("id")
          .eq("company_id", auth.companyId)
          .in("item_code", parsedQr.itemCodes)
          .is("deleted_at", null)
          .limit(2);

        if (itemError) {
          console.error("Error resolving scanned item code:", itemError);
          return NextResponse.json({ error: "Failed to resolve scanned QR code" }, { status: 500 });
        }

        if (items && items.length > 1) {
          return NextResponse.json(
            { error: "Scanned code matches multiple items" },
            { status: 400 }
          );
        }

        if (items && items.length === 1) {
          itemId = (items[0] as ItemCodeMatch).id;
        }
      }
    }

    if (!itemId) {
      return NextResponse.json(
        { error: "Scanned QR code does not match any known item" },
        { status: 400 }
      );
    }

    const { data, error } = await auth.supabase.rpc("record_delivery_note_receiving_scan", {
      p_company_id: auth.companyId,
      p_business_unit_id: businessUnitId,
      p_user_id: auth.userId,
      p_dn_id: id,
      p_qr_code: scannedQrCode,
      p_box_id: body.boxId,
      p_item_id: itemId,
      p_item_unit_option_id: itemUnitOptionId,
      p_qr_qty: toNumber(body.qty),
      p_accepted_qty: body.acceptedQty == null ? null : toNumber(body.acceptedQty),
      p_adjustment_reason: body.adjustmentReason || null,
      p_notes: body.notes || null,
      p_batch_number: body.batchNumber || null,
      p_location_id: body.locationId || null,
    });

    if (error) {
      console.error("Error recording delivery note receiving scan:", error);
      return NextResponse.json({ error: userSafeRpcMessage(error.message) }, { status: 400 });
    }

    const deliveryNote = await fetchDeliveryNote(
      auth.supabase,
      auth.companyId,
      id,
      auth.currentBusinessUnitId
    );
    if (!deliveryNote) {
      return NextResponse.json({ error: "Delivery note not found" }, { status: 404 });
    }

    return NextResponse.json({ result: data, deliveryNote });
  } catch (error) {
    console.error("Unexpected error recording delivery note receiving scan:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const POST = withActivityLogging(POSTHandler, {
  action: "create",
  resourceType: "delivery_notes",
  route: "/api/delivery-notes/[id]/receiving-scans",
});
