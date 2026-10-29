import { NextRequest } from "next/server";
import { createTranslator } from "next-intl";
import { z } from "zod";
import { defaultLocale, localeCookieName } from "@/lib/i18n";
import { translations, type TranslationKeys } from "@/lib/i18n/translations";
import type {
  DeliveryNoteReceivingScanErrorCode,
  ResolvedDeliveryNoteReceivingItem,
} from "@/types/delivery-note";
import type { fetchDeliveryNoteHeader } from "./_lib";

export const recordReceivingScanSchema = z
  .object({
    qrCode: z.string().trim().max(8192).optional(),
    boxId: z.string().trim().min(1).max(512),
    itemId: z.string().uuid().nullish(),
    itemUnitOptionId: z.string().uuid().nullish(),
    qty: z.number().positive().max(1_000_000_000),
    acceptedQty: z.number().positive().max(1_000_000_000).nullish(),
    adjustmentReason: z.string().trim().max(1000).nullish(),
    notes: z.string().trim().max(4000).nullish(),
    batchNumber: z.string().trim().max(512).nullish(),
    locationId: z.string().uuid().nullish(),
  })
  .strict();

type ParsedReceivingQrIdentity = {
  itemId: string | null;
  itemUnitOptionId: string | null;
  hasItemDetails: boolean;
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
    itemUnitOptionId: null,
    hasItemDetails: false,
    itemCodes: [],
    unitBarcodes: [],
    batchNumber: null,
    locationId: null,
  };
  if (!cleaned) return result;

  try {
    const parsed: unknown = JSON.parse(cleaned);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      result.itemCodes.push(cleaned);
      result.unitBarcodes.push(cleaned);
      return result;
    }
    const identity = parsed as Record<string, unknown>;
    appendString(result.itemCodes, identity.item);
    appendString(result.itemCodes, identity.itemCode);
    appendString(result.itemCodes, identity.code);
    appendString(result.unitBarcodes, identity.barcode);
    appendString(result.unitBarcodes, identity.unitBarcode);
    appendString(result.unitBarcodes, identity.unit_barcode);

    const itemId = typeof identity.itemId === "string" ? identity.itemId.trim() : "";
    result.itemId = isUuid(itemId) ? itemId : null;
    const unitId = identity.itemUnitOptionId ?? identity.unitOptionId;
    result.itemUnitOptionId =
      typeof unitId === "string" && isUuid(unitId.trim()) ? unitId.trim() : null;
    result.hasItemDetails = Boolean(
      result.itemId || result.itemCodes.length || result.unitBarcodes.length
    );
    result.batchNumber =
      typeof identity.batchNumber === "string" && identity.batchNumber.trim()
        ? identity.batchNumber.trim()
        : null;
    result.locationId =
      typeof identity.locationId === "string" && isUuid(identity.locationId.trim())
        ? identity.locationId.trim()
        : typeof identity.location === "string" && isUuid(identity.location.trim())
          ? identity.location.trim()
          : null;
  } catch {
    result.itemCodes.push(cleaned);
    result.unitBarcodes.push(cleaned);
  }

  result.itemCodes = unique(result.itemCodes);
  result.unitBarcodes = unique(result.unitBarcodes);
  return result;
};

export type ReceivingScanTranslator = (
  key: keyof TranslationKeys["deliveryNoteReceivingScan"]
) => string;

export const getReceivingScanTranslator = (request: NextRequest) => {
  const localeValue = request.cookies.get(localeCookieName)?.value;
  const locale = localeValue === "zh" || localeValue === "en" ? localeValue : defaultLocale;
  return createTranslator({
    locale,
    messages: translations[locale],
    namespace: "deliveryNoteReceivingScan",
  });
};

type ReceivingItemResolution =
  | { item: ResolvedDeliveryNoteReceivingItem; failure: null }
  | {
      item: null;
      failure: { status: number; code: DeliveryNoteReceivingScanErrorCode; error: string };
    };

export const resolveReceivingScanItem = async (
  supabase: Parameters<typeof fetchDeliveryNoteHeader>[0],
  companyId: string,
  input: z.infer<typeof recordReceivingScanSchema>,
  t: ReceivingScanTranslator
): Promise<ReceivingItemResolution> => {
  const identity = parseReceivingQrIdentity(input.qrCode || input.boxId);
  let itemId = input.itemId || identity.itemId;
  let itemUnitOptionId = input.itemUnitOptionId || identity.itemUnitOptionId;

  if (!itemId && identity.unitBarcodes.length > 0) {
    const { data, error } = await supabase
      .from("item_unit_options")
      .select("id, item_id")
      .eq("company_id", companyId)
      .in("barcode", identity.unitBarcodes)
      .is("deleted_at", null)
      .limit(2);
    if (error) {
      console.error("Error resolving receiving unit barcode:", error);
      return {
        item: null,
        failure: {
          status: 500,
          code: "DELIVERY_NOTE_RECEIVING_LOOKUP_FAILED",
          error: t("lookupFailed"),
        },
      };
    }
    if (data && data.length > 1) {
      return {
        item: null,
        failure: {
          status: 400,
          code: "DELIVERY_NOTE_RECEIVING_AMBIGUOUS_ITEM",
          error: t("ambiguousUnit"),
        },
      };
    }
    if (data?.length === 1) {
      const unit = data[0] as ItemUnitOptionMatch;
      itemId = unit.item_id;
      itemUnitOptionId = unit.id;
    }
  }

  if (itemId || identity.itemCodes.length > 0) {
    const query = supabase
      .from("items")
      .select("id")
      .eq("company_id", companyId)
      .is("deleted_at", null);
    const { data, error } = itemId
      ? await query.eq("id", itemId).limit(1)
      : await query.in("item_code", identity.itemCodes).limit(2);
    if (error) {
      console.error("Error resolving receiving item:", error);
      return {
        item: null,
        failure: {
          status: 500,
          code: "DELIVERY_NOTE_RECEIVING_LOOKUP_FAILED",
          error: t("lookupFailed"),
        },
      };
    }
    if (data && data.length > 1) {
      return {
        item: null,
        failure: {
          status: 400,
          code: "DELIVERY_NOTE_RECEIVING_AMBIGUOUS_ITEM",
          error: t("ambiguousItem"),
        },
      };
    }
    itemId = data?.length === 1 ? (data[0] as ItemCodeMatch).id : null;
  }

  if (!itemId) {
    const hasItemDetails = Boolean(input.itemId || identity.hasItemDetails);
    return {
      item: null,
      failure: {
        status: 400,
        code: hasItemDetails
          ? "DELIVERY_NOTE_RECEIVING_ITEM_NOT_FOUND"
          : "DELIVERY_NOTE_RECEIVING_FULL_QR_REQUIRED",
        error: hasItemDetails ? t("itemNotFound") : t("scanFullQr"),
      },
    };
  }

  return {
    item: {
      itemId,
      itemUnitOptionId: itemUnitOptionId || null,
      batchNumber: input.batchNumber || identity.batchNumber,
      locationId: input.locationId || identity.locationId,
    },
    failure: null,
  };
};
