import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

// Match the business-day default used by database reporting functions.
const DEFAULT_BUSINESS_TIMEZONE = "Asia/Manila";

export function formatPricingDate(now: Date, timeZone = DEFAULT_BUSINESS_TIMEZONE): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export async function getCurrentPricingDate(
  supabase: SupabaseClient<Database>,
  companyId: string,
  businessUnitId: string | null,
  now = new Date()
): Promise<string> {
  if (!businessUnitId) return formatPricingDate(now);

  const { data, error } = await supabase
    .from("settings")
    .select("value")
    .eq("company_id", companyId)
    .eq("business_unit_id", businessUnitId)
    .eq("group_key", "business_unit")
    .eq("setting_key", "timezone")
    .maybeSingle();

  if (error) throw error;
  if (data && typeof data.value !== "string") {
    throw new Error("Invalid business unit timezone setting");
  }
  const timeZone = typeof data?.value === "string" ? data.value.trim() : "";
  return formatPricingDate(now, timeZone || DEFAULT_BUSINESS_TIMEZONE);
}
