import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

export type StockRequisitionDocumentSettings = {
  showUnitPrice: boolean;
  showLineTotal: boolean;
  showTotalAmount: boolean;
};

export const DEFAULT_STOCK_REQUISITION_DOCUMENT_SETTINGS: StockRequisitionDocumentSettings = {
  showUnitPrice: true,
  showLineTotal: true,
  showTotalAmount: true,
};

const SETTING_KEYS = {
  showUnitPrice: "stock_requisition_pdf_show_unit_price",
  showLineTotal: "stock_requisition_pdf_show_line_total",
  showTotalAmount: "stock_requisition_pdf_show_total_amount",
} as const;

const parseBooleanSetting = (value: unknown, fallback: boolean) =>
  typeof value === "boolean" ? value : fallback;

export async function resolveStockRequisitionDocumentSettings(
  supabase: SupabaseClient<Database>,
  companyId: string,
  businessUnitId: string
): Promise<StockRequisitionDocumentSettings> {
  const { data, error } = await supabase
    .from("settings")
    .select("setting_key, value")
    .eq("company_id", companyId)
    .eq("business_unit_id", businessUnitId)
    .eq("group_key", "inventory")
    .in("setting_key", Object.values(SETTING_KEYS));

  if (error) {
    console.error("Error fetching stock requisition document settings:", error);
    return DEFAULT_STOCK_REQUISITION_DOCUMENT_SETTINGS;
  }

  const settingsByKey = new Map(
    (data ?? []).map((setting) => [setting.setting_key, setting.value])
  );

  return {
    showUnitPrice: parseBooleanSetting(
      settingsByKey.get(SETTING_KEYS.showUnitPrice),
      DEFAULT_STOCK_REQUISITION_DOCUMENT_SETTINGS.showUnitPrice
    ),
    showLineTotal: parseBooleanSetting(
      settingsByKey.get(SETTING_KEYS.showLineTotal),
      DEFAULT_STOCK_REQUISITION_DOCUMENT_SETTINGS.showLineTotal
    ),
    showTotalAmount: parseBooleanSetting(
      settingsByKey.get(SETTING_KEYS.showTotalAmount),
      DEFAULT_STOCK_REQUISITION_DOCUMENT_SETTINGS.showTotalAmount
    ),
  };
}
